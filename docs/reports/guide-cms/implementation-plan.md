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
| D1 | 단일 URL `/admin/guides` (path 기반 네비 X) | 전환 편의 |
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

```
┌─────────────────────────────┐             ┌────────────────────────────┐
│ Admin UI (/admin/guides)    │ ──GET/PUT── │ /integration/api/v1/       │
│  - Provider tabs            │             │ admin/guides/{name}        │
│  - Step list                │             │                            │
│  - Tiptap editor (ko/en)    │             │ - name ∈ GUIDE_NAMES 검증 │
│  - GuideCard preview        │             │ - ko/en non-empty 검증    │
└────────────┬────────────────┘             │ - validateGuideHtml() 검증│
             │                              └────────────┬───────────────┘
             │                                           │
             │ resolveSlot(key) → name                   │
             ▼                                           ▼
┌─────────────────────────────┐             ┌────────────────────────────┐
│ lib/constants/              │             │ lib/mocks/guide-store.ts   │
│ guide-registry.ts (code)    │             │ (서버 저장소)                │
│  - GUIDE_NAMES (22)         │             │  - name → contents(ko,en)  │
│  - GUIDE_SLOTS (28)         │             │  - updatedAt               │
│  - GuidePlacement union     │             │                            │
└─────────────────────────────┘             └────────────────────────────┘

Provider 페이지 (AwsProjectPage 등):
  <GuideCardContainer slotKey="process.aws.auto.3" />
  → 내부에서 resolveSlot → useGuide(name) → <GuideCard content={html} />
  → validateGuideHtml(html) → renderGuideAst() (React.createElement, no innerHTML)
```

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

### W1 — Foundation (AI 독립)

**목표**: 디자인 없이 가능한 모든 기반 완료.

| ID | 내용 | 파일 / 산출물 | 의존 |
|---|---|---|---|
| 1-A | 타입 정의 | `lib/types/guide.ts` — `GuideName`, `GuideContents`, `GuideDetail`, `GuideUpdateInput`, `GuidePlacement`, `GuideSlot` | — |
| 1-B | Registry + resolver | `lib/constants/guide-registry.ts` — `GUIDE_NAMES` (22) · `GUIDE_SLOTS` (28) · `resolveSlot()` · `findSlotsForGuide()` | 1-A |
| 1-C | HTML validator | `lib/utils/validate-guide-html.ts` — `validateGuideHtml(html): ValidationResult` · unit tests (허용/차단/구조/URL scheme) | 1-A |
| 1-D | AST 렌더러 | `app/components/features/process-status/GuideCard/render-guide-ast.tsx` — `renderGuideAst(ast): ReactNode` | 1-C |
| 1-E | Mock store | `lib/mocks/guide-store.ts` — in-memory `Record<GuideName, GuideDetail>` + reset helper | 1-A, 1-B |
| 1-F | API routes | `app/integration/api/v1/admin/guides/[name]/route.ts` — GET · PUT · error codes (`GUIDE_NOT_FOUND`, `GUIDE_CONTENT_INVALID`) | 1-C, 1-E |
| 1-G | BFF client 네임스페이스 | `lib/bff/client.ts` 확장 — `client.guides.get(name)` · `client.guides.put(name, body)` | 1-F |
| 1-H | `useGuide` 훅 | `app/hooks/useGuide.ts` — 프로젝트 기존 `useApi*` 패턴 재사용 (SWR 미사용) | 1-G |
| 1-I | Swagger | `docs/swagger/guides.yaml` — OpenAPI 3.0 + `GuideName` enum + 예시 | 1-A, 1-F |
| 1-J | Seed migration | `scripts/migrate-guides-to-html.ts` — 기존 `DEFAULT_STEP_GUIDES` → HTML 변환 → store 초기값 | 1-B, 1-C |
| 1-K | Drift CI 테스트 | `__tests__/guide-registry.test.ts` — `GUIDE_NAMES === mock store keys`, `GUIDE_SLOTS[*].guideName ⊂ GUIDE_NAMES` | 1-B, 1-E |
| 1-L | Error catalog 업데이트 | `app/api/_lib/problem.ts` — `GUIDE_NOT_FOUND`, `GUIDE_CONTENT_INVALID` 추가 | — |

**PR 분할 권장**:
- **W1-a**: 1-A, 1-B, 1-L (타입 + registry + error code)
- **W1-b**: 1-C, 1-D (validator + AST renderer)
- **W1-c**: 1-E, 1-F, 1-G, 1-H, 1-I, 1-J (API 레이어 + seed)
- **W1-d**: 1-K (CI drift 테스트)

**예상 LOC**: ~1000 (PR 당 ~250)

---

### W2 — 디자인 시안 (사용자 주도)

**목표**: UI 비주얼 확정. 사용자가 Claude Design 에 요청.

| ID | 시안 대상 | 참조 |
|---|---|---|
| 2-A | `/admin/guides` 레이아웃 (provider tabs + step list + editor + preview) | spec §6.1 |
| 2-B | Provider 탭 + 비활성 "준비 중" 스타일 (IDC/SDU) | spec §6.2 |
| 2-C | Step 목록 패널 — AWS 의 step 4 AUTO/MANUAL 2행 분기 | spec §6.3 |
| 2-D | Tiptap 에디터 + 툴바 (7개 버튼) | spec §6.4.4 |
| 2-E | 언어 탭 [ko] [en] · 저장 비활성 상태 · 인라인 에러 | spec §6.4.3, §6.4.5 |
| 2-F | "N곳에 표시됩니다" 정보 패널 레이아웃 | spec §6.4.2 |
| 2-G | Preview 영역 — 타임라인 + GuideCard + ko/en 토글 | spec §6.5 |
| 2-H | Confirm 다이얼로그 UX | spec §6.6 |
| 2-I | 초기·에러·invalid 상태 | spec §6.7, §6.8 |

**블로커 아님**: W2 진행 중에도 W1 / W4 는 계속 진행 가능.

---

### W3 — Admin UI (AI, W2 완료 후)

| ID | 내용 | 의존 |
|---|---|---|
| 3-A | 페이지 shell — `app/integration/admin/guides/page.tsx` + `layout.tsx` | 2-A |
| 3-B | Provider tabs 컴포넌트 | 2-B |
| 3-C | Step list panel — slot registry 조회로 행 생성 | 2-C, 1-B |
| 3-D | Tiptap 에디터 컴포넌트 — `next/dynamic` lazy load | 2-D, 2-E |
| 3-E | Editor 언어 탭 상태머신 (ko/en 독립 입력 유지) | 2-E |
| 3-F | Preview panel — GuideCard(pure) 재사용 + 타임라인 + ko/en 토글 | 2-G, 4-A |
| 3-G | "N곳에 표시됩니다" — `findSlotsForGuide(name)` 렌더 | 2-F, 1-B |
| 3-H | 저장 버튼 상태머신 — disabled gate, loading, success, error | 2-E, 1-H |
| 3-I | 미저장 confirm — `beforeunload` + in-app 가드 | 2-H |
| 3-J | 에러 상태 컴포넌트 — `<ErrorState>`, `<GuideCardInvalidState>` | 2-I |
| 3-K | a11y — `role="tablist"`, `aria-live`, 키보드 네비 | spec §10 |

**PR 분할 권장**:
- **W3-a**: 3-A, 3-B, 3-C (shell + tabs + step list)
- **W3-b**: 3-D, 3-E, 3-G, 3-H (editor + save flow)
- **W3-c**: 3-F (preview)
- **W3-d**: 3-I, 3-J, 3-K (confirm + error + a11y)

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
| 5-B | HTML validation 매트릭스 테스트 — 허용/차단 케이스 전수 | 1-C |
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
