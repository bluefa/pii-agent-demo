# DAG 주간 상태 현황판 — 아키텍처

멀티 Composer 환경의 DAG 실행 상태를 OpenLineage 이벤트로 수집해,
DAG별 최근 7일 상태를 준실시간으로 제공하는 시스템.

## 요구사항

- Composer 환경 여러 개, DAG 약 10만 개, DAG당 task 약 11개
- 준실시간에 가까운 상태 반영
- DAG 단위(task 아님) 라이프사이클: 스케줄 시작 / 성공 / 실패
- 주간 화면:
  1. 최근 7일간 1회 이상 성공 여부 + 성공 시각
  2. 날짜별 상태: 성공 > 동작중 > 실패 > 스케줄 안 됨

## 전체 구조

```
Composer env A ─┐  (openlineage provider + custom PubSubTransport)
Composer env B ─┼──▶ Pub/Sub topic: lineage-events
Composer env N ─┘         │
                          ├─▶ pull 구독 ──▶ Spring server (GKE)
                          │                  parse → 멱등 upsert
                          │                       │
                          │                       ▼
                          │                  Postgres dag_run_status
                          │                       │
                          │                       ▼
                          │                  주간 조회 API (GROUP BY)
                          │
                          ├─▶ BigQuery export 구독  (원본 보관, 재계산용)
                          └─▶ dead-letter topic     (max delivery attempts 5)
```

## 이벤트 볼륨 산정과 transport 필터 결정

DAG 하나가 1회 실행될 때 provider가 발행하는 이벤트 (task 11개 기준):

| 종류 | 건수/run | 건당 크기(대략) |
|------|---------|----------------|
| DAG 수준 (START + COMPLETE/FAIL) | 2 | ~2KB |
| task 수준 (task당 START + 터미널) | 22 | 5~50KB (lineage/facet 포함) |

10만 DAG × 하루 1회 스케줄 가정:

| | 무필터 | DAG-only 필터 |
|---|---|---|
| 일간 건수 | ~240만 | ~20만 (92%↓) |
| 일간 바이트 | 수십 GB | ~0.4GB |
| 자정 폭주 시 유입 | 수백~1천 건/s | 수십 건/s |
| BigQuery 원본 보관 | 30배 이상 | 기준 |

**결정: transport에서 필터한다.** Pub/Sub 요금 자체는 크지 않지만,
쓰지 않을 트래픽의 92%가 폭주 구간에 구독자·DB를 직격하고, BQ 원본
보관과 DLQ 노이즈도 그만큼 커진다. 필터는 transport의 `emit()` 안
3줄이고, **허용 목록 방식**(jobType facet이 `DAG`인 것만 통과)이라
새 이벤트 종류가 생겨도 조용히 새지 않는다.

기각한 대안 — `AIRFLOW__OPENLINEAGE__DISABLED_FOR_OPERATORS`:
커스텀 코드 없이 task 이벤트를 끌 수 있으나 operator 클래스 목록을
환경마다 유지해야 하고, 새 operator가 추가되면 조용히 firehose가
다시 열린다(부정형 판정). 채택하지 않음.

## 구성요소별 결정

### Composer 쪽 (transport/)

- `apache-airflow-providers-openlineage` + 커스텀 `PubSubTransport`
  (작은 PyPI 패키지로 전 환경에 설치).
- 환경변수 2개로 끝: `AIRFLOW__OPENLINEAGE__TRANSPORT`(topic 설정),
  `AIRFLOW__OPENLINEAGE__NAMESPACE`(환경별 유니크 — 환경 간 dag_id
  충돌을 흡수하는 키).
- DAG 수준 이벤트는 스케줄러 프로세스의 listener가 발행하므로,
  환경변수는 Composer 환경 전체에 적용(기본 동작)이어야 한다.
- publish는 클라이언트의 백그라운드 배칭에 맡기고 future를 기다리지
  않는다 — 스케줄러를 블로킹하면 안 된다.

### Pub/Sub

- 단일 토픽, 구독 3개: Spring pull 구독 / BigQuery export(원본 보관,
  폴드 로직 변경 시 재계산의 유일한 수단) / 본 구독에 dead-letter
  정책을 걸어 max delivery attempts 5 소진 시 DLQ 토픽으로.
- ordering key는 쓰지 않는다. 순서·중복은 소비 쪽 멱등 upsert가
  eventTime 비교로 흡수한다.

### Spring 수집부 (GKE)

- push가 아닌 **pull**: private 클러스터에서 egress만 필요, 공개
  HTTPS 엔드포인트·인증 미들웨어가 전부 불필요.
- 별도 워커 배포물 없음 — 기존 서버 프로세스 안에서
  `PubSubTemplate.subscribe()` 하나. 레플리카가 여러 개면 전부
  pull하지만 Pub/Sub이 분배하고 upsert가 멱등이라 무해.
- 인증: Workload Identity로 Pod의 KSA에 `roles/pubsub.subscriber`
  바인딩. 키 파일 없음.
- 폭주 제어: `spring.cloud.gcp.pubsub.subscriber.flow-control.
  max-outstanding-element-count: 500` — 처리 속도를 넘으면
  클라이언트가 당기기를 멈춘다.

### 저장 모델 (schema.sql)

- `dag_run_status`: **run 1건 = 행 1개** (run_id PK). 이벤트 로그를
  쌓지 않고 최신 상태로 접는다. 원본은 BQ export가 들고 있다.
- 멱등 upsert: `ON CONFLICT (run_id) DO UPDATE ... WHERE
  EXCLUDED.event_time > 기존.event_time`
  - at-least-once 중복 → 같은 event_time이라 no-op
  - 역순 도착(FAIL 먼저, START 나중) → 오래된 이벤트 탈락
  - clear 후 재실행 → 새 START의 event_time이 더 나중이라
    RUNNING으로 자연 복귀
- 규모: 10만 DAG × 7일 ≈ 주 70만 행. Postgres로 충분.

### 주간 조회 (읽기 시점 집계)

- 날짜 버킷은 **이벤트 시각이 아니라 `logical_date`의 KST 날짜**.
  자정 넘겨 끝나는 run이 이틀에 걸치지 않는다.
- 날짜별 상태 우선순위: SUCCESS > RUNNING > FAILED, 행 없음 →
  NOT_SCHEDULED. (실패 후 재실행 중이면 "동작중"으로 보인다.)
- "주간 1회 이상 성공"의 성공 시각은 **가장 최근 성공**의
  eventTime을 쓴다.
- 주 70만 행 인덱스 스캔이라 사전 집계 테이블 없이 읽기 시점
  GROUP BY로 충분하다.

## 운영

- **파이프라인 자기 감시(필수)**: 어느 환경의 transport가 조용히
  죽으면 그 환경 전체가 "스케줄 안 됨"으로 보인다. namespace별
  이벤트 유입량 급감 알람 + 구독 oldest-unacked-message-age 알람.
- 파싱 실패는 nack → 재전송 → DLQ. DLQ 적재량에도 알람.

## 확인 필요 (착수 전 오픈 이슈)

1. **실제 페이로드 캡처**: facet 경로(`airflowDagRun.dagRun.*`)는
   provider 버전 종속. 대상 Composer에서 이벤트 1건을 떠서
   parsing.md의 경로 표와 대조 후 확정한다.
2. **버전 핀**: openlineage-python 클라이언트의 Transport API가
   메이저 간 변경됨. provider·client 버전을 함께 고정.
3. **DAG 카탈로그 소스**: 현재 목록은 이벤트에서 유도되므로 7일간
   이벤트가 0건인 DAG는 화면에서 아예 사라진다. "7일 내내 스케줄
   안 됨" 행으로 보여야 한다면 별도 DAG 카탈로그(예: 각 환경
   REST API 일 1회 동기화)에서 페이지네이션해야 한다.
4. 스케줄 주기가 daily가 아닌 DAG 비중 — 시간당 스케줄이면 볼륨
   산정이 ×24.
