# Pipeline — Task Model (TaskKind · 작성 규칙 · 멱등성 계약)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 상세 설계. **구현자가 가장 자주 보는 문서.**
> dispatch/poll 흐름·상태기계 전반은 [orchestrator-design.md](./orchestrator-design.md) 참조.

---

## 결정 2 — 작업 모델: 불변·버전 고정 Definition, 순차 task chain

> 흡수: 구 D3, D2의 snapshot/lifecycle, R3

PipelineDefinition은 파이프라인 type·provider별 **순차 task 시퀀스**를 기술하는 코드 정의
객체다. 병렬 분기 없는 versioned task sequence다.

PipelineDefinition: `key`(예: AWS_INSTALL), `version`(불변; v3과 v4는 별개 객체),
`type`(INSTALL|DELETE), `provider`, `taskDefinitions[]`.

> **[현행 Definition 모델은 [결정 7](./orchestrator-design.md) 정본]** 위 `PipelineDefinition`은
> **코드 default recipe**에 해당한다(`(type,provider)`당, release version). 실행 구성은 생성 시 불변
> snapshot으로 박제해 재현한다(재현=snapshot). 아래(불변성·박제 절)의 `lifecycle ACTIVE→DEPRECATED→RETIRED`는
> 결정 7.4로 **불요화**됐다(default=release 1개 + snapshot 이력). (TargetSource별 데이터 custom override는
> v2 defer — v2-deferred.md.)

```
AWS_INSTALL v3
 ├ TerraformApplyNetwork
 ├ TerraformApplyIntegration
 ├ InstallationReadyCheck
 └ FinalValidation
```

TaskDefinition은 **TaskKind 2종 중 하나**다 — 훅의 임의 조합을 일반화하지 않고(개정 4판), 실제
요구사항에 필요한 두 형태로 고정한다. 각 kind는 고정된 dispatch/poll 흐름을 가진다:

- **TERRAFORM_JOB** — `dispatch` → job_id 획득 → `poll` → terminal. Infra Manager run API를
  호출해 job_id를 받고(`attempt.response = {job_id}`), 그 job을 terminal까지 폴링한다. **BFF-visible
  active Terraform task 수를 N 이하로 admission 제어**하기 위해 공유 IM 동시성 slot(제약 #5)을
  소비한다(결정 4b).
- **CONDITION_CHECK** — dispatch 없음 → 조건 확인 반복 → MET. 외부 상태가 충족(MET)될 때까지
  폴링만 하는 WAIT_EXTERNAL task. dispatch가 없어 attempt도 없다.

```
TERRAFORM_JOB              CONDITION_CHECK
 dispatch                   (dispatch 없음)
   ↓ job_id 획득               ↓
 poll                       조건 확인 반복
   ↓                          ↓
 terminal                   MET
```

- **kind = 흐름 shape, handler_key = 구체 class.** reconciler는 `kind`로 *흐름*을 정하고(TERRAFORM_JOB은
  dispatch 후 poll · CONDITION_CHECK은 dispatch 없이 조건 폴링), **`task.handler_key`(안정 식별자, 예
  `aws.tf.network`)로 *어느 코드 class*를 호출할지 라우팅**한다 — 같은 kind 안의 여러 task(ApplyNetwork vs
  ApplyIntegration)를 가른다. `kind`는 handler class가 선언하는 값을 row에 비정규화(slot COUNT 쿼리용),
  `name`은 표시 라벨일 뿐. recipe(코드)가 task 생성 시 handler_key를 박는다.
- **handler 계약 (수동 레지스트리·중복 없음).** ① 각 handler는 **안정 `key()`를 선언**(클래스명과 무관 —
  rename해도 키 유지; 키 문자열의 단일 출처). ② 레지스트리는 **자동 수집**한다 — 모든 handler 빈을 주입받아
  `key()→handler` 맵을 부팅 시 파생(손으로 유지하는 목록 없음; 중복 키면 부팅 실패). ③ recipe는 handler를
  **문자열이 아니라 class로 참조**(컴파일 타임 안전 — 오타·없는 handler는 컴파일 에러), 저장되는 `handler_key`는
  `handler.key()`에서 파생. ④ **부팅 시** default recipe가 참조하는 모든 handler가 등록됐는지 검증(새 bad row
  차단). ⑤ **런타임에 `handler_key` 미해결**(이미 만들어진 옛 row의 handler가 은퇴/규율 위반)이면 task 즉시
  **FAILED(`HANDLER_NOT_FOUND`)** — 영구 조건이라 재시도 무의미, RUNNING TF의 in-flight job은 죽일 수 없어
  orphan으로 흡수(state-machine 종결표·결정 4 liveness). 구현 코드는 [implementation-notes.md](./implementation-notes.md).
  (Task는 in-place 수정 없이 `_V1/_V2` append-only로 관리 — `_V1` key가 영구 불변이라 옛 snapshot이 항상 resolve.)
- **새 task = 새 코드 class.** 대개 **기존 kind를 재사용**한다(예: 또 하나의 TERRAFORM_JOB task =
  TerraformApplyStorage class) — kind는 dispatch/poll *흐름 shape*이지 task마다 하나씩 늘리는 게 아니다.
  **genuinely 새로운 흐름 shape가 필요할 때만 새 kind를 추가**한다. 임의 훅 조합·`requiresSlot`·
  `completionRule`·`timeoutPolicy` 같은 일반화 슬롯이나 별도 operation catalog 레이어는 두지 않는다
  (개정 4판; YAGNI) — slot 소비 여부는 kind에서 정해지고(TERRAFORM_JOB만 소비), 완료 판정은 kind별 poll
  코드 안에 있다. 어느 쪽이든 **코드 class 추가**일 뿐 스키마·전이 무변경. (비-terraform 비동기 job kind
  (구 GENERAL_JOB)는 v2 defer — v2-deferred.md.)
- **connector / callStrategy / resourcePool 추상화 레이어는 도입하지 않는다(YAGNI)** — 두 번째
  capacity-limited backend가 실재할 때 additive로 확장한다.

조건 전용 task(CONDITION_CHECK)에서 **"아직"은 실패가 아니다** — check API 에러만 fail_count를 올린다.

> **terminal 스냅샷 캡처(구 postCheck)는 v2 defer — v2-deferred.md.** v1 task는 성공 관측으로 DONE이 되며,
> 휘발성 로그·결과 본문을 별도 캡처하지 않는다(완료 여부·시각은 CHECK 관측에 보존). **v1엔 `task_check.detail`
> 컬럼이 없다** — v2 postCheck 도입 시 additive로 추가한다.

**입력 — 범용 실행 컨텍스트를 두지 않는다(개정 4판).** `TaskExecutionContext{input, attempt?}` 추상은
제거한다. 상태기계는 범용 실행 컨텍스트를 쓰지 않으며, task는 두 가지만 사용한다:

- `pipeline.target_source_id` — 실행 단위(생성 시 고정).
- `task_attempt.response(jsonb)` — dispatch 원응답. TERRAFORM_JOB이면 `{job_id}`. poll은 여기서
  폴링 대상 handle을 추출한다.

CONDITION_CHECK은 dispatch가 없어 response가 없고 `target_source_id`만으로 조건을 평가한다.
TERRAFORM_JOB의 poll은 자기 attempt의 response에서 handle을 꺼내 폴링한다. 범용 입력 객체가
없으므로 각 task 코드는 자기 kind가 필요로 하는 값만 직접 읽는다.

**attempt : external handle = 1 : 1 (task_check는 그 handle을 N번 관측 → 1 : N).** 모든 dispatch는
단수 handle을 반환한다(terraform = 요청당 1 job_id) — **attempt 1개 = dispatch action 1회 = external
handle 1개**다. 그 단일 handle은 terminal에 도달할 때까지 30~60초마다 **반복 폴링**되므로 한 attempt
아래 **task_check 행은 N개**다(폴링 호출마다 1행; task_check = 외부 호출 또는 로컬 평가 1회 = 1행).
정리하면 **attempt : handle = 1:1, attempt : task_check = 1:N** — handle이 1:1이지 check가 1:1이 아니다.
**task success = reconciler가 그 단일 handle의 최신 poll 결과를 완료(DONE)/진행(PENDING)/실패(FAILED)로
판정**: DONE이면 task DONE, FAILED면 fail_count 정책, PENDING이면 계속 폴링. 한 dispatch가 분리 불가한
N개 id를 원자적으로 내는 fan-out(attempt 1개가 handle 여러 개)은 실재하지 않으며, 독립적인 여러
작업이 필요하면 task를 나눠 표현한다(결정 5 기조).

불변성과 박제: 모든 행동·정책 변경은 새 버전을 만든다. Pipeline은 생성 시 버전에 고정되고 전체
정의가 pipeline_def_snapshot으로 직렬화된다. **코드 정의가 실행 권위, 스냅샷이 히스토리 권위.**
정의·snapshot은 물리 삭제되지 않는다(히스토리 권위). ~~lifecycle ACTIVE → DEPRECATED → RETIRED~~ —
**결정 7.4로 불요화**: default=코드 release 1개 · 이력은 snapshot이 보유하므로 다중 버전 공존
lifecycle이 필요 없다.

**실행 단위는 `target_source_id`로 고정한다(개정 4판).** 실행 입력 일반화(`pipeline.parameters`
jsonb)는 도입하지 않는다 — pipeline은 `target_source_id` 컬럼 하나를 갖고 그것이 실행 단위다(생성
시 고정, run 중 불변이라 재시도/재실행이 결정적). dispatch/poll은 `pipeline.target_source_id`를
직접 읽는다.

> **실행 단위 = `target_source_id`(1 pipeline : 1 target)** 이며, target 묶기(1:N)는 의도가 아니다
> (N개 target이면 N개 pipeline — 재시도가 run 단위, 히스토리가 target별이라는 결정 5 기조와 정합).
> 실행 입력 일반화는 도입하지 않으므로(개정 4판) 단위가 바뀌면 그때 모델을 확장한다 — 지금은
> target source 하나로 고정한다. **(O22 해소 — 결정 2에 흡수.)**

**task 간 값 전달은 하지 않는다(현재 요구사항 밖).** (A) **handle 참조**는 모델에 내재한다 —
dispatch가 낸 handle은 `attempt.response`에 보존되고, poll이 그걸 폴링하며
`task_check.external_handle`(확인한 id)이 response의 id와 매칭되어 연결된다. (B) **handle 외
산출(생성 리소스 ID·응답값)의 task→task 전파는 하지 않는다** — 현재 task chain은 그런 BFF 레벨 값
전달을 하지 않는다(terraform이 자체 state로 리소스 간 의존을 해결). 값 전달 task가 실재하면 그때
모델을 확장한다(additive).

폴링 cadence는 두 개, guard는 하나: ≥10분 관리자 조정형 guard는 **WAIT_EXTERNAL 조건 확인에만**
적용된다. TerraformJob 상태 폴링은 시스템 설정(Part II)이며 task별 노출하지 않는다.

---


---

## 멱등성 계약 (task 작성 필수)

모든 dispatch task는 멱등이어야 한다 — 근거는 [orchestrator-design 결정 3.1](./orchestrator-design.md). 요약:

- **중복 dispatch 안전** — worker dedup이 없으므로 중복 제출돼도 인프라가 손상되지 않아야 한다.
- **이미-원하는-상태 = 성공** — INSTALL 이미 존재=성공, DELETE 이미 부재=성공(DELETE not-found 함정 주의).
- **BFF는 검증이 아니라 요구한다** — job_id 발급·폴링하는 dispatch의 멱등 보장은 task 등록 계약이며, 비멱등 작업은 리뷰에서 거부된다.

## 금지 (개정 4판)

- **비멱등 task** (위 계약 위반)
- **fan-out handle** — 한 dispatch가 handle 여러 개 반환 금지(attempt:handle = 1:1, attempt:task_check = 1:N 폴링)
- **task 간 값 전달** — task는 pipeline.target_source_id 와 task_attempt.response 만 사용
