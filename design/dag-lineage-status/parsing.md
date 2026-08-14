# Lineage 이벤트 파싱 로직

## 입력 형태

Pull 구독이므로 push 구독과 달리 메시지가 base64로 래핑되어 있지
않다. `PubsubMessage.data`가 OpenLineage **RunEvent JSON 원문**
그대로다. transport에서 DAG-only
+ 이름 prefix 필터를 통과한 이벤트만 도착하지만, 소비 쪽 파싱은 그
가정에 기대지 않는다(아래 방어 참조).

**논리 DB ID(`logical_database_id`)는 이벤트에 없다** — 파싱 대상이
아니고, **저장 시점에 API로 조회하지도 않는다**. 이름→논리 DB는
수집 흐름과 분리된 카탈로그 sync + `dag_registry` 테이블이 담당하고
(architecture.md 참조), 주간 조회가 카탈로그 페이지에서 함께 읽는다.

## 추출 필드 (8개)

| 필드 | JSON 경로 | 용도 | 필수 | 결측 시 |
|------|-----------|------|------|---------|
| eventType | `/eventType` | 상태 매핑 | ✔ | nack → DLQ |
| eventTime | `/eventTime` | 상태 갱신 순서 판정 (도착 순서 대신) | ✔ | nack → DLQ |
| namespace | `/job/namespace` | Composer 환경 식별 | ✔ | nack → DLQ |
| dag_id | `/job/name` | DAG 식별 | ✔ | nack → DLQ |
| jobType | `/job/facets/jobType/jobType` | task 이벤트 2차 방어 | — | 없으면 DAG로 간주 |
| runId | `/run/runId` | run 단위 상태 병합 키 (START·종료 이벤트 동일 UUID) | ✔ | nack → DLQ |
| logical_date | `/run/facets/airflowDagRun/dagRun/logical_date` | 날짜 버킷 키 | ✔ (fallback 있음) | fallback 후에도 없으면 nack |
| run_type | `/run/facets/airflowDagRun/dagRun/run_type` | scheduled/manual 구분 | — | null 저장 |

`logical_date` fallback 체인:
`airflowDagRun.dagRun.logical_date` → `nominalTime.nominalStartTime`.
provider 버전에 따라 facet 구성이 달라서 두 경로를 모두 선언해 둔다.

## DTO 전략 — 슬림 record + ignoreUnknown

전체 OpenLineage 스키마(또는 `openlineage-java`의 RunEvent)를 매핑하지
않는다. 이유:

- 쓰는 건 8개 필드뿐인데 전체 스키마와 특정 provider 버전에 결합된다.
- provider 업그레이드로 facet이 추가·변경돼도, 관심 경로만 선언한
  record + `@JsonIgnoreProperties(ignoreUnknown = true)`는 깨지지
  않는다.

대신 관심 필드는 전부 **타입으로 선언**한다 (`LineageEvent.java`):

- 필수 필드 null 검증이 경계(구독 콜백)에서 일어난다. malformed
  이벤트는 upsert까지 흘러가지 못하고 DLQ로 빠진다.
- `eventTime`, `logical_date`가 `OffsetDateTime`으로 들어오므로
  이후 로직에 문자열 비교 함정이 없다.

## eventType → 상태 매핑

| eventType | 저장 상태 | 비고 |
|-----------|----------|------|
| START | RUNNING | DagRun running (스케줄 시작) |
| COMPLETE | SUCCESS | |
| FAIL, ABORT | FAILED | |
| 그 외 (RUNNING, OTHER 등 스펙상 존재) | ack 후 무시 | 상태 변화 없음. nack하면 DLQ가 노이즈로 참 |

transport 필터가 뚫려 task 이벤트가 섞여 들어오는 경우(`job.name`이
`dag_id.task_id` 형태)는 소비 쪽에서도 jobType facet으로 한 번 더
거른다(2차 방어): `DAG`가 아니면 ack 후 버린다. facet이 없으면
DAG로 간주해 통과시킨다(구버전 provider 호환). 2차 방어가 있어도
불필요한 볼륨은 그대로 유입되므로, 필터 고장 자체는 유입량 알람으로
감지해야 한다.

## 실패 경로

```
파싱 불가 / 필수 필드 결측  → 예외 → nack → 재전송(백오프)
                              → max delivery attempts(5) 소진 → DLQ
DB 일시 장애                → 동일 (재전송이 곧 재시도 큐)
DAG가 아닌 jobType          → ack (2차 방어, 의도적 무시)
알 수 없는 eventType        → ack (의도적 무시)
```

예외를 try/except로 무시한 채 ack하지 말 것 — 데이터가 경고 없이 유실된다.

## 순서·중복 처리 (파싱이 아니라 upsert가 담당)

파서는 이벤트를 정렬하지 않는다. 멱등성은 upsert의 컬럼별 가드가 담당
(MySQL — 대입 순서 등 상세는 architecture.md 저장 모델 참조):

```sql
ON DUPLICATE KEY UPDATE
    status     = IF(new.event_time > event_time, new.status, status),
    ...
    event_time = IF(new.event_time > event_time, new.event_time, event_time)
```

- 중복 재전송: 같은 event_time → no-op
- 역순 도착(종료 이벤트 먼저): 늦게 온 START가 더 오래됨 → 탈락
- clear 후 재실행: 새 START가 더 나중 → RUNNING 복귀 (의도된 동작)

## 착수 전 확인

문서의 facet 경로는 provider 버전 종속이다. 확정 절차:

1. 대상 Composer에서 console transport로 DAG 수준 이벤트 1건을
   캡처한다.
2. 위 표의 JSON 경로와 대조하고, 다르면 `LineageEvent.java`의
   record 경로만 고친다 (소비 로직은 불변).
