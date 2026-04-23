# Guide CMS — 구현 계획 (Implementation Plan)

> **Status**: 🟡 draft (spec 확정 후 재검토)
> **요구사항 문서**: [`requirements-draft.md`](./requirements-draft.md)
> **전제**: Phase 2-2 전 질문 확정 완료 (Q1~Q8)
> **목적**: 사용자 작업(디자인 의존)과 AI 독립 작업의 경계를 명확히 구분. 의존성 없이 병렬로 돌릴 수 있는 부분을 최대화.

---

## 0. 사용자 작업 유형

사용자는 이 프로젝트에서 2가지 작업 유형으로 관여:

| 유형 | 설명 | 이 계획에서의 위치 |
|------|------|-----------------|
| **(a)** Claude Design 에 디자인 시안 요청 → 시안 PR push | 직접 디자인 안 하고 Claude Design 이용 | **W2** (디자인 블로커) |
| **(b)** 시안을 보고 실제 구현 | 시안 기반 컴포넌트 구현 | AI 도 병렬로 수행 가능. 사용자는 검토·리뷰 위주 |

**핵심 원칙**: 사용자가 (a)를 진행하는 동안 AI 는 **디자인 무관한 기반 작업**을 사전에 끝내둬서 시안 도착 즉시 구현 착수.

---

## 1. Wave 분할

### W1. 기반 (AI 독립, 사용자 대기 없음)

**목표**: 디자인 시안 없어도 가능한 모든 것을 선행 완료.

| Task | 내용 | 파일 / 산출물 |
|------|------|--------------|
| **1-A** | TypeScript 타입 정의 | `lib/types/guide.ts` — `GuideName` union, `GuideListItem`, `GuideDetail`, `GuideContent`, `CardPosition`, `CloudProviderGroup` |
| **1-B** | Guide 상수 (42개) | `lib/constants/guide-names.ts` — `GUIDE_NAMES` 배열 |
| **1-C** | Registry (사용처·단계·컴포넌트 매핑) | `lib/constants/guide-registry.ts` — `GUIDE_REGISTRY: Record<GuideName, GuideMeta>` |
| **1-D** | Swagger 계약 | `docs/swagger/guides.yaml` — GET 목록, GET 단건, PUT |
| **1-E** | Mock store | `lib/mocks/guide-store.ts` — in-memory/파일 기반 read/write |
| **1-F** | API route handler | `app/api/v1/guides/route.ts` (GET 목록), `app/api/v1/guides/[name]/route.ts` (GET 단건, PUT). `USE_MOCK_DATA` 분기 |
| **1-G** | sanitize 유틸 | `lib/utils/sanitize-html.ts` — `isomorphic-dompurify` + allow-list (태그 + `data-panel` 속성) |
| **1-H** | seed 마이그레이션 스크립트 | `scripts/migrate-guides-to-html.ts` — 기존 `lib/constants/process-guides.ts` 525줄 구조 → 42개 HTML content 초기값 |
| **1-I** | BFF client 네임스페이스 | `lib/bff/client.ts` 확장 — `client.guides.list()`, `client.guides.get(name)`, `client.guides.put(name, body)` |
| **1-J** | `useGuide(name)` 훅 (data layer만) | `app/hooks/useGuide.ts` — `SWR` 기반 단건 조회, fallback 로직 포함. 렌더링 컴포넌트는 W3/W4 |

**의존성**: 1-A → 나머지 전부 선행. 1-B / 1-G / 1-D 는 1-A 이후 서로 병렬. 1-E / 1-F 는 1-B·1-D 이후. 1-H 는 1-B 이후 독립.

**산출 PR 권장 분리**:
- PR-W1-a: 1-A, 1-B, 1-C, 1-D (**타입 + 상수 + Swagger** — 리뷰 용이)
- PR-W1-b: 1-E, 1-F, 1-G, 1-I (**API 레이어**)
- PR-W1-c: 1-H, 1-J (**seed + 훅**)

**예상 LOC**: 전체 ~800 LOC, PR 당 ~200-300

---

### W2. 디자인 시안 (사용자 주도, AI 대기)

**목표**: UI 비주얼 확정. 사용자가 Claude Design 에 요청.

| Task | 시안 대상 | 상태 기반 문서 |
|------|----------|--------------|
| **2-A** | **Admin 목록 페이지** | requirements §3-sexies 목록 레이아웃 + 컬럼 4개 (step / cloud_provider / guide_name / card_position) |
| **2-B** | **Admin 편집 페이지** | requirements §3-sexies 편집 메타 헤더 + Q5 좌우 split + ko/en 탭 + 탭별 승인 버튼 + 저장 버튼 |
| **2-C** | **Panel 매크로 스타일 4종** | `[data-panel="info"]` / `warning` / `note` / `success` — 색상 박스 디자인. requirements §3-bis-α Panel |
| **2-D** | **Preview 영역 Process 타임라인** | 7단계 compact 타임라인 + 현재 단계 하이라이트. requirements Q5 |
| **2-E** | **Tiptap 에디터 툴바** | 필수 10 + Panel 4 + 선택 5 = 19개 버튼 배치 |

**산출물**: Claude Design 으로부터 받은 시안 스크린샷 / HTML / 컴포넌트 구조. PR 로 올려 이 계획에 링크.

**블로커 아님**: 이 단계가 진행 안 되어도 W1 / W4 는 계속 진행 가능.

---

### W3. 시안 기반 구현 (AI, W2 완료 후)

**목표**: W2 시안을 React 컴포넌트로 변환.

| Task | 내용 | Depends on |
|------|------|-----------|
| **3-A** | Admin 목록 페이지 (`/admin/guides`) | 2-A |
| **3-B** | Admin 편집 페이지 라우트 (`/admin/guides/[name]`) + 메타 헤더 | 2-B |
| **3-C** | Tiptap 에디터 + Panel extension (커스텀 node) | 2-C, 2-E |
| **3-D** | ko/en 탭 + 탭별 승인 버튼 + 저장 버튼 상태머신 | 2-B |
| **3-E** | Preview 영역 (Process 타임라인 + GuideCard 실시간 렌더) | 2-D, 4-A |
| **3-F** | Panel CSS 적용 (`@tailwindcss/typography` prose + `[data-panel]` 스타일) | 2-C |

**산출 PR 권장 분리**:
- PR-W3-a: 3-A (목록 페이지) — 독립
- PR-W3-b: 3-B, 3-D (편집 shell + 탭 상태머신)
- PR-W3-c: 3-C, 3-F (Tiptap + Panel 스타일)
- PR-W3-d: 3-E (Preview)

---

### W4. 기존 사용처 전환 (AI, W1 완료 후 — W3 과 병렬 가능)

**목표**: 5개 provider 페이지가 새 API 를 쓰도록 교체.

| Task | 내용 | Depends on |
|------|------|-----------|
| **4-A** | `GuideCard` 리팩토링 — `content: { title, body: HTMLString }` prop 받도록 | 1-A, 1-G |
| **4-B** | 5 provider 페이지 교체 — `getProcessGuide()` → `useGuide(name)` | 4-A, 1-J |
| **4-C** | 기존 `process-guides.ts` 525줄 deprecate 마킹 + 점진적 제거 | 4-B |

**중요**: W4 는 W3 과 **디자인 의존 없이** 병렬 가능. GuideCard 내부 prop 교체만으로 충분. 시각적 변화 없음.

**예상 LOC**: ~400 LOC (주로 -값 / diff)

---

### W5. QA · 마무리

| Task | 내용 | Depends on |
|------|------|-----------|
| **5-A** | 통합 테스트 — 목록 조회 → 편집 → 저장 → 재조회 플로우 | W3, W4 |
| **5-B** | README / ADR — API 스펙 링크, source-of-truth 정책, 새 가이드 추가 절차 | W3 |
| **5-C** | 사용자 검수 + 시그널 오프 | 전부 |

---

## 2. 의존성 그래프 (시각)

```
시간 →

W1 (AI 독립)     ▓▓▓▓▓▓▓▓▓▓
  ├─ 1-A/B/C ▓▓▓
  ├─ 1-D/G   ▓▓▓
  ├─ 1-E/F/I ▓▓▓▓
  └─ 1-H/J   ▓▓▓

W2 (사용자)       ▓▓▓▓▓▓▓ ← 사용자 주도. AI 대기 (but W4 동시 진행)
     (디자인 시안)

W4 (AI, W1 후)    ▓▓▓▓▓▓ ← W3 블로커 아님. 디자인 무관.

W3 (AI, W2 후)         ▓▓▓▓▓▓▓▓▓▓▓▓▓

W5 (QA)                             ▓▓▓
```

### 사용자 관여 최소화 지점

- **W1 전체**: 사용자 개입 없이 AI 가 끝까지 수행 가능 (PR 리뷰만 필요)
- **W4 전체**: 동일 — 디자인 의존 없음
- **W2 만 사용자 주도** — 여기서 AI 는 대기 (단, 시안 피드백 제공 가능)
- **W3 는 시안 수신 직후 AI 착수**

---

## 3. "사용자 대기 없이" 착수 가능한 태스크 (W1 + W4)

AI 가 바로 시작 가능한 것들 — **디자인 시안·사용자 의사결정 불필요**:

| Task | 왜 독립인가 |
|------|------------|
| 1-A 타입 정의 | requirements 확정 스펙 기반 |
| 1-B `GUIDE_NAMES` 42개 | 이름 규칙 확정 |
| 1-C `GUIDE_REGISTRY` | 기존 코드 구조 자동 매핑 |
| 1-D Swagger | API 스펙 확정 |
| 1-E Mock store | 비주얼 무관 |
| 1-F API route handler | 비주얼 무관 |
| 1-G sanitize 유틸 | allow-list 확정 |
| 1-H seed 마이그레이션 | HTML 변환 로직 — 비주얼 무관 |
| 1-I BFF client | 계약 기반 |
| 1-J `useGuide` 훅 (data layer) | 렌더링 없음 |
| 4-A `GuideCard` prop 리팩토링 | 내부 prop 교체 — 렌더 결과 동일 |
| 4-B 5 provider 페이지 교체 | API 호출 교체 — 시각 변화 없음 |
| 4-C 기존 상수 deprecate | 코드 청소 |

= **13개 태스크가 사용자 작업 대기 없이 돌릴 수 있는 물량**.

---

## 4. 디자인 의존 태스크 (W2 완료 필요)

AI 가 기다려야 하는 것들:

| Task | 왜 의존인가 | 대기 풀리는 순간 |
|------|-----------|---------------|
| 3-A 목록 페이지 | 테이블·탭·필터 비주얼 필요 | 2-A 시안 확정 |
| 3-B 편집 메타 헤더 | 레이아웃·배지·버튼 위치 | 2-B 시안 확정 |
| 3-C Tiptap + Panel | 툴바 비주얼 + Panel 박스 색상 | 2-C, 2-E 시안 확정 |
| 3-D ko/en 탭 + 승인 버튼 | 탭 전환 UI + 완료 배지 디자인 | 2-B 시안 확정 |
| 3-E Preview | Process 타임라인 비주얼 | 2-D 시안 확정 |

---

## 5. 완료 기준

- [ ] W1 전 태스크 PR 머지 (API + mock + seed 동작)
- [ ] W2 디자인 시안 PR 확정 (사용자 주도)
- [ ] W3 시안 기반 UI 구현 완료
- [ ] W4 5 provider 페이지 API 전환 완료
- [ ] W5 통합 QA 통과
- [ ] 기존 `lib/constants/process-guides.ts` 제거 또는 deprecate
- [ ] Admin `/admin/guides` 경로 접근 가능

---

## 6. 리스크 / 완화

| 리스크 | 완화 |
|--------|------|
| W2 시안 지연 | W1/W4 를 선행해서 대기 시간 최소화 |
| seed 마이그레이션 결과 퀄리티 (기존 상수 → HTML 변환 품질) | 사용자 검수 체크포인트 1개 (1-H 직후 샘플 5개 확인) |
| 기존 GuideCard 리팩토링 후 회귀 | 5 provider 페이지 스크린샷 비교 QA (5-A) |
| ko/en 양쪽 편집 부담 증가 | seed 시점에 en 은 **빈 상태로 두지 않고** 기계번역(ko) 또는 "번역 필요" placeholder 주입 고려 — 사용자 결정 필요 |

---

## 7. 열린 질문 (spec 승격 전 해소 권장)

- [ ] seed 마이그레이션 시 en 초기값을 어떻게 할까? (빈 상태 / ko 복제 / 기계번역 / placeholder)
- [ ] 이미지 URL allow-list 정책 (어느 도메인 허용할지)
- [ ] Admin 권한 체크 — 현재 인증 체계에서 누구나 `/admin/guides` 접근 가능한가? 별도 권한 미들웨어 필요한가?
- [ ] PUT 동시 편집 충돌 — 낙관적 락 (`updatedAt` 기반 If-Match) 채택 여부

---

## 8. Todo Checklist

진행 상태 추적용 체크리스트. 각 항목의 owner 는 🤖 AI / 👤 사용자 / 🤝 협업.

### Phase 0 · 계획 완결 (현재 단계)

**Blocker 결정 — W1 시작 전 필수**
- [ ] 👤 Q-B1 seed HTML 변환 규칙 승인 (heading/summary/bullets/procedures/warnings/notes 매핑)
- [ ] 👤 Q-B2 en 초기값 (빈 / ko 복제 / placeholder / 기계번역)
- [ ] 👤 Q-B3 step 4 variant-specific stepLabel 42개 개별 복사 확인
- [x] 👤 Q-B4 기존 상수 삭제 방침 — **즉시 삭제 (W4-C)** 확정 (2026-04-23)
- [ ] 👤 Q-B5 사전조치(PREREQ_*) 처리 — 상수 분리 유지 / CMS 스콥 확장 / UI 제거

**Important 결정 — W3 시작 전 필수**
- [ ] 👤 Q-I1 저장 후 피드백 (토스트 / 목록 이동 / 토스트만)
- [ ] 👤 Q-I2 미저장 이탈 경고 (beforeunload)
- [ ] 👤 Q-I3 Preview 디바운스 주기 (0 / 200ms / 500ms)
- [ ] 🤝 Q-I4 Admin 권한 체크 — 현재 인증 체계 확인 후 정책 결정
- [ ] 👤 Q-I5 Process 타임라인 다른 단계 클릭 동작
- [ ] 👤 Q-I6 en 편집 시 ko 참조 UI 필요 여부

**스콥 재확인**
- [ ] 👤 N7 이미지 툴바 MVP 포함 여부 재확인 (도메인 allow-list 부재 리스크)

**문서 승격**
- [ ] 🤖 `requirements-draft.md` → `spec.md` 승격 (Blocker 답 반영 후)
- [ ] 🤖 `docs/swagger/guides.yaml` 초안 작성 (1-D)
- [ ] 🤖 `docs/reports/guide-cms/data-model.md` 생성 (타입 + 변환 매핑)

---

### W1 · 기반 구현 (🤖 AI 독립)

**PR-W1-a: 타입 + 상수 + Swagger**
- [ ] 🤖 1-A `lib/types/guide.ts` (`GuideName` union, `GuideListItem`, `GuideDetail`, `GuideContent`, `CardPosition`, `CloudProviderGroup`)
- [ ] 🤖 1-B `lib/constants/guide-names.ts` — 42개 `GUIDE_NAMES as const`
- [ ] 🤖 1-C `lib/constants/guide-registry.ts` — `Record<GuideName, GuideMeta>` (provider/stepNumber/stepLabel/component/usedIn)
- [ ] 🤖 1-D `docs/swagger/guides.yaml` — GET 목록 / GET 단건 / PUT
- [ ] 👤 PR-W1-a 리뷰 & 머지

**PR-W1-b: API 레이어**
- [ ] 🤖 1-E `lib/mocks/guide-store.ts` — in-memory/파일 기반 read/write
- [ ] 🤖 1-F `app/api/v1/guides/route.ts` + `app/api/v1/guides/[name]/route.ts` — USE_MOCK_DATA 분기
- [ ] 🤖 1-G `lib/utils/sanitize-html.ts` — DOMPurify allow-list (태그 + `data-panel` 속성)
- [ ] 🤖 1-I `lib/bff/client.ts` 확장 — `client.guides.{list,get,put}`
- [ ] 👤 PR-W1-b 리뷰 & 머지

**PR-W1-c: seed + 훅**
- [ ] 🤖 1-H `scripts/migrate-guides-to-html.ts` — 기존 `process-guides.ts` → 42개 HTML 초기값
- [ ] 🤝 1-H 결과 샘플 5개 검수 (사용자 체크포인트)
- [ ] 🤖 1-J `app/hooks/useGuide.ts` — SWR 기반 단건 조회 + fallback
- [ ] 👤 PR-W1-c 리뷰 & 머지

---

### W2 · 디자인 시안 (👤 사용자 주도 · Claude Design)

- [ ] 👤 2-A 목록 페이지 시안 요청 (Provider 탭·테이블·검색)
- [ ] 👤 2-B 편집 페이지 시안 요청 (메타 헤더·ko/en 탭·승인 버튼·저장 버튼·좌우 split)
- [ ] 👤 2-C Panel 4종 스타일 시안 (`[data-panel="info|warning|note|success"]`)
- [ ] 👤 2-D Process 타임라인 compact 시안 (7단계 + 현재 단계 하이라이트)
- [ ] 👤 2-E Tiptap 툴바 버튼 19개 배치 시안
- [ ] 👤 시안 PR push — 링크를 implementation-plan 에 추가

---

### W3 · 시안 기반 구현 (🤖 AI · W2 완료 후)

**PR-W3-a: 목록 페이지**
- [ ] 🤖 3-A `/admin/guides` 페이지 + 테이블 + Provider 탭 + 검색
- [ ] 👤 PR-W3-a 리뷰 & 머지

**PR-W3-b: 편집 페이지 shell + 탭 상태머신**
- [ ] 🤖 3-B `/admin/guides/[name]` 라우트 + 메타 헤더
- [ ] 🤖 3-D ko/en 탭 + "작성 완료 ✓" 버튼 + 저장 버튼 상태머신
- [ ] 👤 PR-W3-b 리뷰 & 머지

**PR-W3-c: Tiptap + Panel extension**
- [ ] 🤖 3-C Tiptap 에디터 + 커스텀 Panel node (`data-panel`)
- [ ] 🤖 3-F Panel CSS (`@tailwindcss/typography` prose + `[data-panel]` 스타일)
- [ ] 👤 PR-W3-c 리뷰 & 머지

**PR-W3-d: Preview**
- [ ] 🤖 3-E Preview 영역 (Process 타임라인 + GuideCard 실시간 렌더 + ko/en 토글 + Process 접기)
- [ ] 👤 PR-W3-d 리뷰 & 머지

---

### W4 · 기존 사용처 전환 (🤖 AI · W1 후, W3 과 병렬)

**PR-W4-a: GuideCard + 사용처 전환**
- [ ] 🤖 4-A `GuideCard` 리팩토링 — `content: { title, body: HTMLString }` prop
- [ ] 🤖 4-B 5 provider 페이지 — `getProcessGuide()` → `useGuide(name)` 교체
- [ ] 🤝 5 provider 페이지 시각 회귀 QA (스크린샷 비교)
- [ ] 👤 PR-W4-a 리뷰 & 머지

**PR-W4-b: 기존 상수 완전 삭제 (Q-B4 = A 확정)**
- [ ] 🤖 4-C-1 사전조치 분리 — `lib/constants/prerequisite-guides.ts` 신규 (Q-B5 답에 따름)
  - Q-B5 = A 시: `SCAN_ROLE_GUIDE` / `DB_CREDENTIAL_GUIDE` / `TF_EXECUTION_ROLE_GUIDE` 3종 + 참조하는 컴포넌트 import 경로 업데이트
  - Q-B5 = B 시: 사전조치도 CMS 에 포함 (스콥 확장, W1 의 `GUIDE_NAMES` 45개로 증가)
  - Q-B5 = C 시: 사전조치 UI 제거
- [ ] 🤖 4-C-2 `lib/constants/process-guides.ts` **파일 통째 삭제** (525줄)
- [ ] 🤖 4-C-3 `lib/types/process-guide.ts` 정리 — `GuideInline` / `StepGuideContent` / `ProviderProcessGuide` 삭제. `PrerequisiteGuide` / `ProcessGuideStep`(축소판) 유지
- [ ] 🤖 4-C-4 이전 export 를 import 하던 파일 전수 정리 (컴파일 에러 fix)
- [ ] 🤖 4-C-5 `lib/mocks/mock-idc.ts`, `lib/mocks/azure-catalog.ts` 등 기존 import 없는지 grep 확인
- [ ] 👤 PR-W4-b 리뷰 & 머지

---

### W5 · QA · 마무리

- [ ] 🤖 5-A 통합 테스트 — 목록 조회 → 편집 → 저장 → 재조회 전체 플로우
- [ ] 🤖 5-B README + ADR 업데이트 (API 스펙, SoT 정책, 새 가이드 추가 절차)
- [ ] 🤝 5-C 사용자 최종 검수 + 사인오프
- [ ] 🤖 worktree 정리

---

### 후속 wave (이번 MVP 스콥 외)

- [ ] PREREQ_* 3개 가이드 편집 추가 (`card_position: "prerequisite"`)
- [ ] 이미지 업로드 + 도메인 allow-list (N7)
- [ ] 편집 이력 / 감사 로그 (N1)
- [ ] 낙관적 락 동시 편집 방어 (N3)
- [ ] End-user UI 전체 i18n 승급 (Q6 → C)

---

## 9. 참조

- 요구사항 문서: [`requirements-draft.md`](./requirements-draft.md)
- Swagger: (예정) `docs/swagger/guides.yaml`
- 기존 상수: `lib/constants/process-guides.ts` (525줄)
- 기존 타입: `lib/types/process-guide.ts`
- GuideCard: `app/components/features/process-status/GuideCard.tsx`
- 사용처 (5곳): `app/projects/[projectId]/{aws,azure,gcp,idc,sdu}/*ProjectPage.tsx`
