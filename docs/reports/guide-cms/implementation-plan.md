# Guide CMS — 구현 계획

> **Status**: 📝 draft for review (2026-04-25)
> **Spec**: [spec.md](./spec.md) · **Swagger**: [../../swagger/guides.yaml](../../swagger/guides.yaml) · **ADR**: [../../adr/010-guide-cms-slot-registry.md](../../adr/010-guide-cms-slot-registry.md)
> **Supersedes**: 이전 `requirements-draft.md` / `implementation-plan.md` (PR #308 draft — 재설계 후 아카이브)

---

## 0. 요약

`lib/constants/process-guides.ts` 의 `GuideCard` 본문을 **Admin 편집 가능 구조** 로 전환.

- **Registry-as-code** (프론트 상수 소유) + **Content-as-data** (서버 저장)
- **Slot registry** (many-to-one) 로 배치 다중화 + 향후 확장 여지
- **Tiptap + AST 렌더** — HTML 검증 3-layer 방어
- **22 guide names × 28 slots** — AWS(AUTO+MANUAL) / AZURE / GCP 대상

---

## 1. 최종 확정 사항 (13개)

| # | 결정 | 근거 |
|---|---|---|
| D1 | 단일 URL `/integration/admin/guides` (path 기반 네비 X) | 전환 편의 |
| D2 | Provider 탭 → Step 목록 → Editor+Preview 3-pane | 위치 가시성 |
| D3 | AWS 탭 1개 (내부 AUTO/MANUAL 분기) | Step 4 외 공유 |
| D4 | IDC/SDU 스코프 제외 | Step 미확정 |
| D5 | `contents` 단일 HTML 필드 (title/body 분리 없음) | 구조 단순화 |
| D6 | ko/en 동시 작성 강제 (클라+서버 검증) | 반쪽 저장 방지 |
| D7 | Guide 이름 = 프론트 상수 (Admin 생성·삭제 불가) | 안정적 식별자 |
| D8 | Slot registry (many-to-one) | Codex 리뷰 반영 |
| D9 | `COMMON_*` 미사용 — provider 별 독립 | 명시적 분리 |
| D10 | API 2 endpoint (GET/PUT by name) | 필요 최소 |
| D11 | 작성 현황 뱃지 제거 | 가치 대비 복잡도 |
| D12 | Tiptap + AST 기반 렌더 (innerHTML 미사용) | 엄격 HTML 검증 |
| D13 | 미저장 변경 confirm 다이얼로그 (localStorage X) | 단순 + 안전 |

---

## 2. 아키텍처 요약

ADR-007 기준 CSR pipeline 준수:

```
┌──────────────────────────────────┐
│ Admin UI                          │
│ /integration/admin/guides         │
│  - Provider tabs                  │
│  - Step list                      │
│  - Tiptap editor (ko/en)          │
│  - GuideCard preview              │
└────────────┬─────────────────────┘
             │ fetchJson('/integration/api/v1/admin/guides/...')
             ▼
┌──────────────────────────────────┐
│ Next.js route handler             │
│ app/integration/api/v1/admin/     │
│   guides/[name]/route.ts          │
│  → client.guides.get/put          │
└────────────┬─────────────────────┘
             │
       USE_MOCK_DATA? ──Yes──→ mockClient (lib/api-client/mock/index.ts)
             │                  └─→ mockGuides (lib/api-client/mock/guides.ts)
             │                        └─→ in-memory store + validateGuideHtml()
             │
             └──No──→ bffClient (lib/api-client/bff-client.ts)
                      └─→ client.guides.get/put (HTTP proxy to upstream BFF /install/v1)

Frontend registry (synchronous, source of truth for identity/placement):
  lib/constants/guide-registry.ts
    - GUIDE_NAMES (22)
    - GUIDE_SLOTS (28)
    - GuidePlacement union
    - resolveSlot(key) / findSlotsForGuide(name)

Provider 페이지:
  <GuideCardContainer slotKey="process.aws.auto.3" />
  → resolveSlot → name → useGuide(name) → <GuideCard content={html} />
  → validateGuideHtml(html) → renderGuideAst() (React.createElement, no innerHTML)
```

**핵심 경계**:
- Mock 비즈니스 로직 위치: `lib/api-client/mock/guides.ts` (ADR-007 준수)
- Route handler 는 `client.method()` 디스패치만 수행 (mock 분기 X)
- `lib/bff/client.ts` (server-only `bff` export) 와 **혼동 금지** — CSR pipeline 은 `lib/api-client/*` 경유

---

## 3. Wave 분할

### 원칙

- **W1 (기반)** 과 **W4 (소비자 교체)** 는 디자인 무관 → AI 독립 진행
- **W2 (디자인)** 은 사용자 주도 → AI 는 대기 (W1/W4 병렬 진행)
- **W3 (Admin UI)** 은 W2 이후 착수
- **W5 (QA)** 최종

### 의존성 그래프

```
시간 →

W1 (AI 독립)     ████████████
W2 (사용자 주도)        ████████████  ← 디자인 시안
W4 (AI, W1 후)   ──────████████       ← W3 와 병렬
W3 (AI, W2 후)   ────────────████████████
W5 (QA)                              ████
```

---

### W0 — 의존성 추가 (사용자 승인 필요)

| ID | 내용 | 검증 |
|---|---|---|
| 0-A | `npm install @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-link` | `package.json` dependencies 에 4개 추가 |
| 0-B | 번들 사이즈 측정 | Admin 라우트 lazy-load 기준 증가분 확인 (<200KB gzip 목표) |
| 0-C | DOM 검증용 서버 shim 검토 | `linkedom` 또는 `jsdom` — `validateGuideHtml()` 동형 구현. 선택 후 0-A 와 동일 PR 에 추가 |

→ 의존성 추가는 CLAUDE.md 상 **사용자 승인 요구**. W1 착수 전 확정.

---

### W1 — Foundation (AI 독립, W0 이후)

**목표**: 디자인 없이 가능한 모든 기반 완료. **ADR-007 API client pattern 준수**.

| ID | 내용 | 파일 / 산출물 | 의존 |
|---|---|---|---|
| 1-A | 타입 정의 | `lib/types/guide.ts` — `GuideName`, `GuideContents`, `GuideDetail`, `GuideUpdateInput`, `GuidePlacement`, `GuideSlot` | — |
| 1-B | Registry + resolver | `lib/constants/guide-registry.ts` — `GUIDE_NAMES` (22) · `GUIDE_SLOTS` (28) · `resolveSlot()` · `findSlotsForGuide()` | 1-A |
| 1-C | HTML validator (동형) | `lib/utils/validate-guide-html.ts` — `validateGuideHtml(html): ValidationResult` · server/client 양쪽에서 동작 · unit tests (허용/차단/구조/URL scheme/protocol-relative) | 1-A, 0-C |
| 1-D | AST 렌더러 | `app/components/features/process-status/GuideCard/render-guide-ast.tsx` — `renderGuideAst(ast): ReactNode` | 1-C |
| 1-E | Mock namespace (`client.guides`) | `lib/api-client/mock/guides.ts` — `mockGuides = { get, put }` · in-memory `Record<GuideName, GuideDetail>` · server validation (ko/en non-empty + `validateGuideHtml()`) · seed 주입 · drift 처리 (§4.5) | 1-A, 1-B, 1-C |
| 1-F | ApiClient 타입 확장 | `lib/api-client/types.ts` — `ApiClient.guides: { get, put }` 추가 | 1-A |
| 1-G | Mock aggregation | `lib/api-client/mock/index.ts` — `mockClient.guides = mockGuides` | 1-E, 1-F |
| 1-H | BFF client 확장 | `lib/api-client/bff-client.ts` — `bffClient.guides` HTTP 프록시 (`/install/v1/admin/guides/:name`) | 1-F |
| 1-I | Route handler | `app/integration/api/v1/admin/guides/[name]/route.ts` — `client.guides.get/put` 디스패치만 · ProblemDetails 반환 | 1-G, 1-H |
| 1-J | CSR wrapper | `app/lib/api/guides.ts` — `fetchJson` 기반 CSR 헬퍼 (선택적) | 1-I |
| 1-K | `useGuide` 훅 | `app/hooks/useGuide.ts` — 프로젝트 기존 `useApi*` 패턴 재사용 (SWR 미사용) | 1-J |
| 1-L | Swagger | `docs/swagger/guides.yaml` — OpenAPI 3.0 + `GuideName` enum + ProblemDetails + 예시 | 1-A, 1-I |
| 1-M | Seed migration 스크립트 | `scripts/migrate-guides-to-html.ts` — 기존 `DEFAULT_STEP_GUIDES` → HTML 변환 → mock store 초기값 | 1-B, 1-C |
| 1-N | Drift CI 테스트 | `__tests__/guide-registry.test.ts` — `GUIDE_NAMES === mock store keys`, `GUIDE_SLOTS[*].guideName ⊂ GUIDE_NAMES`, resolver 6 케이스 (spec §8.1) | 1-B, 1-E |
| 1-O | Error catalog 업데이트 | `app/api/_lib/problem.ts` `ERROR_CATALOG` — `GUIDE_NOT_FOUND`, `GUIDE_CONTENT_INVALID` 추가 | — |

**PR 분할 권장**:
- **W1-a**: 1-A, 1-B, 1-O (타입 + registry + error code)
- **W1-b**: 1-C, 1-D (validator + AST renderer)
- **W1-c**: 1-E, 1-F, 1-G, 1-H, 1-I, 1-J, 1-K, 1-L, 1-M (API pipeline + swagger + seed)
- **W1-d**: 1-N (CI drift 테스트)

**예상 LOC**: ~1100 (PR 당 ~250-350)

---

### W2 — 디자인 시안 ✅ 완료 (2026-04-25)

**산출물 위치**: `design/guide-cms/`

| 파일 | 내용 |
|---|---|
| `design/guide-cms/guide-cms.html` | 1318 LOC HTML 모크업 — 모든 상태 (initial / editing / shared / save 4종 / error 3종 / confirm modal / disabled provider) 한 페이지 안에 토글로 |
| `design/guide-cms/components.md` | 페이지 트리, 신규 컴포넌트 8종, 재사용 컴포넌트 매핑, Tiptap 툴바 구조, 상태머신 |
| `design/guide-cms/interactions.md` | 키보드 네비, 호버·포커스, 트랜지션 (250ms preview debounce 등), 특수 플로우 6종, a11y 체크리스트 |

**주요 디자인 결정** (시안에서 확정 — W3 구현 시 그대로 따른다):
- Top nav 다크 (`#0F172A`) + brand pill primary 그라디언트 (`#0064FF` → `#4F46E5`)
- Step 행 selected: `primary-50` 배경 + 3px 좌측 primary 엣지 + `◉` 마커
- 미리보기 debounce **250ms** (타이핑 burst 동안 과잉 렌더 방지)
- Save 버튼 disabled 시에도 포커스 받음 (`aria-disabled`) + tooltip
- Toolbar `role="toolbar"` + roving tabindex (Tab 1번만 진입)
- IDC/SDU 비활성 탭 클릭 시 toast 중복 방지 (최근 toast id 동일하면 skip)

**구현 시 components.md / interactions.md 절대 준수**: W3 구현은 이 두 문서를 spec 으로 취급.

---

### W3 — Admin UI (AI, W2 완료 — 시안 기준 구현)

**입력 spec**: `design/guide-cms/{guide-cms.html, components.md, interactions.md}`

| ID | 내용 | 의존 | 시안 참조 |
|---|---|---|---|
| 3-A | 페이지 shell — `app/integration/admin/guides/page.tsx` (layout 재사용) | — | components.md §1 페이지 트리 |
| 3-B | `<ProviderTabs />` — IDC/SDU disabled toast | — | components.md §2 ProviderTabs · interactions.md §4.6 |
| 3-C | `<StepListPanel />` — slot registry 조회, AWS step 4 분기, dirty guard | 1-B | components.md §2 StepListPanel · interactions.md §4.1 |
| 3-D | `<TiptapEditor />` — `next/dynamic` lazy + 7-button toolbar + `<LinkPromptModal>` | 0-A, 1-C | components.md §2 TiptapEditor + §4 툴바 · interactions.md §4.4 |
| 3-E | `<LanguageTabs />` 상태머신 — ko/en 독립 + `filled/empty` dot | — | components.md §2 ③ |
| 3-F | `<GuidePreviewPanel />` — `<ProcessTimelineCompact />` + GuideCard 재사용 + 250ms debounce | 4-A, 1-D | components.md §2 GuidePreviewPanel · interactions.md §3 |
| 3-G | `<ScopeNotice />` — `findSlotsForGuide(name)` 결과, N≥2 노출 | 1-B | components.md §2 ② |
| 3-H | `<SaveButton />` 상태머신 — disabled / enabled / loading / error | 1-K | components.md §2 ④ + §5 |
| 3-I | `<UnsavedChangesModal />` — `useModal()` + dirty guard + focus trap | — | components.md §2 UnsavedChangesModal · interactions.md §4.1 |
| 3-J | 에러 상태 — `<ErrorState>` (GET 실패), `<GuideCardInvalidState>` (렌더 검증 실패) | — | components.md §2 |
| 3-K | a11y — roving toolbar tabindex, `aria-live`, focus-visible, prefers-reduced-motion | — | interactions.md §1 + §5 |

**PR 분할 권장** (각각 wave-task 1개):
- **W3-a** (`wave-task/W3-a-page-shell.md`): 3-A, 3-B, 3-C — shell + tabs + step list
- **W3-b** (`wave-task/W3-b-editor.md`): 3-D, 3-E, 3-G, 3-H — Tiptap + 언어 탭 + 영향 범위 + 저장
- **W3-c** (`wave-task/W3-c-preview.md`): 3-F — preview panel + timeline + debounce (W4-a 의존)
- **W3-d** (`wave-task/W3-d-confirm-error-a11y.md`): 3-I, 3-J, 3-K — confirm + 에러 상태 + a11y

**예상 LOC**: ~1500 (PR 당 ~300-400)

---

### W4 — Consumer migration (AI, W1 이후 — W3 와 병렬 가능)

**목표**: 5 provider 페이지가 새 API 를 쓰도록 교체. 디자인 의존 없음.

| ID | 내용 | 의존 |
|---|---|---|
| 4-A | `GuideCard` 분리 — `GuideCard` (pure: content prop) + `GuideCardContainer` (slotKey prop → fetch) | 1-D, 1-H |
| 4-B | 5 provider 페이지 교체 — AWS / AZURE / GCP / IDC / SDU `ProjectPage.tsx` 의 `<GuideCard currentStep provider installationMode />` 호출부를 `<GuideCardContainer slotKey={...} />` 로 변경. IDC/SDU 는 스코프 밖이지만 호출 형태만 맞춰두기 (빈 content fallback) | 4-A |
| 4-C | 기존 `DEFAULT_STEP_GUIDES` deprecate — `guide` 필드만 제거. `ProcessGuideModal` 용 `procedures`, `warnings`, `notes` 는 유지. | 4-B |
| 4-D | `getProcessGuide()`, `resolveVariant()` 헬퍼 업데이트 — GuideCard 리소스가 아닌 Modal 용으로만 유지 | 4-C |

**중요 노트**:
- IDC/SDU 페이지는 이번 스코프에 guide 가 없으므로 `<GuideCardContainer>` 가 seed 없는 name 을 요청하면 `<GuideCardInvalidState>` 또는 "준비 중" placeholder 렌더
- Feature flag 없이 one-shot 교체 — rollback 시 revert 단일 PR

**PR 권장**:
- **W4-a**: 4-A (GuideCard 분리만)
- **W4-b**: 4-B, 4-C, 4-D (5개 페이지 일괄 교체)

**예상 LOC**: ~400 (대부분 -/+ diff)

---

### W5 — QA · 마무리

| ID | 내용 | 의존 |
|---|---|---|
| 5-A | 통합 테스트 — 목록 → 편집 → 저장 → 재조회 (API + UI) | W3, W4 |
| 5-B | HTML validation 매트릭스 테스트 (spec §8.1) — 허용/차단/scheme/protocol-relative/구조 위반 전수 | 1-C |
| 5-C | A11y 스모크 — tab/list role, aria-live, 키보드 네비 | 3-K |
| 5-D | Drift CI green | 1-K |
| 5-E | Docs 업데이트 — README, ADR 링크, "새 Provider 추가 절차" 섹션 | 전부 |
| 5-F | 사용자 검수 | 전부 |

---

## 4. 의존성 그래프 (상세)

```
W1 내부:
  1-A ──┬─→ 1-B ──┬─→ 1-E ──→ 1-F ──→ 1-G ──→ 1-H
        │         └─→ 1-J ↘
        └─→ 1-C ──→ 1-D    1-K
        1-L (독립)    1-I (1-A+1-F)

W4 는 1-D, 1-H 완료 후 바로 착수 가능 (W2 무관)
W3 는 W2 완료 + 1-B, 1-D, 1-H 완료 필요
```

---

## 5. 사용자 대기 없이 착수 가능

- **W1 전체** — 디자인·의사결정 무관
- **W4 전체** — 동일. GuideCard API 변경은 하위 호환 shim 없이 clean cut
- **W2** 만 사용자 주도 (AI 대기)
- **W3** 는 W2 완료 즉시 착수

---

## 6. 리스크 · 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| Registry ↔ store drift | 404 또는 편집 불가 guide | W1-K CI 테스트. Warn log on orphan. |
| Orphan content (store 잔존) | 용량·혼동 | Admin 노출 안 됨. 수동 cleanup 스크립트 (out of scope) |
| Tiptap 번들 (+150KB) | Admin 로드 지연 | `next/dynamic` lazy load |
| 5 provider 페이지 일괄 전환 | 일시 UI 깨짐 | W4 단일 PR · 사전 dev smoke |
| HTML allow-list 너무 좁음 | 편집 불편 | 저장 400 에러 상세화. 필요 시 확장 PR |
| IDC/SDU Step 확정 지연 | Admin 에서 편집 불가 상태 | 탭 "준비 중" 플레이스홀더. 명시적 out of scope |
| i18n 계획과 conflict | `stepLabel` 한글 하드코딩 | registry label key 로 전환 여지 남김 (ADR §대안) |
| 향후 side-panel/tooltip 추가 | Admin UI 재설계 필요 | Registry 는 지원, UI 는 별도 wave. spec §11.2 명시 |

---

## 7. 열린 이슈

- [ ] W2 디자인 시안 완성 일정
- [ ] Tiptap Link 입력 UX (prompt vs popover) — W2 에서 결정
- [ ] 저장 성공 toast 의 프로젝트 표준 컴포넌트 확인 (W3-b 전)
- [ ] W4 dev smoke 테스트 계획 (5개 페이지 모두 스모크)

---

## 8. 참조

- [spec.md](./spec.md)
- [../../swagger/guides.yaml](../../swagger/guides.yaml)
- [../../adr/010-guide-cms-slot-registry.md](../../adr/010-guide-cms-slot-registry.md)
- 세션 대화 (2026-04-24 ~ 2026-04-25) — 13개 결정의 출처
- Codex 리뷰 (slot registry 도입 근거) — 2026-04-24
- `CLAUDE.md` — ⛔ 규칙 (main 수정 금지, 상대 경로 금지, any 금지)
- `docs/api/boundaries.md` — CSR/SSR pipeline
- `docs/reports/i18n-support-plan.md` — 향후 i18n 영향 (registry label 전환 예정)
