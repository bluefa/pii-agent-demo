# SIT Step 2 — Wave Task Index

`/wave-task <key>` 입력으로 바로 사용할 수 있는 Step 2 (연동 대상 승인 대기) 구현 specs.

> **전제**:
> - PR #419 (`docs/reports/design-migration-plan-step2to7.md`) 머지 완료
> - PR #420 (`docs/bff-api/tag-guides/approval-requests.md`) 머지 완료 — system-reset endpoint 명세 / `scan_status` / `integration_status` 필드 정의 포함

---

## 0. 범위 (Scope)

본 plan 은 **Step 2 (`WAITING_APPROVAL` = ProcessStatus 2) 화면 한정**.

**포함**:
- 시안 `design/app/SIT Prototype v2.html` 의 `data-stepc="2"` 섹션 (line 1535–1610)
- `confirmStepModal` 패턴 (line 2300–2326) — 취소 confirm 용으로 재사용
- 반려 케이스 IA 변경 + system-reset endpoint 통합

**제외**:
- Step 1 / Step 3~7 (별도 wave 에서 진행)
- Guide CMS / Admin Dashboard / Target Source 검색 페이지

---

## 1. 의존성 그래프

```
S2-W1a (BFF contract)
  swagger snippet + types
        │
        ▼
S2-W1b (Mock + Route + bff-client)
  systemReset endpoint 구현 + scan_status/integration_status mock 노출
  + 반려 시 processStatus 자동 회귀 OFF
        │
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
S2-W1c (Frontend     S2-W1d (Cancel  S2-W1e (Rejection
  table rewrite)       confirm modal)   IA + system-reset CTA)
        │              │              │
        └──────────────┴──────────────┘
                       │
                       ▼
              S2-W1f (Design polish)
              픽셀 정합 + 한국어 카피 final pass
```

**중요**: S2-W1b 머지 전엔 S2-W1c/d/e 시작 금지. (mock 응답 형태가 확정되어야 frontend 작업 가능)

---

## 2. 실행 순서

```
1. S2-W1a — BFF contract  (단독, ~2일)
2. S2-W1b — Mock + Route + bff-client  (S2-W1a 머지 후)
3. (S2-W1b 머지 후) S2-W1c, S2-W1d, S2-W1e  병렬 가능 (3 PRs)
4. (W1c/d/e 모두 머지 후) S2-W1f — design polish (visual only)
```

병렬 진행 시 file 충돌 주의:
- W1c는 `WaitingApprovalStep.tsx` + 신규 테이블 컴포넌트
- W1d는 신규 `ConfirmStepModal.tsx` + `ApprovalWaitingCard.tsx` 의 취소 버튼 wiring
- W1e는 `RejectionAlert.tsx` + neue Primary 버튼 + `app/lib/api` 의 system-reset 함수

→ `WaitingApprovalStep.tsx` 는 W1c 가 소유. W1d/W1e 가 wiring 추가 시 W1c 머지 후 rebase.

---

## 3. 모델 효율 가이드

| Wave | 권장 모델 | 사유 |
|---|---|---|
| **S2-W1a** BFF contract | Sonnet 4.6 | swagger snippet 작성 + types 추가, 결정 사항이 PR #420 에 박힘 |
| **S2-W1b** Mock + Route + bff-client | **Opus 4.7 MAX** | mock 비즈니스 로직 + ADR-007 NextResponse 디스패치 + 반려 IA 변경 + 회귀 테스트 |
| **S2-W1c** Frontend table rewrite | Sonnet 4.6 | 시안 그대로 표 markup + Tailwind 토큰 매핑 |
| **S2-W1d** Cancel confirm modal | Sonnet 4.6 | 신규 모달 1개 + 기존 cancel 버튼 wiring |
| **S2-W1e** Rejection IA + CTA | **Opus 4.7 MAX** | RejectionAlert + system-reset 호출 + processStatus refetch + edge case (409 conflict) |
| **S2-W1f** Design polish | Sonnet 4.6 | 픽셀 정합 + 카피 final pass (행동 변경 없음) |

→ MAX 2건 / Sonnet 4건. W1c/d/e 병렬 시 1+1+1.

---

## 4. PR 분리 원칙

각 wave-task 는 **단일 PR 1개**. 평균 ~150–400 LOC.

- W1a: ~80 LOC (swagger + types)
- W1b: ~350 LOC (mock + route + tests)
- W1c: ~280 LOC (테이블 컴포넌트 + tests)
- W1d: ~220 LOC (modal + wiring + tests)
- W1e: ~250 LOC (alert + CTA + system-reset 호출 + tests)
- W1f: ~120 LOC (visual class 교체 only)

---

## 5. Spec 파일 목록

| 키 | 파일 |
|---|---|
| `S2-W1a` | [`S2-W1a-bff-contract.md`](./S2-W1a-bff-contract.md) |
| `S2-W1b` | [`S2-W1b-mock-and-route.md`](./S2-W1b-mock-and-route.md) |
| `S2-W1c` | [`S2-W1c-frontend-table.md`](./S2-W1c-frontend-table.md) |
| `S2-W1d` | [`S2-W1d-cancel-confirm-modal.md`](./S2-W1d-cancel-confirm-modal.md) |
| `S2-W1e` | [`S2-W1e-rejection-ia.md`](./S2-W1e-rejection-ia.md) |
| `S2-W1f` | [`S2-W1f-design-polish.md`](./S2-W1f-design-polish.md) |

---

## 6. 공통 참조 (모든 spec reading-required)

- 본 문서: `docs/reports/design-migration-plan-step2to7.md` (Step 2 섹션)
- BFF 명세 (PR #420): `docs/bff-api/tag-guides/approval-requests.md`
- 기존 swagger: `docs/swagger/confirm.yaml`
- 시안: `design/app/SIT Prototype v2.html` line 1535–1610 (Step 2 본문) + line 2300–2326 (`confirmStepModal`)
- ProcessStatus enum: `lib/types.ts` line 5–13
- 현재 Step 2 컴포넌트: `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep.tsx`
- 현재 RejectionAlert: `app/integration/target-sources/[targetSourceId]/_components/common/RejectionAlert.tsx`
- 현재 cancel 버튼: `app/components/features/process-status/ApprovalWaitingCard.tsx`
- ⛔ 규칙: `CLAUDE.md` (raw 색상 금지 / theme.ts 토큰 사용 / `@/` 절대 경로)
- API pattern: `docs/adr/007-api-client-pattern.md`

---

## 7. 디자인 원칙 (⛔ 흐트림 금지)

본 plan 의 가장 중요한 규칙: **시안 `design/app/SIT Prototype v2.html` 의 시각/카피를 그대로 옮긴다.** 임의로 개선·축약·재해석하지 않는다.

### 7.1. 카피는 시안에서 직접 추출

| UI 위치 | 시안 카피 (line) | 변경 금지 |
|---|---|---|
| 카드 제목 | `연동 대상 승인 대기` (1539) | ✅ |
| 카드 sub-text | `요청하신 DB 목록을 관리자가 확인하고 있어요.` (1541) | ✅ |
| 헤더 우측 status pill | `승인 대기` (1544) | ✅ |
| Banner 본문 | `<strong>관리자 승인을 기다리고 있어요.</strong>&nbsp;평균 1영업일 내 검토되며, 승인되면 메일로 안내됩니다.` (1551–1552) | ✅ |
| 테이블 헤더 | `# / DB Type / Resource ID / Region / DB Name / 연동 대상 여부 / 스캔 이력` (1560–1567) | ✅ |
| 취소 버튼 | `연동 대상 승인 요청 취소` (1605) | ✅ |

→ 어떤 wave 에서도 위 문자열을 수정 / 영문화 / 재배열하지 않는다. UX 미세 조정이 필요하면 별도 issue 로 분리.

### 7.2. 시각 토큰 매핑 (시안 CSS 변수 → theme.ts)

신규 시안에서 사용된 token들 — 새로 추가할 필요가 있을 수 있음:

| 시안 | CSS 변수 / Hex | theme.ts 토큰 (제안) |
|---|---|---|
| `step-banner` 기본(info) | `var(--color-primary-light)` + `border #BFDBFE` + `color #1E3A8A` | `bannerStyles.info` 신규 그룹 |
| `status partial` (승인 대기 pill) | `bg #FEF3C7` + `color #92400E` | 기존 `statusColors.warning` 재사용 |
| `btn danger-outline` | `border #FECACA` + `bg #FEF2F2` + `color var(--color-error-dark)` | `buttonStyles.dangerOutline` 신규 |
| `confirmStepModal` warning note | `bg #FFFBEB` + `border #FCD34D` + `color #92400E` | `noteStyles.warning` 신규 (또는 기존 statusColors.warning 활용) |
| `tag green` (대상) | `bg #ECFDF5` + `color #065F46` | `tagStyles.success` 신규 |
| `tag gray` (비대상) | `bg #F3F4F6` + `color #4B5563` | `tagStyles.neutral` 신규 |
| `tag blue` (DB Type) | `bg #DBEAFE` + `color #1E40AF` | `tagStyles.info` 신규 |
| `mono` 셀 | `font-mono text-[12px]` | 기존 + 클래스 조합 |

→ 토큰 추가는 **W1f** 에서 일괄 정리. W1c/d/e 는 임시로 raw 클래스 사용 가능하지만, **CLAUDE.md 의 raw hex 금지 규칙을 준수**해야 하므로 첫 사용 시점부터 theme.ts 에 토큰 추가하고 import 한다.

### 7.3. Spacing / Radius / Shadow 그라운드 룰

| 요소 | 값 |
|---|---|
| 카드 외곽 | `rounded-xl` (12px) + `shadow-sm` |
| 카드 내부 padding | `px-6 py-6` (24px) |
| 카드 헤더 | `px-6 py-4 border-b border-gray-100` |
| 테이블 셀 | `px-6 py-3` |
| 모달 외곽 | `rounded-xl` (12px) + `shadow-xl` |
| 모달 폭 | `width: 440px` (시안 line 2302) |
| 버튼 radius | `rounded-lg` (8px) |
| 버튼 padding | `px-3 py-2` (작음) / `px-4 py-2` (기본) |
| Status pill | `rounded-full` |
| Banner | `rounded-[10px]` (시안 line 803) — `rounded-lg` (8px) 가 아님에 주의 |

### 7.4. 한국어 미세 가이드

- `해 주세요` (띄어쓰기) 가 아니라 `해주세요` 로 통일된 부분 있음. 시안 그대로 따르기 (시안이 mixed style — 라인별 확인 필요).
- `1영업일` (시안 1552) 은 그대로. `영업일 1일` 로 풀지 않는다.
- 마지막 마침표 누락 / 공백 / `&nbsp;` (시안 1552) 도 시안 그대로 — `&nbsp;` 자리는 React 에서 `{' '}` 또는 `&nbsp;` JSX 으로 보존.

---

## 8. 공통 PR body template

```markdown
## Summary
- Spec: `docs/reports/sit-step2/<file>.md` @ <SHA>
- Wave: <key>
- 의존: <merged waves>
- 디자인 reference: `design/app/SIT Prototype v2.html` line <range>

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — relevant tests pass
- [ ] **시안 픽셀 정합** — 스크린샷 첨부 (W1c~W1f)
- [ ] **카피 1:1** — 시안 line 1535–1610 의 한국어 문자열 변경 없음

## Deviations from spec
<없으면 "None">
- ⛔ 시안 카피 변경은 Deviation 으로 기록 + reviewer 승인 필수

## Deferred to later waves
<없으면 "None">
```

---

## 9. ⛔ 절대 규칙 (Cross-wave)

1. **시안 카피 변경 금지** — `design/app/SIT Prototype v2.html` line 1535–1610 의 한국어 문자열은 character-for-character 보존.
2. **null/undefined → `—` 통일** — `"-"`, `"N/A"`, `"없음"` 등 다른 placeholder 금지.
3. **Raw hex 금지** — `theme.ts` 토큰 또는 미리 추가된 Tailwind class 만 사용. CLAUDE.md ⛔ #4 위반 시 즉시 reject.
4. **`@/` 절대 경로 only** — 상대 경로 import 금지.
5. **`any` 금지** — 새 타입 추가 시 명시적 정의.
6. **시안 영역 침범 금지** — 본 plan 6개 wave 외 파일 수정은 별도 issue 로 분리.
7. **Mock 동작 보장** — `USE_MOCK_DATA=true` 에서 모든 wave 가 동작해야 함. mock 미반영 시 PR reject.
