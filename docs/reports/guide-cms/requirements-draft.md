# Guide CMS — 요구사항 명세 (Draft)

> **Status**: 🟡 Q1 / Q4 답변 대기 중 (Q2·Q3·Q5·Q6·Q8 확정, Q7 자동 해소)
> **작성일**: 2026-04-23
> **최근 업데이트**: 2026-04-23 — Q5 확정: 좌우 split + Process 타임라인(접힘) + GuideCard 실제 렌더 + ko/en 토글. ProcessGuideModal 미리보기는 스콥 제외.
> **Owner**: @chulyonga
> **목적**: `GuideCard` / `ProcessGuideModal` 이 참조하는 가이드 데이터를 **API 기반**으로 전환하고, **Admin 편집 페이지**에서 HTML로 수정 가능하게 만드는 기능 명세.
>
> **선결 확정 사항**:
> - 기본 언어 = `ko`, 영어 부재 시 한국어 fallback
> - **Q6 = A** (가이드 콘텐츠만 다국어, end-user UI·Admin UI는 한국어 고정)
> - **Q8 = B** (API 응답에 ko/en 동시 포함, 클라이언트가 언어 선택 + fallback)

---

## 0. 사용자 원문 요구 (재구성)

1. `GuideCard` 등 가이드를 보여주는 컴포넌트가 현재는 **constant** 기반이다. 이를 **API 호출**로 전환하고 싶다.
2. 조회 형태 예시: `API/?guide_name=AZURE_연동대상확정중` (이름으로 단건 조회).
3. **Admin 페이지 일부**로 가이드를 **수정·확인** 할 수 있는 화면이 필요하다.
4. 편집 화면에서는 `GuideCard` 와 `Process` 가 **기존에 사용되던 형태 그대로 미리보기**로 보여야 한다.
5. 가이드는 **기본적으로 HTML 방식으로 수정 가능**해야 한다.
6. **한글/영어 모두 지원** 해야 한다. **기본 언어는 한국어(`ko`)** — 영어 콘텐츠 부재 시 한국어로 fallback. (2026-04-23 추가)

---

## 1. 현황 (Phase 1)

### 1.1 GuideCard 컴포넌트
- 위치: `app/components/features/process-status/GuideCard.tsx`
- Props: `currentStep: ProcessStatus`, `provider: CloudProvider`, `installationMode?: AwsInstallationMode`
- 내부에서 `getProcessGuide(provider, variant)` 를 호출해 현재 step의 `guide: StepGuideContent` 를 뽑아 렌더.
- 렌더 구조: `heading` → `summary[]` → `bullets[][]`
- **사용처 (5곳)**:
  - `app/projects/[projectId]/aws/AwsProjectPage.tsx`
  - `app/projects/[projectId]/azure/AzureProjectPage.tsx`
  - `app/projects/[projectId]/gcp/GcpProjectPage.tsx`
  - `app/projects/[projectId]/idc/IdcProjectPage.tsx`
  - `app/projects/[projectId]/sdu/SduProjectPage.tsx`

### 1.2 가이드 상수 (525줄)
- 파일: `lib/constants/process-guides.ts`
- **`DEFAULT_STEP_GUIDES`**: 7단계 공통 (확정 → 승인대기 → 반영 → 설치 → 테스트 → 승인 → 완료)
- **Provider 가이드 (6종)**: `AWS_AUTO`, `AWS_MANUAL`, `AZURE`, `GCP`, `IDC`, `SDU`
- **사전조치 가이드 (3종)**: `SCAN_ROLE_GUIDE`, `DB_CREDENTIAL_GUIDE`, `TF_EXECUTION_ROLE_GUIDE`
- 타입(`lib/types/process-guide.ts`):
  ```ts
  GuideInline = string | { strong: string } | { link: string; href: string }
  StepGuideContent = { heading; summary: GuideInline[]; bullets: GuideInline[][] }
  ProcessGuideStep = {
    stepNumber, label, description,
    prerequisiteGuides?, procedures?, warnings?, notes?, guide?: StepGuideContent
  }
  ProviderProcessGuide = { provider, variant, title, steps: ProcessGuideStep[] }
  ```
- 공개 API: `getProcessGuide(provider, variant?)`, `getProcessGuideVariants(provider)`

### 1.3 Process 컴포넌트
| 컴포넌트 | 역할 |
|----------|------|
| `ProcessGuideModal` | 좌: 타임라인 / 우: 단계별 카드. 전체 프로세스 개관 모달 |
| `ProcessGuideStepCard` | 사전조치 아코디언 + 절차/주의사항/참고사항 섹션 |
| `StepGuide` | 단계별 한 줄 요약 + 아이콘 |

### 1.4 Admin 인프라
- 라우트: `app/integration/admin/` (layout.tsx, page.tsx)
- 기존 메뉴: **Dashboard** (`admin/dashboard/page.tsx`) — KPI + 시스템 목록
- 레이아웃 컴포넌트: `AdminHeader`, `ServiceSidebar` 재사용 가능
- API routes: `api/v1/admin/dashboard/{summary,systems,systems/export}`
- **가이드 관련 admin 화면·API 모두 없음** → 신규

### 1.5 BFF Client
- `lib/api-client/bff-client.ts` (Next.js → upstream BFF proxy)
- `lib/bff/client.ts` 네임스페이스 패턴: `client.projects`, `client.dashboard`, `client.confirm`
- **guide 관련 네임스페이스 없음** → 신규 `client.guides`

### 1.6 HTML 렌더링 / Editor 현황
- 의존성: **tiptap / lexical / quill / slate 전부 없음**
- `dangerouslySetInnerHTML`: Swagger UI 1곳만 (`app/integration/swagger/[swaggerFileName]/page.tsx`)
- sanitizer: 설치되지 않음 → HTML 렌더 시 `isomorphic-dompurify` 등 신규 필요

---

## 2. 요구사항 ↔ 현재 상태 갭 분석 (Phase 2-1)

| # | 요구사항 | 현재 | 갭 | 필요 작업 |
|---|---------|------|-----|----------|
| R1 | `API/?guide_name=…` 로 조회 | `getProcessGuide(provider, variant)` 정적 함수 | API 엔드포인트 / mock / client 없음 | `/api/v1/guides?name=…` 라우트 + mock store + `client.guides.get(name)` |
| R2 | HTML로 편집 | JSON 구조(`GuideInline`, `summary[]`, `bullets[][]` …) | **HTML vs JSON 포맷 결정 필요** | 데이터 모델 재설계 (Q2) |
| R3 | Admin 편집 페이지 | Admin shell만 존재, 가이드 메뉴 없음 | 목록 / 편집 / 저장 UI 전체 신규 | `/admin/guides/*` 라우트 + 목록·편집 컴포넌트 |
| R4 | GuideCard + Process 미리보기 | 상수에 묶여 있어 임의 데이터 주입 불가 | 편집 중인 값을 컴포넌트에 주입하는 preview 구조 필요 | 미리보기 프레임 + data prop 분리 리팩토링 |
| R5 | 기존 사용처 자연스러운 전환 | 5개 provider 페이지가 `getProcessGuide()` 직접 호출 | data-fetch 흐름 교체 필요 | `useGuide(name)` 훅 신설, 기존 호출부 교체 |
| R6 | **한글/영어 다국어** (default=ko, en 없으면 ko fallback) | 현재 UI·상수 모두 한국어 전용, i18n 인프라 부재 | 데이터 모델·API·편집 UI 모두에 언어 차원 추가 | 다국어 스키마 + 언어 선택 메커니즘 + Admin 언어 탭 (Q6~Q8) |

---

## 3. 꼭 답해주셔야 할 핵심 결정 (Phase 2-2)

### Q1. 가이드 식별자(guide_name) 형식

> 사용자 예시 `AZURE_연동대상확정중` 이 실제 키가 될지 확정 필요.
> AWS는 variant(AUTO/MANUAL)가 있고, 사전조치(SCAN_ROLE 등) 별도 단위도 있음.

| 선택지 | 장점 | 단점/제약 |
|--------|------|----------|
| **A.** `AZURE_연동대상확정중` (한글 상태명 그대로) | 사용자 직관, URL에서 의미 바로 보임 | URL 인코딩 필요, 오타/공백 위험, AWS variant 표현 애매(`AWS_AUTO_…`?) |
| **B.** `azure.step3`, `aws.auto.step3` (영문 code) | 파일명/DB key 안전, variant 자연스럽게 표현 | UI에서 "이게 뭔지" 한번 더 매핑 필요 |
| **C.** 두 개 다 — DB key는 B, **표시·URL 쿼리는 A**를 alias 허용 | 양쪽 장점 | 매핑 테이블 유지 부담 |
| **D.** 직접 제안 | — | — |

💡 **추천: C** — 사용자 의도(`AZURE_연동대상확정중`)와 내부 stable key를 둘 다 살릴 수 있음.

> ⚠️ **다국어 영향 (2026-04-23)**: 한글 상태명을 키로 노출하면 영어 UI에서 URL이 어색해짐 (`/admin/guides/AZURE_연동대상확정중` vs `/admin/guides/azure.step3`). **다국어 요구가 추가됨에 따라 추천이 C → B로 기울 수 있음.** 최종 판단은 Q6 결정과 함께 해야 함.
> - B(영문 code) 채택 시: UI 표시는 별도 label 필드(`title.ko`, `title.en`)로 해결
> - C 유지 시: 한글 alias는 ko 전용 UX sugar로만 사용 (영어 UI에서는 숨김)

**답변**: _(대기)_

---

### Q2. HTML 편집 "범위"

> 한 스텝 데이터는 `heading / summary[] / bullets[][] / procedures[] / warnings[] / notes[] / prerequisiteGuides[]` 7종. HTML로 바꿀 때 어디까지 합칠지가 데이터 모델을 결정.

| 선택지 | 장점 | 단점/제약 |
|--------|------|----------|
| **A.** **한 덩어리 HTML** (`body: string`만 보관) | 편집기 하나로 끝, 자유도 최대 | GuideCard/Modal의 기존 레이아웃(불릿/주의사항 박스/링크 스타일)을 CSS로만 재현. 사전조치 아코디언 같은 구조적 UI는 포기 |
| **B.** **필드별 HTML** (`heading:string`, `summaryHtml`, `bulletsHtml`, `warningsHtml`, `notesHtml` …) | 기존 레이아웃/컴포넌트 유지, 섹션별 의미 분명 | 편집 UI에 input이 6~7개, 빈 섹션 처리 규칙 필요 |
| **C.** **하이브리드** — 상위 구조(steps, 사전조치 목록)는 JSON 유지, **각 섹션 본문만 HTML** | 기존 ProcessGuideModal/사전조치 아코디언 그대로. 편집자는 "텍스트만" HTML 자유 편집 | 데이터 스키마 가장 복잡 |
| **D.** 직접 제안 | — | — |

💡 **추천: C** — R4("기존에 사용되던 형태")와 정확히 맞고, 525줄 상수의 의미 있는 분류(warnings/notes/prerequisites)를 버리지 않음.

**답변**: _(대기)_

---

### Q3. HTML 편집 UX

> "기본적으로 HTML 방식" 이라고 하셨는데, raw 태그를 직접 치는 쪽인지 확인 필요.

| 선택지 | 장점 | 단점/제약 |
|--------|------|----------|
| **A.** **Raw HTML textarea** (syntax highlight 없음) | 의존성 0, 구현 가장 빠름, 사용자 의도에 가장 충실 | `<a>`, `<ul>` 정도는 괜찮지만 긴 문서 편집은 피곤 |
| **B.** **코드 에디터** (Monaco / CodeMirror 경량) | HTML 하이라이트/인덴트, 여전히 "HTML 직접 편집" 성격 유지 | 번들 사이즈 (+수백 KB) |
| **C.** **WYSIWYG** (Tiptap 등) | 비개발자도 편집 가능 | 의존성 추가, 결과 HTML이 editor에 종속(복잡 마크업 삽입), "HTML 방식"이라는 원문과 거리 |
| **D.** 직접 제안 | — | — |

💡 **추천: A** 로 MVP → 불편하면 B — 사용자 원문 그대로 해석. XSS 방지를 위해 서버/클라이언트 어디서든 **sanitize 필수** (`isomorphic-dompurify` ~40KB 권장).

**답변**: _(대기)_

---

### Q4. 저장소 (이번 스콥에서 어디까지)

> 이 레포는 기본 `USE_MOCK_DATA` 모드이고 BFF는 proxy만 함. 편집 **저장**까지 이번 스콥에 넣을지 결정.

| 선택지 | 장점 | 단점/제약 |
|--------|------|----------|
| **A.** **Mock only** — 파일시스템/메모리 JSON store, 읽기·쓰기 모두 mock | 독립 구현 가능, 백엔드 블로커 없음, Swagger 계약만 잘 만들면 됨 | 실 운영은 이후 BFF 연동 wave 필요 |
| **B.** **Mock 읽기 + Swagger 계약 작성까지** — 쓰기는 "400 Not implemented" | 읽기 API 흐름만 정착, 백엔드 스펙 공유 용이 | Admin 편집이 실질적으로 저장 안 되는 상태 |
| **C.** 실 BFF 연결 포함 | 완성도 최고 | 백엔드 작업 의존, 스콥 폭증 |
| **D.** 직접 제안 | — | — |

💡 **추천: A** — 레포의 Mock-first 관행과 일치. 편집 플로우 전체를 바로 검증 가능. 프로세스 재시작 시 초기화되지만 MVP 확인에는 충분.

**답변**: _(대기)_

---

### Q5. Admin 편집 페이지의 미리보기 범위

> "GuideCard와 Process는 기존에 사용되던 형태를 미리보기" — 화면당 몇 개의 미리보기를 띄울지가 레이아웃 결정.

| 선택지 | 장점 | 단점/제약 |
|--------|------|----------|
| **A.** **탭 전환** — `[GuideCard 미리보기]` `[ProcessGuideModal 미리보기]` 2개 탭 | 화면 넓게 쓸 수 있고, 각 미리보기 충실 | 한눈에 동시 비교 불가 |
| **B.** **좌/우 split** — 좌: 편집기, 우상: GuideCard, 우하: ProcessGuideModal | 동시 비교 가능 | 화면 비좁음, ProcessGuideModal은 원래 큰 모달이라 축소 렌더 시 왜곡 |
| **C.** **편집기 위 · 미리보기 아래 2단** — 미리보기는 토글(GuideCard ↔ Modal) | 세로 스크롤 여유, 편집 집중 | 동시 비교 불가 |
| **D.** 직접 제안 | — | — |

💡 **추천: A** — 데스크탑 전용이지만 ProcessGuideModal은 원래 전체화면 급이라 축소 렌더링하면 의미가 죽음. 탭 전환이 R4("실제 사용되던 형태 그대로")에 가장 충실.

**답변**: ✅ **확정** (2026-04-23) — "프로세스 항목 아래에 가이드 페이지 이렇게 보여지는거야. 아니면 그냥 가이드 Card만 보여져도 되고"

#### 확정 레이아웃

**전체 페이지 구조 — 좌우 split (편집 vs 미리보기)**

```
┌──────────────────────────────────────────────────────────────┐
│  Admin 편집 페이지                                             │
├──────────────────────────────────────────────────────────────┤
│  왼쪽 (50%)                │  오른쪽 (50%) — Preview          │
│  ─────────────             │  ─────────────                   │
│  편집기 (Tiptap Visual)    │  [ko] [en]   [Process 접기 ▾]    │
│  [B] [I] ...               │  ● ─ ● ─ ◉ ─ ○ ─ ○ ─ ○ ─ ○       │
│                            │  1   2   3   4   5   6   7       │
│                            │  ─────────────                   │
│                            │  ┌────────────────────┐          │
│                            │  │  GuideCard         │          │
│                            │  │  (실제 렌더)        │          │
│                            │  │  [heading]         │          │
│                            │  │  summary           │          │
│                            │  │  • bullet          │          │
│                            │  │  [⚠️ warning]       │          │
│                            │  └────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

**간단 모드 (Process 접힌 상태)**

```
[Process 접기 ▲]  ← 클릭하면 타임라인 숨김
┌────────────────────┐
│  GuideCard         │  ← 편집에 집중하고 싶을 때
│  (실제 렌더)        │
└────────────────────┘
```

#### 구성 요소

| 영역 | 설명 |
|------|------|
| **Process 타임라인 (상단)** | 7단계 중 현재 편집 단계 `◉` 강조. compact한 단일 라인. "이 가이드가 어느 단계에 속하는지" 맥락 제공 |
| **GuideCard (하단)** | 실제 end-user 화면에 렌더되는 그대로. 디자인 토큰·Panel CSS 모두 적용한 최종 형태 |
| **언어 토글 `[ko] [en]`** | Preview 영역 상단. Q8=B(응답에 ko/en 동시) 덕에 재요청 없이 즉시 전환 |
| **Process 접기 버튼** | 타임라인 숨김 → GuideCard만 보기. 사용자 허용 간단 모드 |
| **ProcessGuideModal 미리보기** | **이번 스콥 제외** — 사용자가 "가이드 Card만 보여져도 OK" 로 간소화 허용. 필요 시 후속 wave |

#### Preview의 데이터 주입 흐름

```
사용자 Tiptap 편집
     ↓ (onUpdate)
편집 중 HTML 문자열
     ↓
sanitize (DOMPurify)
     ↓
GuideCard 컴포넌트에 prop 주입 (실제 컴포넌트 재사용)
     ↓
Preview 영역에 실시간 렌더
```

→ 미리보기는 "장식용 mockup" 이 아니라 **실제 `GuideCard` 컴포넌트를 그대로 재사용**. 따라서 운영 환경과 1:1 일치 보장. 이를 위해 `GuideCard` 를 `content: HTMLString` 을 받는 형태로 약간 리팩토링 필요.

---

## 3-bis. 다국어(i18n) 관련 결정 — Q6~Q8 (2026-04-23 추가)

> 선결 확정 사항:
> - **기본 언어 = `ko`** (한국어)
> - **영어 콘텐츠 부재 시 한국어로 fallback**

### Q6. 다국어 적용 범위

> 어디까지 다국어로 만들지에 따라 작업량과 영향 범위가 크게 달라짐. 현재 CLAUDE.md에 "한국어 UI" 로 명시되어 있어, end-user UI 전체 i18n은 별도 프로젝트급 작업이 됨.

| 선택지 | 장점 | 단점/제약 |
|--------|------|----------|
| **A.** **가이드 콘텐츠만** 다국어 (end-user UI chrome·Admin UI는 한국어 고정) | 최소 스콥, 이번 기능 본질에 집중 | 영어 사용자가 보는 화면은 가이드 본문만 영어, 주변 UI는 한국어 → 혼재 |
| **B.** **가이드 콘텐츠 + Admin UI** 다국어 (end-user UI는 한국어 고정) | Admin 편집자가 영문 현지화 전체 워크플로우로 검토 가능 | Admin UI 문자열만 i18n 처리 (중간 규모) |
| **C.** **전체 다국어** — end-user UI까지 포함 | 완전한 이중언어 제품 | `next-intl` / `next-i18next` 급 인프라 도입, 기존 5개 provider 페이지·모든 컴포넌트 문자열 추출. **스콥 폭증** |
| **D.** 직접 제안 | — | — |

💡 **추천: A** — 사용자 원문 요구는 "가이드" 다국어에 한정됨. end-user UI i18n은 별개의 큰 결정(기획/법무/마케팅 개입 필요). 이번은 **콘텐츠 CMS의 다국어 대응**에 집중하고, UI i18n은 별도 wave로 분리하는 게 건전함.

**답변**: ✅ **A** (2026-04-23) — "가이드 컨텐츠만 수행할거야"

---

### Q7. 언어 선택 방식 (누가·언제·어떻게 `en`을 고르나)

> end-user 가 가이드를 볼 때 어떤 언어로 렌더할지 결정하는 메커니즘.

| 선택지 | 장점 | 단점/제약 |
|--------|------|----------|
| **A.** **URL query** (`?lang=en` / 기본 생략 시 `ko`) | 링크 공유 용이, 구현 단순 | 사용자가 명시적으로 지정해야 함 |
| **B.** **사용자 설정** (localStorage/쿠키에 선호 언어 저장) | 한 번 설정하면 지속 | 첫 방문 시 기본값 필요 (→ ko), 로그인 간 동기화 이슈 |
| **C.** **계정 프로필 필드** (서버 사이드 유지) | 다기기 동기화, 운영 관리 용이 | User API 스펙 변경 필요, 현재 인증 체계 확인 필요 |
| **D.** **Accept-Language 헤더 자동 감지 + 수동 오버라이드** | 브라우저 언어 그대로, UX 자연스러움 | fallback 규칙 세팅 필요, Next.js middleware 설정 |
| **E.** 직접 제안 | — | — |

💡 **추천: A** (이번 스콥) — Q6이 A(가이드 콘텐츠만)면 본격 i18n 라우팅은 과함. `?lang=en` 쿼리로 단순하게, 기본은 ko. 향후 Q6이 C로 승급할 때 D로 확장 가능.

**답변**: ☑️ **자동 해소** (2026-04-23) — Q8=B 채택으로 API가 ko/en 동시 반환하므로 lang 파라미터/헤더 기반 선택 메커니즘이 불필요. 언어 전환이 필요해지는 향후(Q6 승급) 시점에 D로 확장.

---

### Q8. API 다국어 페이로드 전략

> `/api/v1/guides?name=…` 응답에 언어 데이터를 어떻게 담을지. Q2(HTML 범위)와 함께 **데이터 스키마를 최종 결정**하는 핵심 축.

| 선택지 | 장점 | 단점/제약 |
|--------|------|----------|
| **A.** **쿼리 파라미터로 언어 지정**, 응답은 해당 언어만<br>`GET /guides?name=…&lang=en` → `{ title, body }` | 응답 크기 작음, fallback 로직이 **서버**에 응집 (클라이언트는 그대로 렌더) | 언어 전환 시마다 재요청 |
| **B.** **응답에 모든 언어 동시 포함**<br>`GET /guides?name=…` → `{ i18n: { ko: {...}, en: {...} } }`, 클라이언트가 선택 | 언어 전환이 클라이언트만으로 즉시, Admin 편집 시 양언어 로드 1회 | 응답 크기 ~2배, fallback 로직이 **클라이언트**에 분산 |
| **C.** **name 자체에 언어 포함**<br>`AZURE_…_ko`, `AZURE_…_en` 을 별개 리소스로 취급 | 단순, 캐싱 독립 | Admin에서 한/영 쌍을 관리하는 부담 이동, name 스킴이 Q1과 충돌 |
| **D.** 직접 제안 | — | — |

💡 **추천: B** — Admin 편집 시 한·영 동시 편집/비교가 자연스러워지고(Q5 미리보기 탭에서 언어 토글 가능), end-user 측도 1 요청으로 fallback 즉시 판단 가능. 응답 크기 증가는 가이드 1건당 HTML 수 KB 수준이라 문제 없음.

**답변**: ✅ **B** (2026-04-23) — "나중에 분기 처리가 쉽게 하기 위해서 api 결과에 kor, en으로 분류해서 다 리턴하는게 더 좋겠는데? query param도 제외될 수 있잖아. 우선은 기본언어는 무조건 ko로 결정하는거지."

> Q7 **자동 해소**: Q8=B 채택으로 lang query 불필요. end-user 클라이언트가 응답 받은 `content.ko/en` 중 선택하는 구조 → 언어 선택은 클라이언트 측 결정.

---

## 3-bis-α. 편집기 상세 논의 — Confluence 스타일 참조 (2026-04-23)

> 사용자 질문: "confluence에서처럼 뭔가.. html 수정하는 일반적인 포맷은 많이 공유되었다고 생각하거든요? 이 부분의 편집기엔 어떤 태그들을 제공하는게 좋다고 생각하시나요? HTML 편집기엔 아무래도 css는 포함되긴 어렵겠죠?"

### 툴바 구성 권장 (Confluence / Notion / Linear 레퍼런스)

#### ✅ 필수 제공

| 기능 | 결과 태그 | 근거 |
|------|----------|------|
| Bold | `<strong>` | 강조어 |
| Italic | `<em>` | 개념/용어 강조 |
| Inline code | `<code>` | API 이름·파라미터·경로 |
| Heading 2, 3 | `<h2>`, `<h3>` | 섹션 구분 (H1은 title 필드와 중복이라 숨김) |
| Bullet list | `<ul><li>` | 기존 `bullets[][]` 대체 |
| Numbered list | `<ol><li>` | 기존 `procedures[]` 번호 단계 대체 |
| Link | `<a href target rel>` | 외부 문서 링크 |
| Quote | `<blockquote>` | 인용 / 참고 텍스트 |
| Code block | `<pre><code>` | IAM 정책 JSON, CLI 명령어 |
| Horizontal rule | `<hr>` | 큰 섹션 구분 |

#### ⭐ 강력 권장 — Panel 매크로 패턴 (핵심)

기존 `ProcessGuideModal` 의 의미 박스(warnings 노란/ notes 파란)를 **본문 HTML 내부**에 표현:

```html
<div data-panel="info">정보 박스</div>
<div data-panel="warning">⚠️ 주의사항</div>
<div data-panel="note">📌 참고</div>
<div data-panel="success">✅ 성공 안내</div>
```

- 툴바: `[📘 Info] [⚠️ Warning] [📌 Note] [✅ Success]` 버튼 4개
- 저장: `<div data-panel="warning">` 으로 출력
- 렌더: 앱이 `[data-panel="warning"]` CSS 셀렉터로 노란 박스 자동 적용
- Sanitize allow-list 에 `data-panel` 속성 **예외 허용**

**→ 이 패턴 채택 시 Q2 의 A' (warnings_html / notes_html 필드 분리) 불필요. 순수 A (한 덩어리 HTML) 로 기존 색상 박스 UI 완전 복원 가능.**

#### ➕ 선택 제공

| 기능 | 태그 | 판단 |
|------|------|------|
| Underline | `<u>` | 한국어 문서 관행상 드묾 — 생략 가능 |
| Strikethrough | `<s>` | deprecated 표기 유용 |
| Table | `<table>` | provider 비교표 등 쓸 일 있음, Tiptap 기본 제공 |
| Image | `<img src alt>` | URL 만 허용 (이번 MVP 스콥), 업로드는 별도 wave |
| Expand 아코디언 | `<details><summary>` | 기존 사전조치 아코디언 대체 |

#### ❌ 제공 안 함

| 기능 | 차단 이유 |
|------|----------|
| Color picker / Font size / Font family | **CSS 스타일 직접 조작 → 디자인 시스템 충돌** |
| Align (좌/중/우) | 기본 왼쪽정렬 충분, 정렬은 CSS 영역 |
| Background color | Panel 매크로로 대체 |
| Indent/Outdent | 목록 태그 중첩으로 해결 |
| Emoji / Mention / Date | 이모지는 그냥 입력. Mention은 사용자 시스템 필요 |
| Attachment 업로드 | 스토리지·보안 별도 검토 — 별도 wave |

### "CSS 포함되긴 어렵겠죠?" — 정답

사용자 직관 ✅ 맞음. 세 가지 이유:

1. **의미(Semantic) ↔ 외형(Presentation) 분리 원칙** — 편집자는 `<strong>` (강조이다) 만 선택, 앱이 `<strong>` 의 외형(굵기·색상) 결정. 편집자가 직접 CSS 쓰면 다크모드 도입·브랜드 변경 시 전부 깨짐
2. **디자인 시스템 일관성** — CLAUDE.md "⛔ Raw 색상 클래스 직접 사용 금지" 원칙과 정면 충돌. `lib/theme.ts` 토큰 시스템의 의미 무너짐
3. **XSS / 성능 리스크** — `<style>` 태그 허용 = 전역 CSS 재정의 가능 = 보안 사고. Sanitize 복잡성 증가로 우회 경로 위험

**스타일링 책임 분배**:
```
편집자 (의미만)      →  태그·Panel 선택
                      ↓ HTML 저장
앱 (외형 담당)        →  .prose 스타일 + [data-panel="warning"] CSS
                      ↓ 렌더
end-user             →  통일된 결과물
```

Confluence / Notion / Linear 모두 동일 철학 — 편집자는 **"이건 경고다"** 만 말하고, **"경고가 어떻게 보일지"** 는 앱 전담.

### 편집기 UX 제안 — 3-mode 토글 (Confluence 패턴)

```
┌────────────────────────────────────────────────────┐
│ [ Visual ]  [ Source ]  [ Preview ]   ← 모드 탭      │
├────────────────────────────────────────────────────┤
│ [B] [I] [<>]  [H2] [H3]  [•] [1.]  [🔗]  [ℹ️] [⚠️]  │← 툴바
├────────────────────────────────────────────────────┤
│   편집 영역 (WYSIWYG 또는 raw HTML)                 │
└────────────────────────────────────────────────────┘
```

| 모드 | 내용 | 대상 |
|------|------|------|
| **Visual** | WYSIWYG 툴바 편집, 결과 즉시 확인 | 일반 편집자 |
| **Source** | Raw HTML textarea (syntax highlight 선택) | 개발자 / 복잡한 수정 |
| **Preview** | Q5의 GuideCard / ProcessGuideModal 기존 형태 그대로 렌더 | 최종 확인 |

→ 같은 데이터를 3개 뷰로 전환. 모드 이동 시 내용 유지.

### 구현 옵션 (Q3 라이브러리 선택지)

| 옵션 | 설명 | 번들 크기 영향 |
|------|------|--------------|
| **A.** Tiptap + 커스텀 Panel extension | WYSIWYG + HTML source 토글. ProseMirror 기반(Confluence·Notion 동일 엔진) | +~200KB (Admin 전용 — end-user 영향 0) |
| **B.** CKEditor 5 | 완성도 높음, GPL/상용 라이선스 주의 | +~250KB |
| **C.** textarea + Preview 만 (WYSIWYG 없음) | 최소 구현, 개발자 전용 체감 | +0 (sanitize 라이브러리만) |

💡 **추천: A (Tiptap)** — 오픈소스(MIT), Panel 커스텀 노드 확장 쉬움, Next.js 호환, Admin 전용이라 end-user 번들 영향 0.

### 확정 시 파급 효과

| 이 그림 채택 시 | 결정 |
|----------------|------|
| 본문 하나 + `<div data-panel>` 로 색상 박스 | **Q2 = A** (순수 한 덩어리 HTML) |
| Tiptap WYSIWYG + Source 토글 | **Q3 = C의 변형** (WYSIWYG 주되 Source 모드 항상 제공 — "HTML 방식" 성격 유지) |
| `class` 차단 + `data-panel` 예외 | 보안 + 디자인 일관성 양립 |
| `@tailwindcss/typography` + Panel 전용 CSS | 스타일 앱 전담 |

### ✅ 확정 (2026-04-23)

- **Q2-1 Panel 매크로**: ✅ **YES** → Q2 = **A** (순수 한 덩어리 HTML, 필드 분리 없음)
- **Q2-2 툴바**: **권장 그대로** (필수 10개 + Panel 4개 + 선택 5개 전부)
- **Q2-3 확장 기능**: Table ✅ / Image(URL만) ✅ / Expand ✅ — 이미지 업로드는 별도 wave
- **Q2 추가**: **Source 탭 read-only** — Visual 에디터만 편집 진입점, HTML 직접 수정 차단
- **Q3 라이브러리**: ✅ **Tiptap** — "대중적인 편집기" 요구에 부합, ProseMirror(Confluence/Notion) 엔진

### 설계 귀결

```
Admin 편집 페이지
├─ Visual 탭 (편집 가능) — Tiptap WYSIWYG
│   └─ 툴바: [B] [I] [<>] [H2] [H3] [•] [1.] [🔗]
│            [ℹ️] [⚠️] [📌] [✅]           ← Panel
│            [U] [S] [Table] [Image] [Expand]  ← 선택
├─ Source 탭 (read-only) — 현재 HTML 상태 확인용
└─ Preview 탭 — BornFrame(?) 레이아웃, Q5 확정 대기
```

### 보안·일관성 최종 규칙

| 항목 | 규칙 |
|------|------|
| 편집 진입점 | Visual(Tiptap) 단일 — Source는 read-only |
| `class` 속성 | ❌ 차단 |
| `data-panel` 속성 | ✅ 허용 (info/warning/note/success 4종) |
| `style` 인라인 | ❌ 차단 |
| Sanitize | 저장 시 + 렌더 시 양쪽 (DOMPurify allow-list) |
| 스타일 책임 | 앱 (`@tailwindcss/typography` + Panel CSS) |

---

## 3-ter. API 엔드포인트 제안 (Q6=A, Q8=B 확정 기반)

### 조회 엔드포인트

```
GET /api/v1/guides?name={guide_name}
```

| 파라미터 | 위치 | 필수 | 설명 |
|----------|------|------|------|
| `name` | query | required | 가이드 식별자 (Q1 확정 후 최종 형식 결정) |
| ~~`lang`~~ | ~~query~~ | — | **채택 안 함** (Q8=B 결과 — 응답에 모든 언어 포함) |

### 응답 shape

```jsonc
{
  "name": "azure.step3",
  "defaultLang": "ko",
  "content": {
    "ko": {
      "title": "Azure 연동 대상 확정 중",
      "body": /* HTML string 또는 구조화 객체 — Q2 결정에 따름 */
    },
    "en": {
      "title": "Azure Target Scope Pending",
      "body": /* ... */
    }
    // en 값이 null 이거나 키 누락 시 → 클라이언트가 ko 로 fallback
  },
  "updatedAt": "2026-04-23T10:00:00Z"
}
```

### 클라이언트 fallback 로직 (한 줄)

```ts
const shown = response.content[userLang] ?? response.content[response.defaultLang];
```

### 설계 근거

| 선택 | 이유 |
|------|------|
| 단일 엔드포인트, 언어 파라미터 없음 | 사용자 지시: "query param도 제외될 수 있잖아" |
| 응답에 `ko/en` 객체 분리 | 사용자 지시: "분기 처리가 쉽게... kor, en으로 분류" |
| `defaultLang: "ko"` 명시 필드 | 나중에 `ja`, `zh` 추가 시 동일 fallback 규칙으로 확장 가능 |
| `en: null` 허용 (nullable) | "영문 번역 아직 없음"을 서버가 명시적으로 표현 |
| Admin 편집은 같은 엔드포인트로 조회 | 양언어 1회 로드로 편집기에 바로 주입 |

### 변경·삭제 엔드포인트 (Q4 답변 후 확정)

```
PUT  /api/v1/guides/{name}          # 전체 교체 (ko/en 동시)
DELETE /api/v1/guides/{name}         # 삭제
GET  /api/v1/guides                  # 목록 (Admin 전용)
```

→ Q4=A (Mock only)인지 B·C인지에 따라 구현 범위 확정. Swagger 계약은 Q4 답변 후 `docs/swagger/guides.yaml` 에 작성 예정.

---

## 3-quater. Q2 부연 정보 — "HTML 자유 편집"의 기술적 실현 방법

> 사용자 질문(2026-04-23): "HTML 형태의 가이드를 수정하게 하려면 뭐 어떤식으로 기능을 제공해야되지? 나는 그냥 생각한건.. Html 문서를 원하는 포맷으로 다 지원하는걸 생각했어. 뭐.. css는 제외하고 말이야."

### 1) 허용 태그 Safelist ("원하는 포맷 다 지원"의 실제 범위)

| 분류 | 허용 태그 |
|------|----------|
| 제목·문단 | `<h1>~<h6>`, `<p>`, `<br>`, `<hr>` |
| 강조 | `<strong>`, `<em>`, `<b>`, `<i>`, `<u>`, `<mark>`, `<code>` |
| 목록 | `<ul>`, `<ol>`, `<li>` |
| 링크 | `<a>` (href / target / rel) |
| 인용·코드 | `<blockquote>`, `<pre>`, `<code>` |
| 표 | `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` |
| 이미지 | `<img>` (src 도메인 allow-list + alt) |
| 구조 | `<div>`, `<span>`, `<section>`, `<details>`, `<summary>` |

`<details>` / `<summary>` 를 허용하면 편집자가 HTML 하나로도 아코디언 UI를 만들 수 있어 기존 사전조치 섹션 대체에 유용.

### 2) XSS 방어 차단 목록 (필수)

- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<style>`
- 모든 이벤트 핸들러 속성 (`onclick`, `onerror`, `onload`, …)
- `javascript:` URL, 원칙적 `data:` URL (이미지는 조건부)

### 3) 속성 정책 ("CSS 제외"의 정의)

| 속성 | 처리 | 근거 |
|------|------|------|
| `style="..."` | ❌ 차단 | 인라인 CSS = 사용자 요구의 "CSS 제외" |
| `class="..."` | ❌ 차단 **(권장)** | 편집자 임의 class 사용 시 앱 디자인 시스템과 충돌, 일관성 붕괴 |
| `href`, `src`, `alt`, `target`, `rel`, `title`, `width`, `height` | ✅ 허용 | 콘텐츠 의미 자체 |

**→ 편집자는 태그만으로 의미 표현, 스타일은 앱이 일괄 적용**

### 4) 스타일 제공 전략 (편집자는 CSS 없음 → 누가 예쁘게 만드나)

| 방식 | 구현 | 장점 | 단점 |
|------|------|------|------|
| **A.** `@tailwindcss/typography` 의 `prose` 클래스 래퍼 | `<div className="prose">{html}</div>` | 설치 한 줄로 전부 적용 | 플러그인 추가 |
| **B.** 전용 CSS 파일 (`guide-content.css`) 수동 | 태그별 selector | 디자인 시스템 완벽 맞춤 | 유지보수 부담 |
| **C.** 최소 스타일만 | 기본 브라우저 + 링크색 override | 가볍다 | 일관성 낮음 |

💡 **추천: A** — Tailwind 기 사용 중, Primary `#0064FF` 를 prose 링크색에 매핑만 하면 됨.

### 5) Sanitize 라이브러리

- `isomorphic-dompurify` (~40KB, 서버·클라 공용)
- **저장 시 + 렌더 시 양쪽** sanitize (defense in depth)
- allowList 방식으로 위 safelist 강제

### 6) 트레이드오프 — 기존 UI 손실

기존 `ProcessGuideModal` 은 **의미 기반 시각 구분**이 강함:
- 사전조치: 아코디언 박스
- warnings: **노란 박스**
- notes: **파란 박스**
- procedures: 번호 매긴 단계 카드

Q2=A (한 덩어리) 선택 시 이 색 구분이 사라짐. 편집자가 `<blockquote>`, `<details>`, `<h3>⚠️ 주의사항</h3>` 등으로 대체해야 함.

### Q2 재배치된 선택지

| 선택 | 설명 |
|------|------|
| **A.** 순수 한 덩어리 HTML (`body_html: string`) | 기존 색상 박스 UI 포기. 편집자가 태그로 모든 구분. 데이터 최대 단순 |
| **A'.** 본문 자유 HTML **+ `warnings_html` / `notes_html` 2개 보조 필드** | 시각 일관성 유지 + 편집 자유도 거의 A급. 3 필드 모두 HTML |
| **B.** 필드별 HTML (heading / summaryHtml / bulletsHtml / warningsHtml / notesHtml …) | 기존 레이아웃 완전 유지, 에디터 5~7개 |
| **D.** 직접 제안 | — |

**답변**: _(대기 — A vs A' 선택 + `class` 속성 차단 OK 여부)_

---

## 4. 다음 라운드에 이어서 물을 주제

Q1~Q5 확정 후 다음을 이어서 결정할 예정:

- [ ] 기존 `process-guides.ts` 525줄을 **seed로 마이그레이션**할지, **coexist**(mock은 상수로 응답)할지
- [ ] 편집 **이력 / Draft vs Publish** 필요 여부
- [ ] Admin 네비게이션 계층 (provider별 그룹 vs 상태별 그룹 vs 사전조치 별도 섹션)
- [ ] AWS_AUTO / AWS_MANUAL 을 **한 화면에서 variant 스위치**로 편집할지, 별개 가이드로 취급할지
- [ ] Admin 편집 UI에서 **언어 탭 레이아웃** (ko/en 탭 vs 좌우 분할 동시 편집) — Q5·Q6·Q8 답 나온 뒤 결정
- [ ] end-user 화면의 **언어 전환 UI 위치**(Q6=C 승급 시 헤더에 언어 스위처 필요)
- [ ] 빈 상태 / 에러 / 저장 실패 UX 규칙
- [ ] Admin 권한 체크 (현재 인증 체계와의 연동)
- [ ] `PrerequisiteGuide`(procedures/warnings/notes 구조) 편집 UI — Q2 답에 따라 별도 에디터 필요 여부

---

## 5. Decision Log (답변 기록)

| # | 결정 사항 | 선택 | 근거 | 제안자 | 일시 |
|---|----------|------|------|--------|------|
| pre-1 | 기본 언어 | `ko` | "default는 kor" | 사용자 | 2026-04-23 |
| pre-2 | 미번역 fallback | en 부재 시 ko | pre-1 확장 | 사용자 | 2026-04-23 |
| Q6 | 다국어 적용 범위 | **A** (가이드 콘텐츠만) | "가이드 컨텐츠만 수행할거야" | 사용자 | 2026-04-23 |
| Q8 | API 페이로드 전략 | **B** (응답에 ko/en 동시) | "분기 처리 쉽게... kor, en으로 분류" | 사용자 | 2026-04-23 |
| Q7 | 언어 선택 방식 | 자동 해소 (lang query 제거) | Q8=B 결과 — 클라이언트가 응답에서 선택 | AI (사용자 확인) | 2026-04-23 |
| API-shape | 응답 구조 | `{ name, defaultLang, content: { ko, en\|null }, updatedAt }` | Q8=B 구현 세부 | AI 추천 | 2026-04-23 |
| Q2-1 | Panel 매크로 채택 | ✅ YES (`<div data-panel="warning">`) | 기존 색상 박스 UI 복원 + 본문 한 덩어리 유지 | 사용자 | 2026-04-23 |
| Q2 | HTML 편집 데이터 모델 | **A** (순수 한 덩어리 HTML) | Q2-1 YES 귀결 | 사용자 | 2026-04-23 |
| Q2-2 | 툴바 구성 | 권장 버전 (필수10 + Panel4 + 선택5) | "권장 버전으로 가보자" | 사용자 | 2026-04-23 |
| Q2-3 | Table / Image / Expand | 전부 포함 (단, Image는 URL만) | 권장 버전 그대로 | 사용자 | 2026-04-23 |
| Q2-src | Source 탭 모드 | read-only | "Source View 수정 불가능하게" — 편집 진입점 단일화, sanitize 우회 차단 | 사용자 | 2026-04-23 |
| Q3 | 편집기 라이브러리 | **Tiptap** | "대중적인 편집기 사용", ProseMirror 엔진 (Confluence/Notion 동일) | 사용자 | 2026-04-23 |
| Q5 | 미리보기 레이아웃 | **좌우 split** (편집 \| Preview) + Preview 내 Process 타임라인(접힘가능) + GuideCard 실제 렌더 + ko/en 토글 | "프로세스 항목 아래에 가이드 페이지, 아니면 가이드 Card만 OK" | 사용자 | 2026-04-23 |
| Q5-scope | ProcessGuideModal 미리보기 | 이번 스콥 제외 (GuideCard만 미리보기) | "가이드 Card만 보여져도 되고" — 스콥 간소화 | 사용자 | 2026-04-23 |
| — | _(Q1, Q4 답변 대기)_ | — | — | — | — |

---

## 6. 후속 산출물 예정

Q1~Q5 확정 후 같은 디렉토리에 아래 문서들을 생성 예정:

- `docs/reports/guide-cms/spec.md` — 확정 명세 (와이어프레임 + 상태 전이표 + API 계약)
- `docs/reports/guide-cms/data-model.md` — 최종 타입 정의 + 마이그레이션 매핑표
- `docs/swagger/guides.yaml` — OpenAPI 계약
- `docs/reports/guide-cms/implementation-plan.md` — Wave 분할 + 병렬 가능성
