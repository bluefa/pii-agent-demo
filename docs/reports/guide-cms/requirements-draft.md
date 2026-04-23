# Guide CMS — 요구사항 명세 (Draft)

> **Status**: 🟡 질문 답변 대기 중 (Phase 2-2, Q1~Q8)
> **작성일**: 2026-04-23
> **최근 업데이트**: 2026-04-23 — 다국어(ko/en) 요구 추가, Q6~Q8 i18n 질문 추가. default=ko 확정.
> **Owner**: @chulyonga
> **목적**: `GuideCard` / `ProcessGuideModal` 이 참조하는 가이드 데이터를 **API 기반**으로 전환하고, **Admin 편집 페이지**에서 HTML로 수정 가능하게 만드는 기능 명세.
>
> **선결 확정 사항**:
> - 기본 언어 = `ko`, 영어 부재 시 한국어 fallback

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

**답변**: _(대기)_

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

**답변**: _(대기)_

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

**답변**: _(대기)_

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

**답변**: _(대기)_

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
| — | _(Q1~Q5 답변 후 채워짐)_ | — | — | — | — |

---

## 6. 후속 산출물 예정

Q1~Q5 확정 후 같은 디렉토리에 아래 문서들을 생성 예정:

- `docs/reports/guide-cms/spec.md` — 확정 명세 (와이어프레임 + 상태 전이표 + API 계약)
- `docs/reports/guide-cms/data-model.md` — 최종 타입 정의 + 마이그레이션 매핑표
- `docs/swagger/guides.yaml` — OpenAPI 계약
- `docs/reports/guide-cms/implementation-plan.md` — Wave 분할 + 병렬 가능성
