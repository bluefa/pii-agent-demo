# Guide CMS — 기능 명세 (Spec)

> **Status**: ✅ 확정 (2026-04-25)
> **Owner**: @chulyonga
> **세션 결정 반영**: 2026-04-24 ~ 2026-04-25 대화
> **관련 문서**: [implementation-plan.md](./implementation-plan.md) · [../../swagger/guides.yaml](../../swagger/guides.yaml) · [../../adr/010-guide-cms-slot-registry.md](../../adr/010-guide-cms-slot-registry.md)

---

## 1. 목적 · 스코프

### 1.1 목적

현재 `lib/constants/process-guides.ts` (525줄) 에 하드코딩된 **`GuideCard` 콘텐츠**를 Admin 편집 가능한 구조로 전환한다.

- **편집 대상**: `GuideCard` 본문 (각 프로세스 Step 에 표시되는 가이드)
- **저장 형태**: HTML 문자열 (ko + en 2개 언어)
- **편집 주체**: 운영/관리자 (개발 배포 없이 콘텐츠 수정)

### 1.2 In scope

- **Provider**: AWS (AUTO + MANUAL), AZURE, GCP
- **Step**: 7단계 공통 구조
- **배치**: `GuideCard` (`kind: 'process-step'`) — 각 provider 페이지의 프로세스 Step 에 노출
- **언어**: 한국어 (`ko`) + 영어 (`en`), 둘 다 작성 필수
- **Admin UI**: `/admin/guides` 단일 페이지 (path 기반 네비 없음)

### 1.3 Out of scope (향후 wave)

- **IDC / SDU** — Step 구조 미확정 (결정 후 별도 wave)
- **PREREQ 가이드** (스캔 Role, DB Credential, TF Execution Role) — 이번 스코프 제외
- **Side panel / Tooltip / FAQ** 배치 — Slot Registry 스키마는 지원하나 UI 미구현
- **활동 로그 / 편집 히스토리 / Draft-Publish 플로우**
- **비개발자 대상 CMS** (가이드 추가·삭제 자체를 관리자가 수행하는 플로우)
- **ProcessGuideModal 의 procedures/warnings/notes** — 별도 데이터 (이번 스코프는 `guide` 필드만)

---

## 2. 핵심 설계 원칙

1. **프론트 상수 = Source of truth for identity + placement**
   - 가이드 이름(`GuideName`)과 배치(`GuideSlot`)는 프론트엔드 코드가 소유
   - 서버는 **콘텐츠만** 저장 (`name → contents`)
   - 관리자는 가이드 이름을 **생성·삭제·변경할 수 없음**. 콘텐츠만 편집.

2. **Slot registry (many-to-one)**
   - 하나의 `GuideName` 이 여러 `GuideSlot` 에 참조될 수 있음
   - 예: `AWS_TARGET_CONFIRM` 은 AWS AUTO step 1 과 AWS MANUAL step 1 두 slot 에서 공유
   - 확장 축: `process-step` (이번 스코프), 향후 `side-panel` / `tooltip` / `faq` 를 discriminated union 으로 추가

3. **콘텐츠는 단일 HTML 필드**
   - `contents: { ko: string, en: string }` — HTML 본문 전체를 한 문자열로
   - `title` / `body` 분리 없음. `<h4>` 는 HTML 안에 포함.

4. **ko/en 동시 작성 강제**
   - 저장 시 둘 다 non-empty (strip 후) 필수
   - 클라이언트·서버 양쪽에서 검증

5. **허용 외 HTML = 렌더 거부**
   - 저장 단계에서 `validateGuideHtml()` 통과 못하면 400
   - 렌더 단계에서도 재검증 → 실패 시 에러 상태 표시 (절대 `dangerouslySetInnerHTML` 사용 안 함)

---

## 3. 데이터 모델

### 3.1 Guide Name (프론트 상수, 22개)

```ts
// lib/constants/guide-registry.ts
export const GUIDE_NAMES = [
  // AWS (8개) — AUTO/MANUAL 은 step 4 외 모두 공유
  'AWS_TARGET_CONFIRM',
  'AWS_APPROVAL_PENDING',
  'AWS_APPLYING',
  'AWS_AUTO_INSTALLING',        // step 4 — AUTO 전용
  'AWS_MANUAL_INSTALLING',      // step 4 — MANUAL 전용
  'AWS_CONNECTION_TEST',
  'AWS_ADMIN_APPROVAL',
  'AWS_COMPLETED',
  // AZURE (7개)
  'AZURE_TARGET_CONFIRM',
  'AZURE_APPROVAL_PENDING',
  'AZURE_APPLYING',
  'AZURE_INSTALLING',
  'AZURE_CONNECTION_TEST',
  'AZURE_ADMIN_APPROVAL',
  'AZURE_COMPLETED',
  // GCP (7개)
  'GCP_TARGET_CONFIRM',
  'GCP_APPROVAL_PENDING',
  'GCP_APPLYING',
  'GCP_INSTALLING',
  'GCP_CONNECTION_TEST',
  'GCP_ADMIN_APPROVAL',
  'GCP_COMPLETED',
] as const;

export type GuideName = (typeof GUIDE_NAMES)[number];
```

**이름 규칙**:
- `{PROVIDER}_{STEP_CODE}` — 기본
- `{PROVIDER}_{VARIANT}_{STEP_CODE}` — variant 분기가 있는 경우만 (현재는 AWS step 4 만 해당)
- `COMMON_*` 미사용 — provider 간 콘텐츠 공유 허용 안 함 (provider 별 독립 관리)

### 3.2 Guide Placement (확장 가능한 discriminated union)

```ts
export type GuidePlacement =
  | {
      kind: 'process-step';
      provider: 'AWS' | 'AZURE' | 'GCP';
      variant?: 'AUTO' | 'MANUAL';
      step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      stepLabel: string;      // UI 표시용 (예: "연동 대상 확정")
    }
  // 향후 확장 (이번 스코프 제외)
  | { kind: 'side-panel'; surface: string }
  | { kind: 'tooltip'; surface: string; field: string }
  | { kind: 'faq'; section: string; order: number };
```

### 3.3 Guide Slot (28개)

```ts
export interface GuideSlot {
  guideName: GuideName;
  placement: GuidePlacement;
  component: 'GuideCard' | 'TooltipGuide' | 'SidePanelGuide';
}

export const GUIDE_SLOTS = {
  // AWS AUTO (7 slots)
  'process.aws.auto.1': { guideName: 'AWS_TARGET_CONFIRM',   placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO',   step: 1, stepLabel: '연동 대상 확정' },     component: 'GuideCard' },
  'process.aws.auto.2': { guideName: 'AWS_APPROVAL_PENDING', placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO',   step: 2, stepLabel: '승인 대기' },         component: 'GuideCard' },
  'process.aws.auto.3': { guideName: 'AWS_APPLYING',         placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO',   step: 3, stepLabel: '연동 대상 반영 중' }, component: 'GuideCard' },
  'process.aws.auto.4': { guideName: 'AWS_AUTO_INSTALLING',  placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO',   step: 4, stepLabel: '설치 진행 (자동)' },   component: 'GuideCard' },
  'process.aws.auto.5': { guideName: 'AWS_CONNECTION_TEST',  placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO',   step: 5, stepLabel: '연결 테스트' },       component: 'GuideCard' },
  'process.aws.auto.6': { guideName: 'AWS_ADMIN_APPROVAL',   placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO',   step: 6, stepLabel: '관리자 승인 대기' },   component: 'GuideCard' },
  'process.aws.auto.7': { guideName: 'AWS_COMPLETED',        placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO',   step: 7, stepLabel: '완료' },             component: 'GuideCard' },
  // AWS MANUAL (7 slots) — step 4 만 다른 guide 참조
  'process.aws.manual.1': { guideName: 'AWS_TARGET_CONFIRM',    placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 1, stepLabel: '연동 대상 확정' },       component: 'GuideCard' },
  'process.aws.manual.2': { guideName: 'AWS_APPROVAL_PENDING',  placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 2, stepLabel: '승인 대기' },           component: 'GuideCard' },
  'process.aws.manual.3': { guideName: 'AWS_APPLYING',          placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 3, stepLabel: '연동 대상 반영 중' },   component: 'GuideCard' },
  'process.aws.manual.4': { guideName: 'AWS_MANUAL_INSTALLING', placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 4, stepLabel: 'TF Script 수동 설치' }, component: 'GuideCard' },
  'process.aws.manual.5': { guideName: 'AWS_CONNECTION_TEST',   placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 5, stepLabel: '연결 테스트' },         component: 'GuideCard' },
  'process.aws.manual.6': { guideName: 'AWS_ADMIN_APPROVAL',    placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 6, stepLabel: '관리자 승인 대기' },     component: 'GuideCard' },
  'process.aws.manual.7': { guideName: 'AWS_COMPLETED',         placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 7, stepLabel: '완료' },               component: 'GuideCard' },
  // AZURE (7 slots) — variant 없음
  'process.azure.1': { guideName: 'AZURE_TARGET_CONFIRM',   placement: { kind: 'process-step', provider: 'AZURE', step: 1, stepLabel: '연동 대상 확정' },     component: 'GuideCard' },
  'process.azure.2': { guideName: 'AZURE_APPROVAL_PENDING', placement: { kind: 'process-step', provider: 'AZURE', step: 2, stepLabel: '승인 대기' },         component: 'GuideCard' },
  'process.azure.3': { guideName: 'AZURE_APPLYING',         placement: { kind: 'process-step', provider: 'AZURE', step: 3, stepLabel: '연동 대상 반영 중' }, component: 'GuideCard' },
  'process.azure.4': { guideName: 'AZURE_INSTALLING',       placement: { kind: 'process-step', provider: 'AZURE', step: 4, stepLabel: '설치' },             component: 'GuideCard' },
  'process.azure.5': { guideName: 'AZURE_CONNECTION_TEST',  placement: { kind: 'process-step', provider: 'AZURE', step: 5, stepLabel: '연결 테스트' },       component: 'GuideCard' },
  'process.azure.6': { guideName: 'AZURE_ADMIN_APPROVAL',   placement: { kind: 'process-step', provider: 'AZURE', step: 6, stepLabel: '관리자 승인 대기' },   component: 'GuideCard' },
  'process.azure.7': { guideName: 'AZURE_COMPLETED',        placement: { kind: 'process-step', provider: 'AZURE', step: 7, stepLabel: '완료' },             component: 'GuideCard' },
  // GCP (7 slots) — variant 없음
  'process.gcp.1': { guideName: 'GCP_TARGET_CONFIRM',   placement: { kind: 'process-step', provider: 'GCP', step: 1, stepLabel: '연동 대상 확정' },     component: 'GuideCard' },
  'process.gcp.2': { guideName: 'GCP_APPROVAL_PENDING', placement: { kind: 'process-step', provider: 'GCP', step: 2, stepLabel: '승인 대기' },         component: 'GuideCard' },
  'process.gcp.3': { guideName: 'GCP_APPLYING',         placement: { kind: 'process-step', provider: 'GCP', step: 3, stepLabel: '연동 대상 반영 중' }, component: 'GuideCard' },
  'process.gcp.4': { guideName: 'GCP_INSTALLING',       placement: { kind: 'process-step', provider: 'GCP', step: 4, stepLabel: '설치' },             component: 'GuideCard' },
  'process.gcp.5': { guideName: 'GCP_CONNECTION_TEST',  placement: { kind: 'process-step', provider: 'GCP', step: 5, stepLabel: '연결 테스트' },       component: 'GuideCard' },
  'process.gcp.6': { guideName: 'GCP_ADMIN_APPROVAL',   placement: { kind: 'process-step', provider: 'GCP', step: 6, stepLabel: '관리자 승인 대기' },   component: 'GuideCard' },
  'process.gcp.7': { guideName: 'GCP_COMPLETED',        placement: { kind: 'process-step', provider: 'GCP', step: 7, stepLabel: '완료' },             component: 'GuideCard' },
} as const;

export type GuideSlotKey = keyof typeof GUIDE_SLOTS;

// Resolver 함수
export function resolveSlot(key: GuideSlotKey): GuideSlot { return GUIDE_SLOTS[key]; }
export function findSlotsForGuide(name: GuideName): GuideSlot[] {
  return Object.values(GUIDE_SLOTS).filter(s => s.guideName === name);
}
```

**총계**: 22 names × 28 slots (= 7×4 provider-variant)

### 3.4 Content 데이터 (서버 저장)

```ts
// lib/types/guide.ts
export interface GuideContents {
  ko: string;  // HTML 문자열
  en: string;
}

export interface GuideDetail {
  name: GuideName;
  contents: GuideContents;
  updatedAt: string;  // ISO 8601
}

// 편집 입력 (API PUT body)
export interface GuideUpdateInput {
  contents: GuideContents;
}
```

---

## 4. API 계약

### 4.1 엔드포인트 (2개)

#### GET `/integration/api/v1/admin/guides/{name}`

가이드 단건 조회.

- **Path**: `name ∈ GUIDE_NAMES` (enum)
- **Response**:
  - `200 OK` — `GuideDetail`
  - `404 GUIDE_NOT_FOUND` — `name` 이 `GUIDE_NAMES` 에 없음

```json
// 200 예시
{
  "name": "AZURE_APPLYING",
  "contents": {
    "ko": "<h4>승인된 DB를 시스템에 반영하고 있어요</h4><p>…</p>",
    "en": "<h4>Applying approved DB to the system</h4><p>…</p>"
  },
  "updatedAt": "2026-04-25T09:30:00Z"
}
```

#### PUT `/integration/api/v1/admin/guides/{name}`

가이드 콘텐츠 저장.

- **Body**: `GuideUpdateInput`
- **Response**:
  - `200 OK` — `GuideDetail` (저장된 상태)
  - `400 GUIDE_CONTENT_INVALID` — ko/en 중 비어있거나 HTML 검증 실패. `details` 에 구체 에러 위치
  - `404 GUIDE_NOT_FOUND`

```json
// 400 예시
{
  "error": {
    "code": "GUIDE_CONTENT_INVALID",
    "message": "ko, en 모두 작성되어야 하며 허용된 HTML 태그만 사용할 수 있습니다.",
    "details": {
      "ko": ["허용되지 않은 태그: <script>"],
      "en": ["빈 콘텐츠"]
    }
  }
}
```

### 4.2 검증 규칙 (서버)

1. **Path 검증**: `name ∈ GUIDE_NAMES` → 404 if not
2. **Body 스키마**: `contents.ko`, `contents.en` 모두 `string` 타입
3. **Non-empty**: `stripHtmlText(contents.ko).trim().length > 0` AND `en` 동일
4. **HTML validation**: `validateGuideHtml(contents.ko)` 와 `en` 모두 `valid: true`

### 4.3 List API 부재에 대한 결정

**의도적으로 제공하지 않음**:
- 가이드 이름 목록은 프론트 상수 (`GUIDE_NAMES`) 가 source of truth
- 작성 현황 뱃지 UX 를 도입하지 않기로 결정 (이번 스코프 불필요)
- 필요 시 향후 `GET /admin/guides/statuses` 등으로 추가 (한 번도 호출 안 되는 API 우선 제공 안 함)

### 4.4 에러 코드 카탈로그 추가

`app/api/_lib/problem.ts` `ERROR_CATALOG` 에 다음 추가:

```ts
GUIDE_NOT_FOUND:        { status: 404, title: 'Guide Not Found',        retriable: false },
GUIDE_CONTENT_INVALID:  { status: 400, title: 'Guide Content Invalid',  retriable: false },
```

---

## 5. HTML 허용 범위 · 검증 · 렌더

### 5.1 허용 태그/속성 (allow-list)

| 카테고리 | 태그 | 허용 속성 | 제약 |
|---|---|---|---|
| 제목 | `h4` | — | `h1`~`h3`, `h5`, `h6` 모두 차단 |
| 본문 | `p` | — | |
| 줄바꿈 | `br` | — | void |
| 목록 | `ul`, `ol` | — | 직계 자식은 `li` 만 |
| 목록 항목 | `li` | — | `ul` / `ol` 내부만 가능 |
| 강조 | `strong`, `em` | — | 인라인 |
| 코드 | `code` | — | 인라인 (`pre` 불허) |
| 링크 | `a` | `href`, `target`, `rel` | `href` 는 `https?://` \| `mailto:` \| `/`로 시작 |

**명시적 차단**:
- 모든 `<script>`, `<iframe>`, `<style>`, `<img>`, `<video>`, `<form>`, `<input>`
- 모든 `on*` 이벤트 속성 (`onclick`, `onerror` 등)
- `style`, `class`, `id` 속성 (현재 없음)
- `<a href="javascript:…">`

### 5.2 검증 결과 타입

```ts
// lib/utils/validate-guide-html.ts
export type GuideNode =
  | { type: 'h4' | 'p';                                children: GuideNode[] }
  | { type: 'br' }
  | { type: 'ul' | 'ol';                               children: GuideNode[] }
  | { type: 'li';                                      children: GuideNode[] }
  | { type: 'strong' | 'em' | 'code';                  children: GuideNode[] }
  | { type: 'a'; href: string; target?: string; rel?: string; children: GuideNode[] }
  | { type: 'text'; value: string };

export interface ValidationError {
  code: 'DISALLOWED_TAG' | 'DISALLOWED_ATTRIBUTE' | 'INVALID_URL_SCHEME'
      | 'INVALID_NESTING' | 'PARSE_ERROR' | 'EMPTY_CONTENT';
  message: string;
  tagName?: string;
  path?: string;   // 예: "ul[0] > li[2]"
}

export type ValidationResult =
  | { valid: true;  ast: GuideNode[] }
  | { valid: false; errors: ValidationError[] };

export function validateGuideHtml(html: string): ValidationResult;
```

구현 요지:
1. `DOMParser` 로 HTML 파싱
2. body 하위 트리를 재귀 방문
3. 각 노드마다 allow-list 대조 → 실패 시 `errors` 추가
4. 모든 노드가 통과해야 `valid: true` + AST 반환

### 5.3 3-Layer 방어

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1 — Tiptap 에디터                                   │
│  - allow-list 에 대응하는 extension 만 등록              │
│  - 툴바에 허용 작업만 노출 (H4, B, I, Code, List, Link)  │
│  - 붙여넣기 시 unknown 태그 자동 제거 (Tiptap 기본 동작) │
├─────────────────────────────────────────────────────────┤
│ Layer 2 — validateGuideHtml() (클라 + 서버 공통)         │
│  - 저장 클릭 시 클라가 먼저 검증 → 실패면 인라인 경고    │
│  - 서버가 PUT 핸들러에서 재검증 → 실패면 400             │
├─────────────────────────────────────────────────────────┤
│ Layer 3 — AST 기반 렌더러                                 │
│  - renderGuideAst(ast) 가 React.createElement 로 트리 생성│
│  - 허용 노드 타입 외에는 절대 렌더 안 됨                 │
│  - dangerouslySetInnerHTML 사용 안 함                    │
│  - 렌더 시점 재검증 실패 시 <GuideCardInvalidState />    │
└─────────────────────────────────────────────────────────┘
```

### 5.4 Tiptap Extension 구성

```ts
// app/components/features/admin-guides/GuideEditor/extensions.ts
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

export const guideExtensions = [
  StarterKit.configure({
    heading: { levels: [4] },
    paragraph: {},
    bold: {},               // <strong>
    italic: {},             // <em>
    code: {},               // inline <code>
    bulletList: {},
    orderedList: {},
    listItem: {},
    hardBreak: {},          // <br>
    history: {},
    // 비활성
    strike: false,
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    validate: (href: string) => /^(https?:\/\/|mailto:|\/)/.test(href),
  }),
];
```

---

## 6. Admin UI 사양

### 6.1 페이지 구조

단일 URL: `/integration/admin/guides`

```
┌─────────────────────────────────────────────────────────────────┐
│  [AdminHeader]                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [AWS] [AZURE] [GCP] [IDC (준비중)] [SDU (준비중)]              │  ← Provider tabs
├──────────────┬─────────────────────┬─────────────────────────────┤
│ Step 목록     │ 편집                │ 미리보기                    │
│ (25%)        │ (35%)               │ (40%)                      │
├──────────────┼─────────────────────┼─────────────────────────────┤
│ 1. 연동 대상  │ AWS · AUTO · 3단계  │ [ko]  [en]                 │
│    확정      │ 연동 대상 반영 중    │                            │
│ 2. 승인 대기  │ [AWS_APPLYING 🔒]   │ ○─○─◉─○─○─○─○              │
│▶ 3. 반영 중 ←│                     │ 1 2 3 4 5 6 7             │
│ 4. 설치 AUTO │ ℹ️ 이 가이드는       │                            │
│ 4. 설치 MAN  │   2곳에 표시됩니다:  │ ┌──────────────────────┐   │
│ 5. 연결 테스트│   · AWS AUTO 3단계   │ │   GuideCard (실제)    │   │
│ 6. 관리자 승인│   · AWS MANUAL 3단계│ │                      │   │
│ 7. 완료      │                     │ └──────────────────────┘   │
│              │ [ko]  [en]          │                            │
│              │ ─────────────────   │                            │
│              │ [Tiptap 에디터]      │                            │
│              │ (H4)(B)(I)(List)... │                            │
│              │                     │                            │
│              │ [저장]               │                            │
│              │ ↑ ko+en 둘 다        │                            │
│              │   유효할 때만 활성    │                            │
└──────────────┴─────────────────────┴─────────────────────────────┘
```

### 6.2 Provider 탭

- `AWS`, `AZURE`, `GCP` 3개는 활성
- `IDC`, `SDU` 는 비활성 ("준비 중" tooltip)
- `role="tablist"` / 각 탭 `role="tab"` / `aria-selected`

### 6.3 Step 목록 패널

- Slot registry 에서 현재 provider 에 해당하는 slot 만 필터링하여 렌더
- AWS 의 경우 step 4 가 AUTO / MANUAL 두 행으로 분기 (다른 step 은 1행)
- 행 클릭 시 해당 slot 선택 → 편집/미리보기 패널 활성화
- 선택된 행은 `◉` 강조 + background
- 작성 현황 뱃지 **없음** (이번 스코프 제외)

### 6.4 편집 패널

#### 6.4.1 헤더
```
AZURE · 3단계 연동 대상 반영 중         [🔒 AZURE_APPLYING]
```

#### 6.4.2 "N곳에 표시됩니다" 정보

`findSlotsForGuide(guideName)` 결과를 표시. 길이가 2 이상일 때만 노출:

```
ℹ️ 이 가이드는 2곳에 표시됩니다:
   · AWS · AUTO · 3단계 연동 대상 반영 중
   · AWS · MANUAL · 3단계 연동 대상 반영 중
   저장 시 모든 곳에 반영됩니다.
```

#### 6.4.3 언어 탭

- `[ko]` `[en]` 2개 탭. Tiptap 에디터 instance 는 각 언어당 1개.
- 탭 전환 시 입력값 메모리 유지 (저장 전 손실 없음).

#### 6.4.4 Tiptap 에디터 + 툴바

툴바 버튼 (7개):
- `H4` (heading toggle)
- `B` (bold)
- `I` (italic)
- `</>` (inline code)
- `• List` (bullet list)
- `1. List` (ordered list)
- `🔗` (link — prompt 로 URL 입력)

#### 6.4.5 저장 버튼 상태머신

```
idle                  → ko/en 중 하나라도 empty → disabled
idle + valid          → enabled
submitting            → loading 표시, disabled
success               → toast "저장되었습니다" + idle 로
error                 → toast "{error.message}" + idle 로 (입력값 유지)
```

**Validation 시점** (저장 클릭 직후):
1. `stripHtml(ko).trim().length > 0` 체크
2. `validateGuideHtml(ko).valid === true` 체크
3. `en` 동일
4. 실패 시 해당 언어 탭으로 자동 전환 + 인라인 에러 메시지

### 6.5 미리보기 패널

#### 6.5.1 언어 토글
`[ko]` `[en]` — 현재 표시할 언어 선택. 편집 탭과 독립 (편집은 ko 하면서 미리보기는 en 가능).

#### 6.5.2 타임라인
```
○ ─ ○ ─ ◉ ─ ○ ─ ○ ─ ○ ─ ○
1   2   3   4   5   6   7
```
현재 선택된 slot 의 `step` 을 `◉` 로 강조. 단일 라인, compact.

#### 6.5.3 GuideCard 렌더
- **실제 `GuideCard` 컴포넌트** 를 사용 (pure presentational 버전)
- 편집 중 값을 `content` prop 으로 주입 → Tiptap 의 `onUpdate` 콜백으로 실시간 반영
- `aria-live="polite"` 로 스크린리더 업데이트 알림

### 6.6 미저장 변경 confirm

#### 6.6.1 트리거
- Provider 탭 전환
- Step 목록 행 클릭 (다른 slot 선택)
- 언어 탭 전환 (편집 중 언어만 dirty 이어도)
- 페이지 이탈 (`beforeunload`)

#### 6.6.2 동작
- Browser-native `confirm()` 사용 (간단)
- "저장되지 않은 변경사항이 있습니다. 이동하시겠습니까?"
- OK → 변경 폐기 후 이동. Cancel → 현재 위치 유지.
- `localStorage` 자동 저장·복구는 **하지 않음** (이번 스코프)

### 6.7 초기 상태 (선택 없음)

페이지 진입 시 아무 slot 도 선택되지 않은 상태. Step 목록 + 빈 편집/미리보기 영역 + 안내 텍스트:

```
왼쪽 목록에서 편집할 단계를 선택해주세요.
```

### 6.8 에러 상태

| 상황 | UI |
|---|---|
| 네트워크 에러 (GET 실패) | `<ErrorState>` — "가이드를 불러올 수 없습니다. 다시 시도" 버튼 |
| 네트워크 에러 (PUT 실패) | Toast 에러 + 입력값 유지 |
| 렌더 검증 실패 (AST) | 미리보기에 `<GuideCardInvalidState>` — 에러 목록 표시 |
| 404 GUIDE_NOT_FOUND | Registry ↔ store drift. 빈 콘텐츠로 초기화 후 편집 가능. 콘솔 warn |

---

## 7. Seed · 마이그레이션 전략

### 7.1 Mock store 시드

`lib/constants/process-guides.ts` 의 기존 `DEFAULT_STEP_GUIDES` + provider 별 override 를 HTML 로 변환하여 mock store 에 주입.

변환 규칙:
```ts
function seedToHtml(content: StepGuideContent): string {
  const heading = `<h4>${escapeHtml(content.heading)}</h4>`;
  const summary = `<p>${renderInlineToHtml(content.summary)}</p>`;
  const bullets = content.bullets.length > 0
    ? `<ul>${content.bullets.map(b => `<li>${renderInlineToHtml(b)}</li>`).join('')}</ul>`
    : '';
  return heading + summary + bullets;
}
```

- `ko` : 기존 상수 HTML 변환값으로 시드
- `en` : 빈 문자열 (`""`) — Admin 이 직접 작성하도록

### 7.2 스크립트

`scripts/migrate-guides-to-html.ts` — 한 번 실행 → JSON 파일로 출력 → mock store 에 import.

Script 검증 항목:
- 22 guide names 모두 시드 콘텐츠 있음
- HTML 검증 통과
- stripped text non-empty

### 7.3 기존 `process-guides.ts` 처리

- `DEFAULT_STEP_GUIDES` (guide 필드용) : **제거** — W4 소비자 교체 후
- `ProcessGuideStep.procedures`, `warnings`, `notes`, `prerequisiteGuides` : **유지** — `ProcessGuideModal` 이 여전히 사용
- `ProviderProcessGuide.title`, `steps[].label`, `steps[].description` : **유지** — Modal + Admin registry 에서 참조

---

## 8. 테스트 전략

### 8.1 Unit

| 대상 | 테스트 |
|---|---|
| `validateGuideHtml()` | 허용 태그 pass · 금지 태그 reject · URL scheme 검증 · 구조 위반 · 빈 콘텐츠 |
| `renderGuideAst()` | 각 노드 타입별 React element 생성 |
| `resolveSlot()`, `findSlotsForGuide()` | registry 조회 정확성 |
| Seed migration | 기존 상수 → HTML 변환 결과가 validator 통과 |

### 8.2 Drift CI 테스트

`__tests__/guide-registry.test.ts`:
```ts
it('mock store seed 의 키 집합이 GUIDE_NAMES 와 일치한다', () => {
  expect(new Set(Object.keys(mockGuideStore))).toEqual(new Set(GUIDE_NAMES));
});

it('GUIDE_SLOTS 의 guideName 은 모두 GUIDE_NAMES 에 존재한다', () => {
  const names = new Set(GUIDE_NAMES);
  Object.values(GUIDE_SLOTS).forEach(s => {
    expect(names.has(s.guideName)).toBe(true);
  });
});
```

### 8.3 API 통합

| 시나리오 | Expected |
|---|---|
| GET 유효 name | 200 + GuideDetail |
| GET 미등록 name | 404 GUIDE_NOT_FOUND |
| PUT 정상 ko+en | 200 + 저장된 값 반환 |
| PUT ko 비어있음 | 400 GUIDE_CONTENT_INVALID |
| PUT 금지 태그 포함 | 400 GUIDE_CONTENT_INVALID + details |
| PUT 미등록 name | 404 GUIDE_NOT_FOUND |

### 8.4 E2E (수동 / Playwright 선택)

1. /admin/guides 진입 → AWS 탭 선택 → step 3 선택 → 에디터 로드 확인
2. ko 편집 → 저장 버튼 disabled 유지 (en 비어있음)
3. en 작성 → 저장 활성화 → 저장 → toast 성공
4. 다른 slot 이동 → 미저장 변경 confirm 뜨지 않음
5. 편집 중 다른 slot 클릭 → confirm 다이얼로그

---

## 9. 성능 · 번들

### 9.1 Tiptap 번들 분리

`app/integration/admin/guides/page.tsx` 는 `next/dynamic` 으로 에디터 동적 import:
```tsx
const GuideEditor = dynamic(() => import('./GuideEditor'), { ssr: false });
```

Admin 전용 페이지이므로 메인 번들에 Tiptap 포함 안 함.

### 9.2 미리보기 실시간 업데이트

Tiptap `onUpdate` 콜백에서 `setDraftHtml(html)` → `GuideCard` 재렌더.
100ms debounce 로 과도한 렌더 방지.

---

## 10. 접근성 (WCAG 2.1 AA)

- Provider tabs: `role="tablist"`, `role="tab"`, `aria-selected`, 키보드 좌우 화살표 이동
- Step 목록: `role="list"`, 행은 `role="button"` + Enter/Space 활성화
- 편집 언어 탭: `role="tablist"`
- 미리보기 영역: `aria-live="polite"` (편집 업데이트 시 스크린리더 알림)
- 저장 버튼 disabled 시 `aria-disabled="true"` + 이유 tooltip
- Confirm 다이얼로그: browser-native (접근성 OS 보장)

---

## 11. 확장성 노트

### 11.1 지원되는 확장

| 변경 | 대응 |
|---|---|
| 새 Provider 추가 (예: ORACLE) | `GUIDE_NAMES` + `GUIDE_SLOTS` 7개씩 append. UI 탭 자동 확장. Seed 작성 필요. |
| 기존 step 에 variant fork 추가 (예: AZURE step 5 AUTO/MANUAL) | name 2개 추가 + 관련 slot 업데이트. UI 는 자동으로 2행 분기 렌더. Seed 에 복사본 초기값 제공. |
| Side-panel / Tooltip 가이드 추가 | `GuidePlacement` union 은 이미 지원. **UI 네비 재설계 필요** (Category 축 도입). API 변경 없음. |
| 새 허용 HTML 태그 (예: `<hr>`) | `validateGuideHtml()` allow-list 업데이트 + Tiptap extension 추가 + AST renderer 업데이트. |

### 11.2 지원 안 되는 확장 (별도 설계)

- **가이드 이름 Admin 편집** — 설계 원칙상 불가 (의도된 제약)
- **비개발자 CMS** — 가이드 추가·삭제 자체를 Admin 에서 수행하려면 서버 owns placement 구조로 전환 필요
- **Draft / Publish 플로우** — 현재 즉시 반영. 추후 `status: 'draft' | 'published'` 필드 추가 가능
- **편집 히스토리 / 롤백** — `updatedAt` 만 기록. 감사 로그는 별도 테이블
- **i18n 통합** — 현재 `stepLabel` 은 한국어 하드코딩. 전체 i18n 도입 시 label key 로 변경 필요 ([docs/reports/i18n-support-plan.md](../../reports/i18n-support-plan.md) 참조)

### 11.3 IDC / SDU 추가 절차

Step 구조 확정 시:
1. `GUIDE_NAMES` 에 IDC/SDU name 들 append
2. `GUIDE_SLOTS` 에 해당 slot 들 append
3. Seed 작성
4. Admin Provider 탭 "준비 중" 제거

---

## 12. 리스크 · 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| Registry ↔ store drift | 404 또는 edit 안 되는 가이드 | W1 CI drift 테스트. Orphan 발견 시 warn log. |
| Orphan content (store 에 있지만 registry 에서 삭제됨) | DB 용량 / 혼동 | Admin 에 노출 안 됨. 향후 cleanup 스크립트. |
| Tiptap 번들 크기 (+~150KB) | 초기 admin 로드 지연 | `next/dynamic` 지연 로드 |
| 5 provider 페이지 일괄 전환 | 기존 UI 일시 깨짐 | W4 를 단일 PR 로. Feature flag 없이 clean cut. |
| HTML allow-list 가 실제 필요보다 좁을 수 있음 | 편집 불편 | 저장 단계에서 에러 메시지 상세화. 필요 시 allow-list 확장 PR. |
| ProcessGuideModal 의 procedures 등과 단절 | Admin 에서 Modal 콘텐츠 못 바꿈 | 이번 스코프 외. 향후 별도 wave. |

---

## 13. 열린 결정

이번 스펙에서 명시적으로 보류한 것들:

- [ ] W2 디자인 시안 완성 시점
- [ ] Tiptap Link 에디터 UX (prompt vs popover) — 디자인 시안에서 결정
- [ ] "N곳에 표시됩니다" 정보의 구체 레이아웃 (Alert box vs Badge list)
- [ ] 저장 성공 toast 의 프로젝트 표준 컴포넌트 확인
