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
- **그룹(target source) 단위 조회**: target source 하나에 속한 DAG
  N개(최대 1만)의 주간 상태를 반환해야 한다. target source 단위로
  논리 DB가 생성되고 **논리 DB 1개 = DAG 1개**. DAG가 한번 그룹에
  편입되면 영원히 그 그룹이다(오너 확인 — 이동·탈퇴 없음).
  `target_source_id`는 long이고, **GET 쿼리가 오기 전까지는 절대 알
  수 없다** — 이벤트 발송·처리 시점 모두(오너 확인).

## 결정 사항 (오너 확정)

- **manual/backfill 실행의 성공도 그날의 '성공'으로 인정** — 화면의
  질문이 "그날 일이 됐는가"이므로. run_type은 저장만 하고 집계
  필터로 쓰지 않는다.
- **DAG 이름은 환경 간 전역 유니크** — registry·조회 키는 dag_name 단독.
- **주간 화면의 DAG 목록 진실 원천은 `dag_registry`(카탈로그)** —
  이벤트에서 목록을 유도하지 않는다. (외부 리뷰 C3/M2 반영)
- **lineage 이벤트 원본은 보존하지 않는다** — 보존 요구사항이
  없다. BigQuery export 없음, `dag_run_status`도 7일 창을 지나면
  삭제. 대가: 과거 재계산 수단이 없다(아래 Pub/Sub 절 참조).
- **저장은 기존 운영 MySQL 8** — Postgres 전환은 불가(운영 DB 기정).
- **그룹 축은 `dag_registry`의 컬럼(`target_source_id` BIGINT)이다** —
  DAG:논리DB가 1:1이고 논리DB는 target source 하나에 속하므로,
  멤버십은 DAG의 속성이다. 별도 join 테이블도, 이벤트·상태 행에
  그룹을 스탬핑하는 것도 없다. 값은 그룹 GET이 처음 도착할 때
  **읽기 경로에서 학습**해 write-once로 영속한다(아래 그룹 조회 절).

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
                          │               MySQL dag_run_status
                          │                       │        ▲
                          │            (카탈로그 기준 조회) │ catalog sync가
                          │                       │   dag_registry 채움
                          │                       ▼        │
                          │             주간 조회 API   dag-id API server
                          │
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

**결정: transport에서 필터한다.** Pub/Sub 요금 자체는 크지 않지만,
쓰지 않을 트래픽의 92%가 폭주 구간에 구독자와 DB에 직접 부하를
주고, DLQ 노이즈도 그만큼 커진다. 필터는 transport의 `emit()` 안
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
    "dag_monitoring": { "type": "lineage_pubsub.PubSubTransport",
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

- 단일 토픽, 구독은 Spring pull 구독 하나. 본 구독에 dead-letter
  정책을 걸어 max delivery attempts 5 소진 시 DLQ 토픽으로.
- 원본 보관용 export 구독은 두지 않는다 — lineage 이벤트 보존
  요구사항이 없다(결정 사항). 대가는 명시해 둔다: 집계 로직 변경이나
  소비 버그로 데이터가 오염되면 과거를 재계산할 수단이 없고, 7일
  창이 지나며 자연 복구되는 것까지가 한계다. 화면 자체가 7일
  창이므로 수용한다.
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
  쌓지 않고 최신 상태만 저장한다. 원본은 어디에도 보관하지 않는다
  (결정 사항).
- 멱등 upsert: MySQL엔 Postgres `ON CONFLICT ... WHERE` 같은 행 단위
  조건이 없으므로, `INSERT ... ON DUPLICATE KEY UPDATE`에 컬럼마다
  `IF(new.event_time > event_time, 새 값, 기존 값)` 가드를 건다.
  - at-least-once 중복 → 같은 event_time이라 no-op
  - 역순 도착(FAIL 먼저, START 나중) → 오래된 이벤트가 가드에 탈락
  - clear 후 재실행 → 새 START의 event_time이 더 나중이라
    RUNNING으로 자연 복귀
  - **대입 순서 함정**: ON DUPLICATE KEY UPDATE는 왼쪽부터 차례로
    반영되고 뒤의 대입이 앞의 결과를 본다. 가드 기준인
    `event_time`은 반드시 **맨 마지막에** 대입한다.
- MySQL 8 규약: `DATETIME(6)`에 UTC로 저장, 커넥션
  `connectionTimeZone=UTC`. KST 날짜 버킷은
  `CONVERT_TZ(logical_date, '+00:00', '+09:00')` 고정 오프셋 —
  KST는 DST가 없어 tz 테이블 로드가 필요 없다. dag 이름 컬럼은
  `utf8mb4_bin`(Airflow dag_id는 대소문자 구분 — 기본 ai_ci
  collation이면 `Foo`/`foo`가 PK 충돌).
- 규모: 10만 DAG × 7일 ≈ 상시 ~70만 행. MySQL로 충분.
- **보존 7일**: 주간 화면이 읽는 창이 곧 보존 기간이다. 일 1회
  배치로 `DELETE FROM dag_run_status WHERE logical_date <
  NOW() - INTERVAL 7 DAY` 정리 — 창의 가장 오래된 시각(6일 전 KST
  00:00)보다 항상 과거라 화면과 경합하지 않는다. 파티셔닝은 채택하지
  않음(과설계).

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

### 그룹(Target Source) 단위 조회

target source = 그룹, 그룹 하나가 DAG 최대 1만 개를 가진다. 제약이
하나 있다: `target_source_id`(long)는 **그룹 GET이 도착하기 전까지
절대 알 수 없다** — 이벤트 발송 시점에도, 처리 시점에도 알기 어렵고,
카탈로그 sync로 미리 당겨올 수도 없다(오너 확인). 우려는 "매
요청마다 멤버 id N개를 불러와서 N개를 조회"하는 부하인데, 알 수 있는
유일한 시점(GET)에 배운 것을 영속해 그 패턴을 반복하지 않는 게 답이다:

1. **첫 GET에서 학습하고 write-once로 영속** — 그룹 GET이 도착한
   시점에만 멤버 목록을 알 수 있으므로, 그 목록을
   `dag_registry.target_source_id`에 fold한다(`assignGroup` —
   `target_source_id IS NULL`인 행만 갱신). "한번 편입되면
   영원히"이므로 학습된 사실은 만료되지 않는다: 같은 목록이 다시
   와도 no-op이고, 멤버십이 틀려질 방법이 없다. 멤버 id N개를 다루는
   비용이 **매 요청**에서 **그룹당 최초 1회 + 신규 편입분**으로
   줄어든다. id가 long이라 1만 개여도 ~80KB 수준이다.
2. **학습된 뒤로는 id 목록 없이 로컬 인덱스로** —
   `WHERE target_source_id = ?` + `(target_source_id, dag_name)`
   인덱스로 **그룹 안에서 keyset 페이지네이션**한다. 1만 개 id를
   메모리에 올려 IN절로 되던지는 단계가 없고, 요청당 비용은 페이지
   크기(예: 100)에만 비례한다 — N이 1만이어도 동일하다.
3. **집계는 기존 주간 조회와 동일 경로** — 그룹 페이지의 DAG들에
   대해서만 `dag_run_status`를 (dag_id, logical_date) 인덱스로 읽는다.
   그룹 전용 집계 테이블이 필요 없다.

카탈로그 sync는 그룹을 **모른다** — sync 원천에 target_source_id가
없으므로(위 제약) sync upsert는 이 컬럼을 건드리지 않는다. 학습된
멤버십은 DAG가 카탈로그에 살아 있는 한 유지된다(liveness 삭제 시
함께 삭제 — 삭제된 DAG는 그룹 화면에서도 빠지는 게 맞다).

이벤트 경로도 그룹을 모른다 — transport·소비 어느 쪽도
target_source_id를 알 필요가 없고, 그룹은 읽기 경로에서만 존재한다.
"발송·처리 시점에 그룹을 알기 어렵다"는 제약이 설계에 비용을
만들지 않는 이유다.

기각한 대안:

| 대안 | 기각 사유 |
|------|----------|
| 카탈로그 sync로 멤버십 선적재 | 불가 — target_source_id는 GET 전까지 알 수 없다(오너 확인). sync 원천에 없는 값은 실을 수 없다 |
| `dag_run_status` 행에 target_source_id 스탬핑 (소비 시점) | 처리 시점에 그룹을 알 수 없고(위 제약), 알 수 있더라도 소비 콜백마다 조회가 필요해 수집이 다른 시스템에 결합된다. 읽기 시점 해석이면 전부 불필요 |
| 별도 멤버십 join 테이블 | DAG당 그룹이 최대 1개(1:1×N:1)라 컬럼으로 충분. 테이블 분리는 학습·조회 양쪽에 join만 추가 |
| 그룹별 사전 집계(요약) 테이블 | 페이지 단위 read-time GROUP BY로 충분(위 주간 조회 결정과 동일). 집계 테이블은 갱신 시점·정합성 문제를 새로 만든다 |

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
    메시지는 버려진다. pull 구독 하나(보존 기본 7일, 최대 31일)로
    쌓아둔다.
  - 재처리: 파서 수정 후 DLQ에서 pull해 원 토픽에 재발행(멱등
    upsert라 중복 무해). 원본 보관이 없으므로 DLQ 보존을 넘긴
    메시지는 소실되지만, 화면 자체가 7일 창이라 수용한다(결정 사항).

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
9. **운영 MySQL 버전 확인**: upsert의 `VALUES ... AS new` 별칭
   구문은 8.0.19+, CHECK 강제는 8.0.16+. 8.0.19 미만이면 별칭 대신
   구식 `VALUES(col)` 함수 구문으로 대체한다.
10. **첫 GET의 멤버 목록 계약 확정**: 그룹 GET이 멤버 dag 목록을
    어떻게 알게 해주는지(요청에 id 목록 포함 vs 서버가
    target_source_id로 원천에 조회) 및 id의 형태(dag 이름 / 외부
    ID — `assignGroup`의 WHERE 키만 달라진다). 어느 쪽이든 "학습 후
    write-once 영속" 구조는 동일하다.
