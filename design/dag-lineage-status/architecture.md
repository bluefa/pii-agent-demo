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
- DAG 이름 ↔ 외부 ID는 별도 API 서버로 조회 (1:1, Composer·Spring 둘 다
  접근 가능). **DAG 이름은 환경 간 전역 유니크** (오너 확인)
- 주간 화면:
  1. 최근 7일간 1회 이상 성공 여부 + 성공 시각
  2. 날짜별 상태: 성공 > 동작중 > 실패 > 스케줄 안 됨

## 결정 사항 (오너 확정)

- **manual/backfill 실행의 성공도 그날의 '성공'으로 인정** — 화면의
  질문이 "그날 일이 됐는가"이므로. run_type은 저장만 하고 집계
  필터로 쓰지 않는다.
- **DAG 이름은 환경 간 전역 유니크** — registry·조회 키는 dag_name 단독.
- **주간 화면의 DAG 목록 진실 원천은 `dag_registry`(카탈로그)** —
  이벤트에서 목록을 유도하지 않는다. (외부 리뷰 C3/M2 반영)

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
                          │            (카탈로그 기준 조회) │ catalog sync가
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
| 자정 폭주 시 유입 (최악: 전 DAG 동시 스케줄) | 수천 건/s | ~330건/s |
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
  않는다 — 스케줄러를 블로킹하면 안 된다. 대신 future 완료 콜백으로
  publish 실패를 **로깅**하고, 프로세스 종료 시 `close()`가 잔여
  배치를 flush한다(폭주 구간 마지막 이벤트 유실 방지). 동기 확인은
  스케줄러 블로킹이라 채택하지 않음.
- namespace는 환경 간 동일한 dag_id를 구분하는 키다.

### Pub/Sub

- 단일 토픽, 구독 3개: Spring pull 구독 / BigQuery export(원본 보관,
  상태 집계 로직 변경 시 재계산의 유일한 수단) / 본 구독에 dead-letter
  정책을 걸어 max delivery attempts 5 소진 시 DLQ 토픽으로.
- 본 구독의 재시도 정책은 exponential backoff(예: 최소 10초, 최대
  600초) — 소비 실패가 즉시 재전송 폭주로 되돌아오지 않게 한다.
- ordering key는 쓰지 않는다. 순서·중복은 소비 쪽 멱등 upsert가
  eventTime 비교로 흡수한다.

### Spring 수집부 (GKE)

- push가 아닌 **pull**: private 클러스터에서 egress만 필요, 공개
  HTTPS 엔드포인트·인증 미들웨어가 전부 불필요.
- 별도 워커 배포물 없음 — 기존 서버 프로세스 안에서
  `PubSubTemplate.subscribe()` 하나. 레플리카가 여러 개면 전부
  pull하지만 Pub/Sub이 분배하고 upsert가 멱등이라 무해.
- 소비 쪽도 jobType facet을 확인해 DAG가 아닌 이벤트는 ack 후
  버린다(2차 방어) — transport 필터가 뚫려도 데이터가 오염되지
  않는다. (parsing.md 참조)
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
- **보존 30일**: 주간 화면은 7일만 읽지만 행은 계속 쌓인다(하루
  ~10만 행). 일 1회 배치로 `DELETE FROM dag_run_status WHERE
  logical_date < now() - interval '30 days'` 정리. 최대 ~300만 행
  규모라 파티셔닝은 채택하지 않음(과설계).

### DAG 카탈로그와 외부 ID (dag_registry)

`dag_registry`는 두 역할을 겸한다: **이름→외부 ID 매핑**이자, 주간
화면이 어떤 DAG를 보여줄지 결정하는 **카탈로그(진실 원천)**다.
이벤트에서 DAG 목록을 유도하지 않으므로, 7일간 이벤트가 0건인
DAG도 "7일 내내 스케줄 안 됨" 행으로 화면에 남는다.

1. **초기 백필 1회**: dag-id API의 목록(벌크) 조회로 10만 건 적재.
2. **주기 sync** (기본 1시간, `DagCatalogSync`): 전체 카탈로그를
   다시 받아 upsert하고, 이번 sync에 없던 행은 삭제한다(삭제된
   DAG 정리). 새로 생성된 DAG는 최대 sync 주기만큼 늦게 화면에
   나타난다. 빈 응답·조회 실패 시에는 registry를 지우지 않고 다음
   주기로 넘긴다.
3. **조회**: 주간 화면이 `dag_registry`를 dag_name keyset으로
   페이지네이션하고, 그 페이지의 DAG들에 대해서만 `dag_run_status`를
   조회한다. 10만 행 OFFSET 딥 페이징이 없다.

이벤트 처리 경로는 id API를 전혀 호출하지 않는다 — API 장애가
수집 정체로 전파되지 않고, 그 반대도 없다.

기각한 대안:

| 대안 | 기각 사유 |
|------|----------|
| 이벤트에서 DAG 목록 유도 + 미해석 이름만 단건 조회 (reconciler) | 이벤트 0건 DAG가 화면에서 사라지고, "어떤 DAG가 있는가"의 진실 원천이 이벤트/카탈로그 둘로 갈라진다 (리뷰 C3/M2로 카탈로그 단일 축으로 전환) |
| transport에서 이벤트마다 API 조회 후 첨부 | 스케줄러 경로에 외부 호출 삽입, N개 환경 각각 캐시 필요, 이벤트 스키마 오염 |
| 각 DAG 안에서 매일 자기 ID 조회 | 정적 매핑에 10만 × 365 호출. Composer가 API에 접근할 수 있다는 이유만으로 채택할 근거가 되지 않음 |
| Spring 소비 콜백에서 인라인 조회 | ack 경로가 API 서버 가용성에 종속 — 자정 폭주가 API 서버로 전파되고, API 장애가 수집 정체로 역전파 |

### 주간 조회 (읽기 시점 집계)

- **목록·페이지네이션 축은 `dag_registry`** (keyset, dag_name 순).
  이벤트가 0건인 DAG도 "7일 내내 스케줄 안 됨"으로 표시된다.
- 날짜 버킷은 **이벤트 시각이 아니라 `logical_date`의 KST 날짜**.
  자정 넘겨 끝나는 run이 이틀에 걸치지 않는다.
- 날짜별 상태 우선순위: SUCCESS > RUNNING > FAILED, 행 없음 →
  NOT_SCHEDULED. (실패 후 재실행 중이면 "동작중"으로 보인다.)
- manual/backfill 성공도 그날의 성공으로 집계한다 (결정 사항 참조).
- "주간 1회 이상 성공"의 성공 시각은 **가장 최근 성공**의
  eventTime을 쓴다.
- 외부 ID는 카탈로그 페이지에서 함께 읽으므로 항상 채워져 있다.
- 주 70만 행 인덱스 스캔이라 사전 집계 테이블 없이 읽기 시점
  GROUP BY로 충분하다.

## 운영

- **파이프라인 자체 모니터링(필수)**: 어느 환경의 transport 장애가
  감지되지 않은 채 지속되면 그 환경 전체가 "스케줄 안 됨"으로 보인다. namespace별
  이벤트 유입량 급감 알람 + 구독 oldest-unacked-message-age 알람.
- 파싱 실패는 nack → 재전송(백오프) → DLQ. DLQ 적재량에도 알람.
- **DLQ 운영**:
  - dead-letter 발행 주체는 Spring이 아니라 **Pub/Sub 서비스**다.
    소비 코드는 ack/nack까지만 책임진다. 따라서 권한도 Pub/Sub
    서비스 에이전트(`service-{프로젝트번호}@gcp-sa-pubsub.iam.
    gserviceaccount.com`)에 부여한다 — DLQ 토픽에 publisher, 본
    구독에 subscriber. 누락 시 dead-letter가 동작하지 않는다.
  - **DLQ 토픽에도 구독이 최소 1개 필요** — 구독 없는 토픽에 발행된
    메시지는 버려진다. 우선은 pull 구독 하나(보존 기본 7일, 최대
    31일)로 쌓아두고, 장기 보관·SQL 조사가 필요해지면 BigQuery
    export 구독을 붙인다.
  - 재처리 두 갈래: 파서 수정 후 DLQ에서 pull해 원 토픽에
    재발행(멱등 upsert라 중복 무해), DLQ로 빠진 기간이 길면 원본
    BQ export에서 재계산.

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
5. **dag-id API의 목록(벌크) 조회 유무**: 카탈로그 sync의 전제.
   목록 API가 없으면 단건 조회만으로는 전체 DAG 목록을 알 수
   없으므로, 이름 목록의 별도 원천(예: Composer DAG 목록 export)이
   필요하다.
6. **runId 안정성 실측**: clear 후 재실행이 같은 runId를
   재사용하는지. 같으면 기존 행이 갱신되고, 새 runId면 행이 하나 더
   생기는데 — 날짜 상태 집계는 두 경우 모두 동일하게 나온다
   (우선순위 min이 흡수). 실측 결과에 맞춰 문서 서술만 정리한다.
7. **자정 폭주 부하 확인**: 필터 후에도 최악(전 DAG 동시 스케줄)
   ~330건/s. flow-control 500 기준으로 소비+upsert 처리량이
   따라가는지 부하 테스트로 확인한다.
8. 스케줄 주기가 daily가 아닌 DAG 비중 — 시간당 스케줄이면 볼륨
   산정이 ×24. (365일 매일 1회면 현재 산정 그대로.)
