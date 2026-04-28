# SIT Step 3 — Wave Task Index

`/wave-task <key>` 입력으로 바로 사용할 수 있는 Step 3 (연동 대상 반영중) 구현 specs.

> **전제**:
> - PR #419 (`docs/reports/design-migration-plan-step2to7.md`) 머지 완료
> - PR #420 (`docs/bff-api/tag-guides/approval-requests.md`) 머지 완료
> - **Step 2 의 S2-W1a 머지 완료** — `ResourceConfigDto.scan_status` / `integration_status` 타입과 swagger 정의가 본 wave 의 의존성
> - **S2-W1b 머지 완료** — `system-reset` endpoint 와 mock 반영 (S3-W1b 의 회귀 버튼이 호출하는 endpoint)
> - **S2-W1c 머지 완료** — `StepBanner` 컴포넌트 (S3-W1a/W1b 가 재사용)
> - **S2-W1e 머지 완료** — `WaitingApprovalReselectButton` 패턴 (S3-W1b 가 동일 로직 재사용)

---

## 0. 범위 (Scope)

본 plan 은 **Step 3 (`APPLYING_APPROVED` = ProcessStatus 3) 화면 한정**.

**포함**:
- 시안 `design/app/SIT Prototype v2.html` 의 `data-stepc="3"` 섹션 (line 1612–1677)
- 카드 + 테이블 (7 컬럼)
- ProcessStatus 3 → 4 자동 전이 (state-driven)
- **SYSTEM_ERROR (= BFF UNAVAILABLE) 케이스** 처리 — Step 2 의 RejectionAlert 와 동일 위치/패턴 + Step 1 회귀 버튼

**제외**:
- 시안 우측 하단 **Next 버튼** — prototype 전용, 운영 빌드 미포함
- **`반영중` status pill** — 사용자 결정으로 제거
- Step 2 / Step 4~7 (별도 wave)

---

## 1. 답변된 질문 정리 (Q3-1 ~ Q3-6)

| Q | 결정 | 영향 wave |
|---|---|---|
| Q3-1 enum 라벨 | BFF 패스-스루: INTEGRATED→Integrated / NOT_INTEGRATED→— / NEW_SCAN→신규 / UNCHANGED→— | W1a |
| Q3-2 Next 버튼 | 운영 빌드 미포함 | W1a |
| Q3-3 SYSTEM_ERROR | Step 2 와 동일 위치 + 동일 패턴(error banner) + Step 1 회귀 Primary 버튼 | W1b |
| Q3-4 선택+제외 표 통합 | `approved-integration` 응답을 `resource_infos` (선택) → `excluded_resource_infos` (제외) 순서로 concat | W1a |
| Q3-5 status pill | `반영중` 제거 | W1a |
| Q3-6 사용자 escape | SYSTEM_ERROR 케이스 외 escape 없음 (BFF 자동 전이 대기) | W1b |
| Q3-3 derivative | SYSTEM_ERROR = BFF UNAVAILABLE → 기존 system-reset 명세 그대로 사용 가능 | W1b |

---

## 2. 의존성 그래프

```
[Step 2 의존 — 모두 머지 필수]
S2-W1a (BFF contract)  ──┐
S2-W1b (Mock + system-reset)  ──┼──> S3-W1a 가능
S2-W1c (StepBanner 컴포넌트)  ──┘
S2-W1e (WaitingApprovalReselectButton 패턴) ──> S3-W1b 가능

[Step 3 본 plan]
S3-W1a (Frontend table + Card — happy path)
        │
        ▼
S3-W1b (SYSTEM_ERROR / UNAVAILABLE alert + Step 1 회귀 버튼)
        │
        ▼
S3-W1c (Design polish — 픽셀 정합)
```

⛔ S2 의 W1a/W1b/W1c/W1e 가 머지된 뒤 S3 진입.
S3 내부는 W1a → W1b → W1c 순차.

---

## 3. 실행 순서

```
1. (S2-W1a/b/c/e 머지 후) S3-W1a — Frontend table + Card (단독)
2. (S3-W1a 머지 후) S3-W1b — SYSTEM_ERROR alert + 회귀 버튼
3. (S3-W1b 머지 후) S3-W1c — Design polish
```

병렬 가능 여부:
- S3-W1a ↔ S2-W1d (cancel modal): 다른 컴포넌트 만지므로 병렬 가능. 단 둘 다 StepBanner 사용 — S2-W1c 머지 후 안전.
- S3-W1b 는 S2-W1e (Reselect button) 의 코드 패턴을 재사용. **S2-W1e 가 reselect 버튼을 컴포넌트화한 정도에 따라** S3-W1b 의 작업량이 달라짐.
  - S2-W1e 가 단일 파일 컴포넌트로 잘 추출되어 있으면 S3-W1b 는 import + props 차이만으로 끝남
  - 추출이 부족하면 S3-W1b 가 shared component 로 리팩토링하고 두 곳 모두 사용

---

## 4. 모델 효율 가이드

| Wave | 권장 모델 | 사유 |
|---|---|---|
| **S3-W1a** Frontend table + Card | Sonnet 4.6 | read-only 표 + 카드. mutation/modal 없음 |
| **S3-W1b** SYSTEM_ERROR alert + 회귀 버튼 | Sonnet 4.6 | S2-W1e 패턴 재사용 — 설계 결정은 S2 가 다 끝냄 |
| **S3-W1c** Design polish | Sonnet 4.6 | 토큰 매핑 + 픽셀 정합 |

→ Sonnet 3건. Step 2 보다 가벼움.

---

## 5. PR 분리 원칙

- W1a: ~250 LOC (테이블 + 카드 신규 + 기존 `ApprovalApplyingBanner` 제거 + tests)
- W1b: ~150 LOC (error banner wiring + reselect 버튼 재사용 + tests)
- W1c: ~80 LOC (token 정리)

---

## 6. Spec 파일 목록

| 키 | 파일 |
|---|---|
| `S3-W1a` | [`S3-W1a-frontend-table.md`](./S3-W1a-frontend-table.md) |
| `S3-W1b` | [`S3-W1b-error-state.md`](./S3-W1b-error-state.md) |
| `S3-W1c` | [`S3-W1c-design-polish.md`](./S3-W1c-design-polish.md) |

---

## 7. 공통 참조 (모든 spec reading-required)

- 본 문서: `docs/reports/design-migration-plan-step2to7.md` (Step 3 섹션)
- 시안: `design/app/SIT Prototype v2.html` line 1612–1677 (Step 3 본문)
- BFF 명세: `docs/swagger/confirm.yaml` `ApprovedIntegrationResponseDto` (line 1052–1073)
- BFF 명세 (system-reset): `docs/bff-api/tag-guides/approval-requests.md` line 326–395
- Step 2 산출물 (재사용):
  - `app/components/ui/StepBanner.tsx` (S2-W1c)
  - `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalReselectButton.tsx` (S2-W1e — 또는 본 wave 에서 추출)
  - `lib/theme.ts` `bannerStyles` / `buttonStyles.primary` (S2-W1f)
- 현재 Step 3 컴포넌트: `app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep.tsx`
- 기존 banner (제거 대상): `app/components/features/process-status/ApprovalApplyingBanner.tsx`
- 기존 table (재구성 대상): `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationTable.tsx`
- ProcessStatus enum: `lib/types.ts` line 5–13
- ⛔ 규칙: `CLAUDE.md`

---

## 8. 디자인 원칙 (⛔ 흐트림 금지)

### 8.1. 카피는 시안에서 직접 추출

| UI 위치 | 시안 카피 (line) | 변경 금지 |
|---|---|---|
| 카드 제목 | `연동 대상 반영중` (1617) | ✅ |
| 카드 sub-text | `관리자 승인 후 Agent 설치를 위한 사전 작업이 자동으로 진행됩니다.` (1618–1620) | ✅ |
| 테이블 헤더 | `DB Type / Resource ID / Region / DB Name / 연동 제외 사유 / 스캔 이력 / 연동 이력` (1628–1636) | ✅ |
| ⛔ 제거 대상 | `반영중` status pill (1622) | 출력 금지 |
| ⛔ 제거 대상 | `Next` 버튼 (1670–1673) | 운영 빌드 미포함 |

### 8.2. SYSTEM_ERROR 화면 카피 (시안 부재 — 본 plan 에서 결정)

Step 2 의 `RejectionAlert` 와 카피 어조 통일:

| 요소 | 카피 (제안 — reviewer 검토) |
|---|---|
| Error banner 본문 | `<strong>인프라 반영 중 오류가 발생했어요.</strong> 다시 선택 후 재시도해 주세요.` |
| Primary 버튼 | `연동 대상 DB 다시 선택하기` (S2 와 동일 카피로 통일) |
| Confirm modal 제목 | `연동 대상 DB 를 다시 선택할까요?` (S2 와 동일) |
| Confirm modal 본문 | `1단계 · 연동 대상 DB 선택으로 되돌아갑니다. 반영 중이던 모든 상태가 초기화돼요.` |
| Confirm modal note | `진행 중인 모든 승인 요청 상태가 초기화됩니다.` |

⛔ 카피 변경 시 reviewer 승인 필수.

### 8.3. 시각 토큰 매핑

| 시안 | 매핑 |
|---|---|
| 카드 외곽 | `rounded-xl shadow-sm` |
| 카드 헤더 | `px-6 py-4 border-b border-gray-100` |
| 테이블 셀 | `px-6 py-4` |
| `tag blue` (DB Type) | `tagStyles.info` (S2-W1f 산출물) |
| `mono` 셀 | `font-mono text-[12px]` |
| Error banner | `StepBanner variant="error"` (S2-W1c 재사용) |
| Primary 회귀 버튼 | `buttonStyles.primary` (기존) |

→ Step 2 W1f 가 만든 토큰 그대로 재사용. 신규 토큰 추가 **0건 예상**.

### 8.4. 데이터 표기 규칙

- 선택 리소스 (resource_infos) → 제외 리소스 (excluded_resource_infos) **순서로 concat**.
- 행별 `연동 제외 사유` 셀:
  - 선택 리소스 → `—`
  - 제외 리소스 → `excluded_resource_infos[*].exclusion_reason`
- 행별 `스캔 이력` 셀:
  - 선택 리소스 → `resource_infos[*].scan_status` (NEW_SCAN→`신규` / UNCHANGED→`—` / null→`—`)
  - 제외 리소스 → `—` (excluded 의 ResourceConfigDto 가 없는 경우)
- 행별 `연동 이력` 셀:
  - 선택 리소스 → `resource_infos[*].integration_status` (INTEGRATED→`Integrated` / NOT_INTEGRATED→`—` / null→`—`)
  - 제외 리소스 → `—`
- **null/undefined → `—` (em-dash)** 통일.

### 8.5. State machine

- ProcessStatus 가 `INSTALLING(4)` 으로 바뀌면 자동으로 `InstallingStep` 으로 라우팅.
- ProcessStatus 가 `WAITING_TARGET_CONFIRMATION(1)` 으로 바뀌면 자동으로 `WaitingTargetConfirmationStep` 으로 라우팅 (system-reset 응답 후).
- 사용자가 직접 트리거할 수 있는 액션:
  - **happy path**: 없음
  - **SYSTEM_ERROR / UNAVAILABLE path**: `[연동 대상 DB 다시 선택하기]` Primary 버튼 → confirm modal → `system-reset` → ProcessStatus 1 자연 라우팅

---

## 9. 공통 PR body template

```markdown
## Summary
- Spec: `docs/reports/sit-step3/<file>.md` @ <SHA>
- Wave: <key>
- 의존: <merged waves>
- 디자인 reference: `design/app/SIT Prototype v2.html` line 1612–1677

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — relevant tests pass
- [ ] **시안 픽셀 정합** — 스크린샷 첨부
- [ ] **카피 1:1** — 시안 line 1612–1677 의 한국어 문자열 변경 없음
- [ ] **시연 Next 버튼 미포함** — `setStep(4)` 같은 prototype 전용 흔적 없음
- [ ] **`반영중` status pill 미포함** — 시안 line 1622 출력 안 됨

## Deviations from spec
<없으면 "None">

## Deferred to later waves
<없으면 "None">
```

---

## 10. ⛔ 절대 규칙 (Cross-wave)

1. **시안 카피 변경 금지** — line 1612–1677 한국어 문자열 character-for-character 보존.
2. **null/undefined → `—` 통일**.
3. **시연 Next 버튼 미포함**.
4. **`반영중` status pill 미포함**.
5. **Raw hex 금지** — `theme.ts` 토큰만.
6. **`@/` 절대 경로 only**.
7. **`any` 금지**.
8. **Step 2 W1c 의 `StepBanner` 컴포넌트 수정 금지** — Step 3 는 재사용만.
9. **시안 영역 침범 금지** — Step 3 외 화면 컴포넌트 수정 금지.
10. **SYSTEM_ERROR endpoint** — 새 endpoint 만들지 말 것. 기존 `system-reset` 만 사용 (UNAVAILABLE 처리 포함).
