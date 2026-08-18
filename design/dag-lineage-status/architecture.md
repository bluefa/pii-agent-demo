# DAG 주간 상태 현황판 — 아키텍처

멀티 Composer 환경의 DAG 실행 상태를 OpenLineage 이벤트로 수집해,
논리 DB별 최근 7일 상태를 준실시간으로 제공하는 시스템.

## 용어

| 용어 | 뜻 |
|------|-----|
| **Monitoring Manager** | 이 문서가 설계하는 서버. 이벤트를 수집·저장하고 주간 상태를 응답한다 |
| **Pipeline Manager** | 상류. `dagName` → `databaseUri` 단건 조회 |
| **Infra Manager** | 상류. `targetSourceId` → databaseUri 목록 |
| **databaseUri** | 논리 DB 식별자. 화면 행의 키 |
| **target source** | 논리 DB의 묶음. 조회 요청의 키(`targetSourceId`, long) |
| **dag name** | Airflow의 dag id. 이름 ↔ 논리 DB는 1:1 불변 |

## 요구사항

- Composer 환경 여러 개, 대상 DAG 약 10만 개, DAG당 task 약 11개, 365일 매일 실행
- 준실시간에 가까운 상태 반영
- DAG 단위(task 아님) 라이프사이클: 스케줄 시작 / 성공 / 실패
- **기존 OpenLineage transport가 이미 존재** — 건드리지 않고 공존해야 함
- 이번 transport는 **DAG 이름이 특정 prefix로 시작하는 DAG만** 지정
  Pub/Sub topic으로 보냄
- **DAG 이름은 환경 간 전역 유니크** (오너 확인)
- **상류 서버 2개** (오너 확인):
  | 서버 | 답해주는 것 | 제약 |
  |------|------------|------|
  | **Pipeline Manager** | `dagName` → `databaseUri`(논리 DB). 1:1 불변 | **단건만.** 역방향(`databaseUri` → `dagName`) 없음, 벌크 없음. 50 병렬까지 허용 |
  | **Infra Manager** | `targetSourceId` → 그 target source의 databaseUri 목록 | 20x일 때만 유효. **페이징 없음** — 1만 건을 한 응답에 준다 |
- `databaseUri` 최대 길이 **1024** (가정 확정)
- 주간 화면:
  1. 최근 7일간 1회 이상 성공 여부 + 성공 시각
  2. 날짜별 상태: 성공 > 동작중 > 실패 > 스케줄 안 됨
- **조회 진입점은 target source 단위 하나뿐**: 요청 키는
  `targetSourceId`(long). Monitoring Manager가 Infra Manager를 호출해
  20x면, 그 응답의 **databaseUri 각각에 대해** 주간 종합 + 일자별
  결과를 돌려준다. target source 하나가 논리 DB 최대 1만 개를 가진다
  (논리 DB 1개 = DAG 1개).
- **관계의 성질** (오너 확인): `databaseUri → targetSourceId`는
  **불변**이다. 그러나 `targetSourceId → databaseUri 목록`은
  **변한다** — 논리 DB가 실제로 사라질 수 있다. 그래서 멤버 목록이
  확정되는 시점은 **매 GET의 Infra Manager 응답**뿐이다.

## 결정 사항 (오너 확정)

- **manual/backfill 실행의 성공도 그날의 '성공'으로 인정** — 화면의
  질문이 "그날 일이 됐는가"이므로. run_type은 저장만 하고 집계
  필터로 쓰지 않는다.
- **DAG 이름은 환경 간 전역 유니크** — 조회 키는 dag_name 단독.
- **화면 목록의 진실 원천은 Infra Manager 응답이다** — 우리 DB가
  아니다. 응답의 databaseUri 하나가 화면의 행 하나이고, 우리는 그 행을
  채우기만 한다.
- **lineage 이벤트 원본은 보존하지 않는다** — 보존 요구사항이
  없다. BigQuery export 없음, `dag_run_status`도 7일 창을 지나면
  삭제. 대가: 과거 재계산 수단이 없다(아래 Pub/Sub 절 참조).
- **저장은 기존 운영 MySQL 8** — Postgres 전환은 불가(운영 DB 기정).
- **그룹 멤버십은 저장하지 않는다** — 목록이 변할 수 있고 Infra
  Manager는 매 요청 호출해야 하므로(20x가 곧 존재 확인), 저장분은
  사라진 논리 DB가 남아 있는 상위집합일 뿐이다. `target_source_id`
  컬럼도, join 테이블도, 그룹별 사전 집계 테이블도 두지 않는다.
- **우리가 저장하는 유일한 상류 사실은 `dagName → databaseUri`다**
  (`dag_database_uri`) — 역방향 조회가 없어서 역방향 맵을 우리가
  들고 있어야 하기 때문이다. **그 이름의 원천은 이벤트다** — 벌크
  목록 API가 없으니 이름을 먼저 알아야 물어볼 수 있다.

## 전체 구조

수집과 조회가 서로를 기다리지 않는다. 수집은 상류 서버를 전혀
호출하지 않고, 조회는 상류 서버 2개를 호출한다.

```
[수집]
Composer env A ─┐  composite transport = 기존 transport + PubSubTransport
Composer env B ─┼─▶ Pub/Sub topic ─┬─▶ pull 구독 ─▶ Monitoring Manager (GKE)
Composer env N ─┘  (DAG-only+prefix)│                parse → 멱등 upsert
                                    │                  │            │
                                    │                  ▼            ▼
                                    │         dag_run_status   dag_database_uri
                                    │                          (이름만, uri는 NULL)
                                    └─▶ dead-letter topic (max delivery attempts 5)

[resolver — 수집 스레드 밖, 비동기]
   신규 이름(첫 이벤트) ──즉시 제출──┐
   미해결 이름 (스윕, 5분)  ─────────┴─단건 조회─▶ Pipeline Manager (dagName → uri)

[조회]  GET(targetSourceId)
          │
          ├─▶ Infra Manager ──20x──▶ databaseUri 목록 (최대 1만)
          │                              └─ 페이지 슬라이스(예: 100)
          │                                        │
          ├─▶ dag_database_uri  WHERE database_uri IN (…) → dag_name 역변환
          │                                        │
          └─▶ dag_run_status    7일 집계 (dag_id, logical_date)
                                                   ▼
             databaseUri별 주간 종합 + 일자별 (매핑 없으면 7일 전부 '스케줄 안 됨')
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

### 이름 ↔ databaseUri 매핑 (dag_database_uri)

`dag_database_uri`는 **역방향 맵 하나만 담는 테이블**이다. 행 하나가
DAG 하나이고, 컬럼은 DAG 이름 · databaseUri · 시도 횟수 · 시각뿐이다.
그룹 컬럼은 없다.

이 테이블이 존재하는 이유는 **Pipeline Manager의 제약** 하나다:
`dagName → databaseUri` 단방향, 단건. 그런데 그룹 조회는 손에
databaseUri를 들고 시작해서 이름으로 되돌아가야 한다. 역방향을
물어볼 데가 없으니 우리가 들고 있는다.

**이름의 원천은 이벤트다.** 벌크 목록 API가 없어서 "존재하는 DAG
전체"를 받아올 방법이 없고, 단건 조회는 이름을 이미 알아야 쓸 수
있다. 그 이름을 유일하게 알려주는 게 이벤트다.

**그래도 이벤트 저장 시점에 API를 호출하지는 않는다.** 소비 콜백은
`dag_run_status` upsert와 `INSERT IGNORE INTO dag_database_uri
(dag_name)` — 로컬 쓰기 둘뿐이다. 해석은 뒤에서 따로 한다. 얻는 것:

- 수집 ack가 Pipeline Manager 가용성에 종속되지 않는다
- 자정 폭주(최악 ~330건/s)가 상류로 전파되지 않는다 — 하루 20만 건의
  조회가 통째로 사라진다
- 캐시·재시도·타임아웃 같은 부수 장치가 수집 경로에 필요 없다

채우고 쓰는 방식:

1. **seed (수집 경로)**: 이벤트를 소비할 때마다 이름을 `INSERT
   IGNORE`. 이미 있으면 no-op이라 사실상 신규 DAG에서만 행이 는다.
   **삽입이 실제로 일어난 경우에만**(= 그 DAG의 첫 이벤트) 다음 단계를
   깨운다. 이 조건이 없으면 이벤트마다 상류를 두드리게 된다.
2. **resolve (`DatabaseUriResolver.resolveNow`, 비동기)**: seed가 새
   이름을 만든 그 자리에서 조회를 **풀에 제출**한다. 제출은 블로킹이
   아니므로 ack가 기다리지 않고, 해석은 상류 호출 1건 시간 안에
   끝난다. 실패해도 소비자에게 되돌리지 않는다 — 행은 이미 있고 3번이
   줍는다.
3. **스윕 (`resolvePending`, 기본 5분)**: 2번이 끝내지 못한 이름만
   담당한다 — 상류 장애, ack와 resolve 사이의 프로세스 재시작, 그리고
   **이 기능 이전부터 존재하던 DAG**. `database_uri IS NULL`인 이름을
   골라 단건 호출을 **50 병렬**로(오너 확인 한도) 한 주기 최대
   2000건까지 시도하므로, 밀린 10만 건은 (건수/2000) 주기에 걸쳐
   빠진다. 매핑이 1:1 불변이라 **DAG 하나당 평생 1회**다. 실패는
   `attempts`를 올리고 재시도하되 상한(기본 5회)을 넘으면 멈춘다 —
   상류가 영영 모르는 이름을 매 주기 두드리지 않기 위해서다. 정상
   상태에선 이 스윕이 아무것도 찾지 못한다. 주기가 느린 이유다.
4. **조회 (읽기 경로)**: 그룹 조회가 Infra Manager에게 받은 페이지의
   databaseUri들을 `IN (…)`으로 이름으로 되돌린다. IN 목록은 페이지
   크기(예: 100)에 묶이므로 1만 개가 한 번에 들어가지 않는다.

**이벤트가 0건인 DAG는 이 테이블에 없다 — 그래도 화면은 정확하다.**
화면의 행은 이제 DAG가 아니라 **databaseUri**이고, 그 목록은 Infra
Manager가 준다. 매핑이 없는 databaseUri는 "그 논리 DB의 DAG가 한 번도
돌지 않았다"는 뜻이므로 **7일 전부 '스케줄 안 됨'**이 정답이다.
이름을 몰라도 답이 나오므로, 맵은 실제로 돌았던 DAG만 덮으면 충분하다.

> **이전 결정 뒤집힘**: 앞선 리뷰(C3/M2)에서 "이벤트에서 목록 유도 +
> 미해석 이름만 단건 조회(reconciler)"를 기각했었다. 기각 사유는
> *이벤트 0건 DAG가 화면에서 사라진다*였는데, 목록 축이 우리 DB에서
> **Infra Manager로 옮겨간 지금은 그 부작용이 없다**. 그래서 그 구조를
> 다시 채택한다.

기각한 대안:

| 대안 | 기각 사유 |
|------|----------|
| 전체 목록을 주기 sync해 로컬 목록 유지 | 불가 — 벌크/목록 조회가 없다(오너 확인). 단건 조회는 이름을 이미 알아야 쓸 수 있다 |
| 매 조회마다 Pipeline Manager로 역변환 | 불가 — 역방향 조회가 없다. 있더라도 단건뿐이라 페이지당 100콜 |
| transport에서 이벤트마다 API 조회 후 첨부 | 스케줄러 경로에 외부 호출 삽입, N개 환경 각각 캐시 필요, 이벤트 스키마 오염 |
| 각 DAG 안에서 매일 자기 ID 조회 | 정적 매핑에 10만 × 365 호출. Composer가 API에 접근할 수 있다는 이유만으로 채택할 근거가 되지 않음 |
| Spring 소비 콜백에서 인라인 조회 | ack 경로가 상류 가용성에 종속 — 자정 폭주가 상류로 전파되고, 상류 장애가 수집 정체로 역전파 |

### 주간 조회 (읽기 시점 집계)

- **목록·페이지네이션 축은 Infra Manager 응답** (databaseUri 순).
  매핑이 없는 databaseUri도 "7일 내내 스케줄 안 됨"으로 표시된다.
- 날짜 버킷은 **이벤트 시각이 아니라 `logical_date`의 KST 날짜**.
  자정 넘겨 끝나는 run이 이틀에 걸치지 않는다.
- 날짜별 상태 우선순위: SUCCESS > RUNNING > FAILED, 행 없음 →
  NOT_SCHEDULED. (실패 후 재실행 중이면 "동작중"으로 보인다.)
- manual/backfill 성공도 그날의 성공으로 집계한다 (결정 사항 참조).
- "주간 1회 이상 성공"의 성공 시각은 **가장 최근 성공**의
  eventTime을 쓴다.
- 응답의 키는 databaseUri다(항상 존재). dag 이름은 매핑이 아직 없으면
  null이고, namespace는 창 안에 이벤트가 없으면 null이다.
- 주 70만 행 인덱스 스캔이라 사전 집계 테이블 없이 읽기 시점
  GROUP BY로 충분하다.

### 그룹(Target Source) 단위 조회

그룹 하나가 논리 DB 최대 1만 개를 가진다. 우려는 "매 요청마다 멤버
N개를 불러와서 N개를 조회"하는 부하인데, **멤버십을 저장해서 푸는
문제가 아니다.** 목록은 변할 수 있고 Infra Manager는 어차피 매 요청
불러야 하므로(20x가 곧 존재 확인), 우리가 저장한 멤버십은 사라진
논리 DB가 남은 상위집합이 될 뿐이다 — 정확성에 보태는 게 없다.

대신 **페이지 밖으로 새는 비용을 없앤다**:

1. **Infra Manager 호출 1회** — 그 target source의 databaseUri 목록.
   20x가 아니면 조회 실패로 반환한다(빈 목록이 아니다 — 장애를
   "논리 DB 없음"으로 위장하면 안 된다).
2. **페이지로 자른다** (예: 100) — 이후 단계는 전부 페이지 크기에만
   비례한다. 1만 개를 IN절에 되던지는 단계가 없다.
3. **이름 역변환** — `dag_database_uri`를 `database_uri IN (…)`으로
   조회. 페이지에 없는 uri는 애초에 묻지 않는다.
4. **집계는 기존 주간 조회와 동일 경로** — 그 페이지의 dag 이름으로만
   `dag_run_status`를 `(dag_id, logical_date)` 인덱스로 읽는다. 그룹
   전용 집계 테이블이 필요 없다.

남는 비용은 **DB가 아니라 Infra Manager 응답 크기**다. **페이징이
없으므로**(오너 확인) 한 번 부르면 1만 건이 통째로 오고, URI가 최대
1KB이니 최악 ~10MB다. 페이지를 넘길 때마다 이걸 다시 받으면 안 되므로
`targetSourceId`별 **60초 TTL 인메모리 캐시**를 둔다. 목록이 변할 수
있지만 **변화를 감지할 수단이 우리에게 없으므로 TTL만으로 충분하다** —
최대 지연이 곧 TTL이고, 무효화 로직은 필요 없다. **실패는 캐시하지
않는다** — 장애가 stale 목록으로 위장되면 안 된다.

**resolve 지연 창**: 이름이 아직 해석되지 않은 DAG는 그동안 그룹
화면에서 "실행 이력 없음"으로 보인다. 어느 databaseUri가 그 DAG의
것인지 모르니 행 단위로 "확인 중"을 표시할 방법도 없다(그게 바로
역방향이 없다는 뜻이다). 정상 상태에선 이 창이 상류 호출 1건 길이다 —
첫 이벤트가 그 자리에서 조회를 제출하기 때문이고, 스윕 주기(5분)는
여기에 관여하지 않는다. 창이 길어지는 경우는 둘뿐이다: 상류 장애로
`resolveNow`가 실패했을 때, 그리고 **도입 시점에 이미 존재하던
DAG들** — 이들은 각자 다음 실행 때까지 이름이 도착하지 않으므로,
전체가 채워지는 데 걸리는 시간은 resolver 속도가 아니라 **DAG 스케줄
주기**가 정한다(하루 1회면 최대 하루). 미해결 건수는 알람 대상이다
(운영 절).

이벤트 경로는 그룹을 **모른다** — transport·소비 어느 쪽도
`targetSourceId`를 알 필요가 없고, 그룹은 읽기 경로에만 존재한다.
"발송·처리 시점에 그룹을 알기 어렵다"는 제약이 설계에 비용을 만들지
않는 이유다.

기각한 대안:

| 대안 | 기각 사유 |
|------|----------|
| 멤버십(`target_source_id`)을 우리 DB에 저장 | 목록이 변한다(논리 DB 소멸). Infra Manager를 어차피 매 요청 부르므로 저장분은 stale 상위집합일 뿐이고, 사라진 논리 DB가 화면에 남는다 |
| `dag_run_status` 행에 target_source_id 스탬핑 (소비 시점) | 처리 시점에 그룹을 알 수 없고, 알더라도 소비 콜백마다 조회가 필요해 수집이 다른 시스템에 결합된다. 읽기 시점 해석이면 전부 불필요 |
| 별도 멤버십 join 테이블 | 위와 동일한 stale 문제 + join 추가. 멤버십은 애초에 우리 사실이 아니다 |
| 그룹별 사전 집계(요약) 테이블 | 페이지 단위 read-time GROUP BY로 충분(위 주간 조회 결정과 동일). 집계 테이블은 갱신 시점·정합성 문제를 새로 만든다 |
| 전역(비그룹) 주간 보드 유지 | 진입점이 target source 단위 하나뿐이고, 전역 목록의 원천이 사라졌다(벌크 목록 API 없음). 필요해지면 "이벤트가 있었던 DAG"를 축으로 되살린다 |

## 운영

- **파이프라인 자체 모니터링(필수)**: 어느 환경의 transport 장애가
  감지되지 않은 채 지속되면 그 환경 전체가 "스케줄 안 됨"으로 보인다. namespace별
  이벤트 유입량 급감 알람 + 구독 oldest-unacked-message-age 알람.
- 파싱 실패는 nack → 재전송(백오프) → DLQ. DLQ 적재량에도 알람.
- **미해결 이름 알람**: `database_uri IS NULL` 건수가 줄지 않으면 그
  DAG들이 그룹 화면에서 조용히 "실행 이력 없음"으로 보인다. 건수와
  `attempts` 상한 도달 건수에 알람을 건다.
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
5. **Pipeline Manager 단건 호출의 지연·타임아웃**: 병렬 50은 확정
   됐지만(오너), 호출 1건의 지연이 곧 정상 상태의 resolve 지연 창이다.
   또 그 값을 모르면 스윕 한 주기(5분) 안에 2000건이 실제로 끝나는지
   알 수 없다. 100ms면 4초, 1s면 40초다. 실측 후 `batch-size`와
   타임아웃을 확정한다.
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
10. **Infra Manager 응답의 실제 크기와 타임아웃**: 페이징이 없다는
    것은 확정됐다(오너). 1만 건 × 최대 1KB = ~10MB 응답을 실제로 받아
    보고 HTTP 타임아웃·메모리 여유를 확인한다. TTL 60초가 화면 조작
    속도에 맞는지도 함께 본다.
11. **비-20x 응답의 의미 확정**: 현재 설계는 조회 실패로 반환한다(빈
    목록과 구분). 404가 "target source 없음"을 뜻한다면 그것만 빈
    화면으로 분기할지 정해야 한다.
12. **resolve 상한 도달 시 운영**: `attempts`가 상한(기본 5)에 닿은
    이름은 재시도가 멈춘다. 상류가 뒤늦게 등록하는 경우를 대비해
    상한 도달 건수 알람 + 수동 리셋(`UPDATE ... SET attempts = 0`)
    절차를 둔다.
