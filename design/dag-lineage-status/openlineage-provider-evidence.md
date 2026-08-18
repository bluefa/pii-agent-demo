# 근거: DAG / Task 이벤트 분기는 jobType facet이 맞다

transport `_is_dag_event()`가 기대는 가정 — "모든 이벤트에 `jobType` job
facet이 달리고, DAG 수준 이벤트만 값이 `DAG`다" — 를 OpenLineage facet
스펙과 `apache-airflow-providers-openlineage` 소스 원문으로 대조한
기록이다 (검증일 2026-08-18). Composer가 보내는 lineage 이벤트의 생산자가
이 provider이므로, provider의 adapter 소스가 곧 이벤트 모양의 진실이다.

## 대조 결과 — 구현 가정 4개 전부 일치

| # | 구현의 가정 (`transport/openlineage_pubsub_transport.py`) | Provider 소스 실제 | 판정 |
|---|---|---|---|
| 1 | facet 딕셔너리 키가 `"jobType"` | `facets.update({"jobType": job_type_job.JobTypeJobFacet(...)})` | ✔ |
| 2 | facet 객체 속성명이 `jobType` (camelCase) | `JobTypeJobFacet(jobType=job_type, integration="AIRFLOW", processingType="BATCH", producer=_PRODUCER)` | ✔ |
| 3 | DAG 이벤트의 값은 정확히 `"DAG"` | `_JOB_TYPE_DAG: Literal["DAG"] = "DAG"` / `_JOB_TYPE_TASK: Literal["TASK"] = "TASK"` — strict `== "DAG"` 비교가 옳다 | ✔ |
| 4 | 모든 이벤트에 facet이 달린다 (없으면 드롭해도 안전) | `_build_job()`이 **무조건** 붙인다 — 조건부 아님. DAG·task 이벤트 공통 | ✔ |

OpenLineage 스펙 쪽도 같다: facet 키 `jobType`, 필드
`processingType`(BATCH/STREAMING/SERVICE) · `integration`(AIRFLOW 등) ·
`jobType`(DAG, TASK, QUERY, …). Airflow는 `processingType=BATCH`,
`jobType=DAG|TASK`를 쓴다.

## 부수 확인 2건

**eventType 매핑** — adapter의 DAG 수준 emit 3종이 parsing.md의 상태
매핑과 일치한다:

| adapter 메서드 | eventType | parsing.md 저장 상태 |
|---|---|---|
| `dag_started` | `START` | RUNNING |
| `dag_success` | `COMPLETE` | SUCCESS |
| `dag_failed` | `FAIL` | FAILED |

**job.name 형태** — DAG 이벤트는 `dag_id`, task 이벤트는
`dag_id.task_id`. 따라서 **task 이벤트의 이름도 DAG prefix로 시작한다**
(`pii_x.task_y`는 `pii_` 매치). prefix 필터만으로는 task 이벤트를 못
거르고, jobType 검사가 하중을 받는 필터다 — emit()에서 jobType을 먼저
검사하는 현재 순서가 옳다.

## 소비 측 2차 방어 (`LineageEvent.isDagEvent()`)도 일치

발송 측만이 아니라 소비 측 검사도 같은 소스와 대조했다. 세 갈래 모두
정확하다:

| 갈래 | 검증 결과 |
|---|---|
| JSON 경로 바인딩 | provider가 내보내는 JSON은 `/job/facets/jobType/jobType`(바깥은 facet 키, 안쪽은 필드명, 둘 다 camelCase). record 체인 `Job → JobFacets(jobType) → JobTypeFacet(jobType)`의 컴포넌트 이름이 정확히 일치해 `@JsonProperty` 없이 바인딩된다 | ✔ |
| 값 비교 | `"DAG".equals(...)`는 상수 선행이라 null 안전. task 이벤트(`"TASK"`)는 false → ack 후 폐기. facet 키는 있는데 안쪽 값이 null인 기형도 false로 버려진다 — provider는 `Literal`로 값을 박으므로 실제로는 나올 수 없고, 나와도 버리는 쪽이 안전 | ✔ |
| facet 결측 시 통과(`return true`) | transport는 결측=드롭(strict), consumer는 통과(lenient)로 **의도된 비대칭**. facet을 안 다는 provider의 이벤트는 발송 측 필터를 못 넘어 여기 도달할 수 없으므로, 판단 불가능한 결함만으로 nack해 DLQ를 채우지 않는다. 결측인 채 통과한 이벤트도 곧바로 `toRow()` 경계 검증(databaseUri 필수)에 걸려 DLQ로 간다 — 조용히 upsert되는 경로는 없다 | ✔ |

provider ≥ 1.6.0에서는 모든 이벤트에 facet이 무조건 달리므로, 결측
분기는 실제 Composer 이벤트에서는 절대 타지 않는다. 순수하게 "계약이
깨진 페이로드를 어떻게 다룰 것인가"의 방어선이다.

## 단서: 버전 하한 provider ≥ 1.6.0

jobType facet은 provider **1.6.0 (2024-03-08, PR #37255)** 부터 붙는다.
그 미만이면 facet이 아예 없어서 strict 필터가 **전 이벤트를 드롭**한다 —
architecture.md 확인 필요 1번의 "이벤트 0건 + namespace별 유입량
알람으로만 감지" 고장 모드가 정확히 이 경우다. 요즘 Composer 이미지는
전부 이 버전을 한참 넘지만, 확인 필요 4번(버전 고정) 검증 때 이 숫자를
하한으로 쓴다.

1.10.0의 V2 facet 마이그레이션(#39530) 이후에도 속성명은 camelCase
`jobType` 그대로다 — `getattr(job_type, "jobType", None)`은 V1/V2 어느
쪽 facet 클래스에서도 동작한다.

## 출처

- [OpenLineage — JobType job facet 스펙](https://openlineage.io/docs/spec/facets/job-facets/job-type)
- [`airflow.providers.openlineage.plugins.adapter` 소스](https://airflow.apache.org/docs/apache-airflow-providers-openlineage/stable/_modules/airflow/providers/openlineage/plugins/adapter.html)
- [apache-airflow-providers-openlineage changelog](https://airflow.apache.org/docs/apache-airflow-providers-openlineage/stable/changelog.html)
