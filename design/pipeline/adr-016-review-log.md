# ADR-016 리뷰 로그 (codex + opus) — 문서군 정합성·정확성

> ADR-016 **문서군**(ADR 본문 + `design/pipeline/{orchestrator-design,state-machine,task-model,api,operations,requirements,migrations}`)에 대해 받은
> codex(gpt-5.5, xhigh)·opus 리뷰의 통합 정리. 정본 *변경* 이력은 [decision-history.md](./decision-history.md)(후속17~21),
> 본 파일은 **리뷰 점수·findings·해소 추적** 전용. 최신순.
>
> (HTML 가이드 `adr-016-guide.html`의 리뷰는 범위 밖 — git 이력 참조.)

---

## 0. 최종 상태 (2026-06-21)

| 항목 | 값 |
|---|---|
| **최신 ADR 점수** | **codex 89 / opus 92** (N/M/K rename 후 재리뷰) |
| **정합성 baseline** | codex 88 / opus 93 (후속20 최종 cross-file 검증) |
| **cross-file 모순** | **0** (전부 reconcile) |
| **구현 막는 significant** | **0** |
| **정확성/설계 회귀** | **0** (rename은 표기만; 전 fragile 개념 무손상) |

정합성 baseline은 **안정 확정**. 이후 변경(RLE 채택·rename)은 회귀 없이 적용됨.

---

## 1. ADR 점수 추이

```
[whole-doc 라운드, 직전 세션]
 r6  88/88 → r7  82/89 → r8  84/94 → r9  86/93 → r10 88/93
 r11 86/92 → r12 88/89 → r13 84/92 → r14 84/92 → r15 84/88
   (codex 82~88 박스권 / opus 88~94 — 라운드마다 소수 신규 표면)
[방법 전환]
 후속18  6섹션 전담 리뷰   → 안정영역 D/E/F significant 0 · 복잡영역 A/B/C 잔재 소탕
 후속19  파일별 병렬 fix    → ~28 genuine fixes + cross-agent reconcile
 후속20  최종 cross-file    → codex 88 / opus 93 · 모순 0 (baseline 확정)
[이번 세션]
 RLE 채택(후속17)          → 회귀 없이 반영
 N/M/K rename 재리뷰        → codex 88→89 / opus 93→92 · 회귀 0
```

---

## 2. N/M/K rename 재리뷰 (최신) — codex 89 / opus 92

**대상**: `M→workerPoolSize · N/N-cap→slotCap · K→maxFailCount` 일괄 rename 후 ADR 문서군 8개.
**VERDICT 둘 다 "회귀 없음"** (표기만 변경, 설계/수치/동작 무변경).

### rename 결함 → 전부 수정
- **stray 변수**(rename 누락): `api.md`의 bare `M`(L117)·`K`(L47), `implementation-notes`의 `slot N`(L15) → 치환.
- **garble**(괄호 중복): ADR L25 `slotCap (N)(slotCap ≈ workerPoolSize)` → `(N, slotCap ≈ ...)`; orchestrator L568 `slotCap(≈workerPoolSize)` → 간격 정리.

### false positive 보존 (변경 금지였고 지켜짐)
- `N pod(s)`·`N-pod`(다중 replica) · `N개`·`1:N`·`N번 폴링`·`N회`·`N건`(cardinality) · `max_fail_count`(snake DB 컬럼) — 전부 무변경 확인.

### 정확성 회귀 = 0 (양 리뷰 명시)
- **workerPoolSize(hard cap) vs slotCap(soft throttle)** 구분 여전히 crisp · `slotCap × maxFailCount`는 sizing(상한 아님) 유지.
- RLE · CANCELLING precedence · 단일 writer · dispatch 5단계 · backpressure cadence · errorCode 3분류 · HANDLER_NOT_FOUND synthetic 행 · Definition/snapshot — 전부 intact.
- opus 노트: codex가 "고치라"던 2건(HANDLER synthetic 필드 / workerPoolSize "IM 보호")은 **정본 그대로라 정확** → 고치지 말 것.

---

## 3. 최종 cross-file 검증 (후속20) — codex 88 / opus 93

병렬 fix 후 남은 cross-agent 모순을 전체 검증으로 잡아 **단일-writer reconcile**:
1. **(significant) HANDLER_NOT_FOUND synthetic kind** — orchestrator "DISPATCH|CHECK" vs state-machine "kind=CHECK 고정" → handler resolve는 외부 호출 *이전* 판정이라 "시도 단계" 무의미 → **kind=CHECK 고정 통일**.
2. **(significant) synthetic checkedAt** — DISPATCH PENDING만 `checkedAt=null`, HANDLER_NOT_FOUND synthetic은 `startedAt=checkedAt=tick·latencyMs=null`로 정정.
3. (minor) outcome 파생 — `result=FAIL ∧ (error_code IS NULL OR ≠EXECUTION_TIMEOUT)→FAILED`(취소 마감 null 포함).
4. (minor) operations `max_fail_count` kind별(TF=attempt 수 · CONDITION_CHECK=CHECK ERROR 수).
5. (minor) RLE partition `task_id+kind+name+external_handle`를 orchestrator §1.2에도 명시.

**결론**: 집중 검증 8축 중 7축이 병렬 수정 후에도 완전 정합, 남은 모순 0 → **cross-file 일관성 baseline 안정**.

---

## 4. 파일별 병렬 fix 라운드 (후속19) — ~28 genuine fixes

4 agent에 disjoint 파일 분담(A1 state-machine · A2 api+operations · A3 orchestrator · A4 task-model+migrations+ADR), 각자 *fix → codex 리뷰 → 수정 → cross-file 보고*. whole-doc가 계속 놓친 것들을 전수로 포착:
- **수동→자동 레지스트리 자기모순**(task-model) — 장기 잠복 버그.
- **HANDLER_NOT_FOUND가 없는 `task.error_code` 컬럼에 쓰는 듯** → synthetic task_check로 정정.
- **fail_reason jsonb casing**(snake 저장 `{task_id,error_code}` · API camel 별개).
- **D-T7 backpressure requeue 자기모순**(Retry-After 우선 vs max → max 통일).
- RUNNING→DONE attempt `result=OK` 마감 대칭 · fail_count kind별 정의 · HANDLER_NOT_FOUND/취소 마감(error_code=null)은 fail_count 미증가 · K의 CONDITION_CHECK 해석.
- **tick 평가 순서 신규 블록**(①CANCELLING ②handler ③완료관측 ④timeout ⑤일반 — 완료>timeout은 fresh 재독 정합).
- CANCELLING drain 의미 · RLE partition/key 명시 · 깨진 절대 줄번호 참조 제거.
- A4가 **codex 오판 2건 반려**(latestCheck=started_at 정본 유지).

**cross-agent reconcile**(내가 단일 writer): dispatch backpressure 시각 충돌(A1 `max(...)` vs A3 "cadence 하한 없음" → **A3 채택**) · fail_reason casing 정정.
**교훈**: 병렬 fix는 cross-agent 충돌(같은 개념 다른 파일)이 남아 **단일-writer reconcile 필수**.

---

## 5. 6섹션 전담 리뷰 (후속18) — concern별 deep 리뷰

whole-doc whack-a-mole 대신 6 concern 섹션 전담(codex A/B/C 복잡영역 + opus D/E/F 안정영역):
- **안정영역 D/E/F = significant 0** (견고 확인).
- **복잡영역 A/B/C**가 RLE 불완전 전파 잔재 + genuine 몇 건을 전수로 포착.
- concept-sweep 일괄 수정 6항목: ①RLE 잔재 광역(4파일) ②errorCode 저장 3분류 명시 ③backpressure 균일화 마무리 ④step4 CAS race ⑤state-machine clarity ⑥D/F minor 일괄.

**교훈**: 섹션 전담 deep 리뷰가 whole-doc 훑기보다 전파 누락을 잘 잡음 + **concept-sweep는 변형 표현까지 광역 grep** 필요.

---

## 6. whole-doc 라운드 r6~r15 (직전 세션 요지)

라운드마다 codex 82~88 / opus 88~94 박스권에서 소수의 신규 표면이 계속 나옴. 잡은 대표 이슈:
- in-progress RUNNING attempt의 `response`는 null이 아니라 `{jobId}` 보유(r10 내 회귀 → r11 codex 포착).
- active attempt 마감 vs 보존 문서간 모순 통일(r11→r12).
- RLE 불완전 전파(7곳 고치고 6곳 놓침 — r15, codex+opus 둘 다 포착).
- **교훈(사용자 관찰)**: "고칠 게 계속 나오는 건 cross-doc 전파를 못 맞춰서" → concept-sweep 규율 + 방법 전환(섹션 전담 → 파일 병렬)으로 수렴.

---

## 7. RLE 채택 (후속17) — 리뷰가 촉발한 결정

장기 CONDITION_CHECK이 ≥10분 cadence로 7일 폴링 시 NOT_MET ~1000행이 쌓이는데 그 반복은 2비트 중복 — 사용자 통찰. 대안 A/B/C/D 중 **B(RLE run collapse) 채택**(정보 손실 0 + 더 나은 audit + 저위험):
- DISPATCH=호출당 1행 / CHECK=관측 run(연속 동일 collapse·`poll_count++`).
- O24 "1 call=1 row" supersede(CHECK 한정; DISPATCH 유지). 스키마 `task_check.poll_count` 추가.

---

## 8. 정합성 8축 — 무손상 확인 (전 라운드 공통)

리뷰가 매 라운드 교차검증하는 fragile 개념. **현재 전부 정합**:

| 축 | 정본 요지 |
|---|---|
| RLE | DISPATCH 호출당 1행 / CHECK 관측 run collapse(partition `task_id+kind+name+external_handle`, key `(api_result,observed,error_code)`); 행 표현일 뿐 fail_count 회계 무관 |
| CANCELLING precedence | 파생 ① 최우선; 취소 중 FAILED여도 CANCELLED 단일 수렴 — **상태 기준**(시간 아님) |
| 단일 writer | 상태=tick / 관측(task_check)·산출(attempt.response)=호출 스레드; 다음 tick이 소비 |
| N/M/K(현 workerPoolSize/slotCap/maxFailCount) | workerPoolSize=hard cap(배포설정) · slotCap=soft throttle(N≈M) · slotCap×maxFailCount=sizing(상한 아님) |
| dispatch 5단계 | (1)DISPATCHING CAS+attempt (2)PENDING 선기록 (3)호출 (4a)관측 always (4b)response 채택 CAS (5)다음 tick RUNNING |
| backpressure cadence | dispatch=Retry-After/없으면 다음 tick(cadence 하한 없음·동일 logical attempt) · poll/check=max(Retry-After, kind cadence) |
| errorCode 3분류 | ①attempt 귀속 ②task_check 관측(CALL_TIMEOUT 공통) ③tick 파생(TTL_EXPIRED 행 없음·HANDLER_NOT_FOUND synthetic) |
| Definition/snapshot | 코드 default recipe + write-once snapshot; recipe/config frozen, task class 코드는 현재 배포본 |

---

## 9. 검토 방법론

- **도구**: codex(`codex exec -c model_reasoning_effort=xhigh`, 백그라운드) + opus 서브에이전트 병렬.
- **단일 writer 규율**: 모든 정본 수정은 단독 author, 리뷰만 병렬 → cross-agent 모순 방지.
- **방법 진화**: whole-doc(전파 누락 多) → 섹션 전담(안정/복잡 분리) → 파일 병렬(disjoint fix) → 통합 cross-file 검증(reconcile). 각 단계가 이전이 못 잡은 층을 벗김.
- **concept-sweep**: 한 개념 수정 시 변형 표현까지 전 파일 grep(부분 전파가 최대 재발원).

---

## 10. 잔여 = 결정 의논 후보 (정확성 아님)

- **per-call deadline TaskKind override의 편집 소유권**(settings API / 코드 / 배포) — 어느 권위 문서에도 미확정. ADR 결정 필요(api는 "out of scope"로 추측 제거).
- **아키텍처 build-vs-buy** 리서치(Temporal/Step Functions/k8s-controller) · **Saga/compensation**(중간 실패 롤백) — 결정 전 자료조사 후보.
- (FR-6 관련) **마지막 성공 task_check 응답 본문 보존** — 현재 미보존(관측만), v2 `task_check.detail(jsonb)` + postCheck로 additive 확장 가능(설계 완료, S27/S29/O29). 장기 보존은 retention 정책 별도 결정 필요.
