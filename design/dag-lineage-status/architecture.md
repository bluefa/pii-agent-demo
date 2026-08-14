# DAG 주간 상태 현황판 — 아키텍처

멀티 Composer 환경의 DAG 실행 상태를 OpenLineage 이벤트로 수집해,
DAG별 최근 7일 상태를 준실시간으로 제공하는 시스템.

## 요구사항

- Composer 환경 여러 개, 대상 DAG 약 10만 개, DAG당 task 약 11개, 365일 매일 실행
- 준실시간에 가까운 상태 반영
- DAG 단위(task 아님) 라이프사이클: 스케줄 시작 / 성공 / 실패
- **기존 OpenLineage transport가 이미 존재** — 건드리지 않고 공존해야 함
- 이번 transport는 **DAG 이름이 특정 prefix로 시작하는 DAG만** 지정
  Pub/Sub topic으로 보냄
- DAG 이름 ↔ 외부 ID는 별도 API 서버로 조회 (1:1, Composer·Spring 둘 다 접근 가능)
- 주간 화면:
  1. 최근 7일간 1회 이상 성공 여부 + 성공 시각
  2. 날짜별 상태: 성공 > 동작중 > 실패 > 스케줄 안 됨

## 전체 구조

```
Composer env A ─┐  composite transport = 기존 transport + PubSubTransport
Composer env B ─┼──▶ Pub/Sub topic: lineage-events
Composer env N ─┘   (DAG-only + name-prefix 허용 목록)
                          │
                          ├─▶ pull 구독 ──▶ Spring server (GKE)
                          │                  parse → 멱등 upsert
                          │                       │
                          │                       ▼
                          │             Postgres dag_run_status
                          │                       │        ▲
                          │              (read 시 join)    │ reconciler가
                          │                       │   dag_registry 채움
                          │                       ▼        │
                          │             주간 조회 API   dag-id API server
                          │
                          ├─▶ BigQuery export 구독  (원본 보관, 재계산용)
                          └─▶ dead-letter topic     (max delivery attempts 5)
```

## 이벤트 볼륨 산정과 transport 필터 결정

DAG 하나가 1회 실행될 때 provider가 발행하는 이벤트 (task 11개 기준):

| 종류 | 건수/run | 건당 크기(대략) |
|------|---------|----------------|
| DAG 수준 (START + COMPLETE/FAIL) | 2 | ~2KB |
| task 수준 (task당 START + 종료 이벤트) | 22 | 5~50KB (lineage/facet 포함) |

10만 DAG × 하루 1회 스케줄 가정:

| | 무필터 | DAG-only 필터 |
|---|---|---|
| 일간 건수 | ~240만 | ~20만 (92%↓) |
| 일간 바이트 | 수십 GB | ~0.4GB |
| 자정 폭주 시 유입 | 수백~1천 건/s | 수십 건/s |
| BigQuery 원본 보관 | 30배 이상 | 기준 |

**결정: transport에서 필터한다.** Pub/Sub 요금 자체는 크지 않지만,
쓰지 않을 트래픽의 92%가 폭주 구간에 구독자와 DB에 직접 부하를
주고, BQ 원본 보관과 DLQ 노이즈도 그만큼 커진다. 필터는 transport의 `emit()` 안
몇 줄이고, **허용 목록 2중 조건**(jobType facet이 `DAG` **AND** DAG
이름이 설정된 prefix로 시작)만 통과시키므로 새 이벤트 종류나 대상
외 DAG가 생겨도 의도치 않게 유입되지 않는다. prefix 필터는 요구사항이기도
하지만, prefix 밖 DAG가 늘어나도 이 파이프라인 볼륨이 불변이라는
격리 효과도 있다.

기각한 대안 — `AIRFLOW__OPENLINEAGE__DISABLED_FOR_OPERATORS`:
커스텀 코드 없이 task 이벤트를 끌 수 있으나 operator 클래스 목록을
환경마다 유지해야 하고, 새 operator가 추가되면 task 이벤트가 다시
대량 유입된다(부정형 판정). 채택하지 않음.

## 구성요소별 결정

### Composer 쪽 (transport/) — 기존 transport와 공존

기존 transport가 이미 있으므로 **composite transport**로 나란히 건다.
기존 설정을 composite 안에 그대로 포함하고, 새 `PubSubTransport`를 추가한다:

```
AIRFLOW__OPENLINEAGE__TRANSPORT='{
  "type": "composite",
  "continue_on_failure": true,
  "transports": {
    "existing":      { ...기존 transport 설정 그대로... },
    "weekly_status": { "type": "lineage_pubsub.PubSubTransport",
                       "project": "my-project",
                       "topic": "lineage-events",
                       "dag_name_prefix": "pii_" }
  }
}'
AIRFLOW__OPENLINEAGE__NAMESPACE='composer-env-a'   # 환경별 유니크
```

- `continue_on_failure: true` 필수 — 새 Pub/Sub 경로 장애가 기존
  lineage 흐름을 깨면 안 되고, 그 역도 마찬가지.
- prefix 필터는 새 transport **내부에서만** 적용된다. 기존 transport는
  지금 받던 이벤트를 그대로 받는다 (기존 동작 불변이 공존의 정의).
- DAG 수준 이벤트는 스케줄러 프로세스의 listener가 발행하므로,
  환경변수는 Composer 환경 전체에 적용(기본 동작)이어야 한다.
- publish는 클라이언트의 백그라운드 배칭에 맡기고 future를 기다리지
  않는다 — 스케줄러를 블로킹하면 안 된다.
- namespace는 환경 간 동일한 dag_id를 구분하는 키다.

### Pub/Sub

- 단일 토픽, 구독 3개: Spring pull 구독 / BigQuery export(원본 보관,
  상태 집계 로직 변경 시 재계산의 유일한 수단) / 본 구독에 dead-letter
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
  클라이언트가 메시지 수신을 중단한다.

### 저장 모델 (schema.sql)

- `dag_run_status`: **run 1건 = 행 1개** (run_id PK). 이벤트 로그를
  쌓지 않고 최신 상태만 저장한다. 원본은 BQ export에 보관한다.
- 멱등 upsert: `ON CONFLICT (run_id) DO UPDATE ... WHERE
  EXCLUDED.event_time > 기존.event_time`
  - at-least-once 중복 → 같은 event_time이라 no-op
  - 역순 도착(FAIL 먼저, START 나중) → 오래된 이벤트 탈락
  - clear 후 재실행 → 새 START의 event_time이 더 나중이라
    RUNNING으로 자연 복귀
- 규모: 10만 DAG × 7일 ≈ 주 70만 행. Postgres로 충분.

### DAG 이름 → 외부 ID 해석 (dag_registry)

매핑이 **1:1 정적**이고 DAG가 365일 매일 도는 조건에서, "언제
알아내는가"의 답은 **이벤트 처리 흐름과 분리해 한 번만 조회**다.

채택안 — Spring 쪽 `dag_registry` 테이블:

1. **초기 백필 1회**: API 서버에 벌크/목록 조회가 있으면 한 번에
   10만 건 적재. 단건 조회만 있으면 일회성 백필 스크립트로 채운다.
2. **reconciler 주기 실행** (기본 5분): `dag_run_status`에는 있는데
   `dag_registry`에 없는 이름만 API로 해석해 저장. 매일 도는 DAG
   10만 개는 첫날 안에 전부 등록되므로, **정상 상태에서 API 호출은
   신규 DAG가 생겼을 때만** 발생한다 (하루 0건에 수렴).
3. **조회 시 join**: 주간 화면이 `dag_registry`를 LEFT JOIN해서
   외부 ID를 붙인다. 새로 생성된 DAG는 최대 reconcile 주기만큼 ID가
   null로 보였다가 채워진다.

기각한 대안 (전부 "매번 다시 알아내기"라 낭비이거나 장애 전파 경로):

| 대안 | 기각 사유 |
|------|----------|
| transport에서 이벤트마다 API 조회 후 첨부 | 스케줄러 경로에 외부 호출 삽입, N개 환경 각각 캐시 필요, 이벤트 스키마 오염 |
| 각 DAG 안에서 매일 자기 ID 조회 | 정적 매핑에 10만 × 365 호출. Composer가 API에 접근할 수 있다는 이유만으로 채택할 근거가 되지 않음 |
| Spring 소비 콜백에서 인라인 조회 | ack 경로가 API 서버 가용성에 종속 — 자정 폭주가 API 서버로 전파되고, API 장애가 수집 정체로 역전파 |

### 주간 조회 (읽기 시점 집계)

- 날짜 버킷은 **이벤트 시각이 아니라 `logical_date`의 KST 날짜**.
  자정 넘겨 끝나는 run이 이틀에 걸치지 않는다.
- 날짜별 상태 우선순위: SUCCESS > RUNNING > FAILED, 행 없음 →
  NOT_SCHEDULED. (실패 후 재실행 중이면 "동작중"으로 보인다.)
- "주간 1회 이상 성공"의 성공 시각은 **가장 최근 성공**의
  eventTime을 쓴다.
- 외부 ID는 `dag_registry`를 LEFT JOIN해서 응답에 붙인다.
- 주 70만 행 인덱스 스캔이라 사전 집계 테이블 없이 읽기 시점
  GROUP BY로 충분하다.

## 운영

- **파이프라인 자체 모니터링(필수)**: 어느 환경의 transport 장애가
  감지되지 않은 채 지속되면 그 환경 전체가 "스케줄 안 됨"으로 보인다. namespace별
  이벤트 유입량 급감 알람 + 구독 oldest-unacked-message-age 알람.
- 파싱 실패는 nack → 재전송 → DLQ. DLQ 적재량에도 알람.

## 확인 필요 (착수 전 오픈 이슈)

1. **실제 페이로드 캡처**: facet 경로(`airflowDagRun.dagRun.*`)는
   provider 버전 종속. 대상 Composer에서 이벤트 1건을 떠서
   parsing.md의 경로 표와 대조 후 확정한다.
2. **버전 핀**: openlineage-python 클라이언트의 Transport API가
   메이저 간 변경됨. provider·client 버전을 함께 고정. composite
   transport의 `transports` 설정 형식(dict/list)과
   `continue_on_failure` 기본값도 고정 버전에서 확인.
3. **기존 transport 설정 형식 확인**: 현재 어떤 방식으로 설정돼
   있는지(`AIRFLOW__OPENLINEAGE__TRANSPORT` / `openlineage.yml` /
   config_path)에 따라 composite 설정으로 전환하는 방법이 달라진다.
4. **prefix 확정**: 값과 단수/복수 여부. 복수가 되면
   `dag_name_prefix`를 리스트로 확장 (transport 코드 한 줄).
5. **dag-id API의 벌크 조회 유무**: 있으면 초기 백필이 호출 1번,
   없으면 단건 10만 회 백필 스크립트(레이트 리밋 필요).
6. **DAG 카탈로그 소스**: 현재 목록은 이벤트에서 유도되므로 7일간
   이벤트가 0건인 DAG는 화면에서 아예 사라진다. "7일 내내 스케줄
   안 됨" 행으로 보여야 한다면 별도 DAG 카탈로그(예: dag-id API가
   전체 목록을 준다면 그것)에서 페이지네이션해야 한다.
7. 스케줄 주기가 daily가 아닌 DAG 비중 — 시간당 스케줄이면 볼륨
   산정이 ×24. (365일 매일 1회면 현재 산정 그대로.)
