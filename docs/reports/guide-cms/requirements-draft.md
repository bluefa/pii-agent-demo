# Guide CMS — 요구사항 명세 (Draft)

> **Status**: 🟡 질문 답변 대기 중 (Phase 2-2)
> **작성일**: 2026-04-23
> **Owner**: @chulyonga
> **목적**: `GuideCard` / `ProcessGuideModal` 이 참조하는 가이드 데이터를 **API 기반**으로 전환하고, **Admin 편집 페이지**에서 HTML로 수정 가능하게 만드는 기능 명세.

---

## 0. 사용자 원문 요구 (재구성)

1. `GuideCard` 등 가이드를 보여주는 컴포넌트가 현재는 **constant** 기반이다. 이를 **API 호출**로 전환하고 싶다.
2. 조회 형태 예시: `API/?guide_name=AZURE_연동대상확정중` (이름으로 단건 조회).
3. **Admin 페이지 일부**로 가이드를 **수정·확인** 할 수 있는 화면이 필요하다.
4. 편집 화면에서는 `GuideCard` 와 `Process` 가 **기존에 사용되던 형태 그대로 미리보기**로 보여야 한다.
5. 가이드는 **기본적으로 HTML 방식으로 수정 가능**해야 한다.

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

## 4. 다음 라운드에 이어서 물을 주제

Q1~Q5 확정 후 다음을 이어서 결정할 예정:

- [ ] 기존 `process-guides.ts` 525줄을 **seed로 마이그레이션**할지, **coexist**(mock은 상수로 응답)할지
- [ ] 편집 **이력 / Draft vs Publish** 필요 여부
- [ ] Admin 네비게이션 계층 (provider별 그룹 vs 상태별 그룹 vs 사전조치 별도 섹션)
- [ ] 다국어 (현재는 한국어 UI만이라 불필요로 보임)
- [ ] AWS_AUTO / AWS_MANUAL 을 **한 화면에서 variant 스위치**로 편집할지, 별개 가이드로 취급할지
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
