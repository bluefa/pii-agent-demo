# FAQ & Notices API 추가

> Confluence: 5.2.3.5.5.10.3.x
> Confluence Title: [26.08.12] FAQ & Notices API 추가 관련 논의
> 상태: Draft
> 작성일: 2026-08-12
> 마지막 수정일: 2026-08-12
> 대상 Tag: faq-notices
> 변경 유형: Added
> 변경 방향: FE-first
> 담당: TBD
> 관련 PR: TBD

## 1. 논의 배경

메인 페이지에 FAQ / 공지사항 목록(아코디언)과 Pass 소개 배너를 노출하고, Category별 상세 페이지와 Admin 관리 화면을 추가하는 요구사항이 확정됐다. 현재 BFF에는 이 도메인을 다루는 Tag가 없다.

기존 `Admin Guides` Tag(`/install/v1/admin/guides/{name}`)는 **guide name 단위의 단일 content store**라서 이 요구사항을 담을 수 없다. 목록·정렬·Category·상단 고정·숨김 상태가 모두 필요하고, name 하나에 content 하나를 매핑하는 구조로는 목록 조회와 정렬을 표현할 수 없다.

이 문서는 그 요구사항을 만족하기 위해 **BFF에 필요한 API 집합**을 확정하기 위한 초안이다. 아직 backend 구현 신호는 없으며, FE가 필요한 계약을 먼저 제시하는 FE-first 논의다.

## 2. 논의 내용

### 2.1 리소스 분리 방식 — FAQ / Notice를 하나의 리소스로 둔다

| 옵션 | 내용 | 판단 |
| --- | --- | --- |
| A. `/faqs` + `/notices` 분리 | 두 리소스로 나눈다 | 기각. 필드가 100% 동일하고, 목록/수정/숨김/고정 API가 전부 2벌이 된다 |
| **B. `/posts` + `type` 필드** | 단일 리소스에 `type: FAQ \| NOTICE` | **채택** |

B를 채택하면 "FAQ와 Notice를 별도 메뉴로 분리할지, 하나의 목록에서 함께 보여줄지"라는 미확정 항목이 **BFF 계약을 바꾸지 않고** 결정된다. 분리 메뉴는 `?type=FAQ`, 통합 목록은 `type` 생략으로 둘 다 커버된다. 이 미확정 항목 때문에 API 설계를 멈출 필요가 없다는 것이 B의 핵심 이점이다.

### 2.2 정렬 — 서버가 정렬해서 내려준다

`pinned desc → publishedAt desc` 순서로 **BFF가 정렬한 배열**을 반환한다. 클라이언트가 정렬 규칙을 다시 구현하면 메인/상세 페이지 사이에서 규칙이 갈라질 수 있다. `sort` 쿼리 파라미터는 두지 않는다 — 요구사항에 정렬 선택 기능이 없다.

요구사항 원문의 "상단 고정 게시글도 시간순으로 정렬한다"는 **고정 그룹 내부의 시간순**으로 해석했다. 전체를 시간순으로 섞으면 상단 고정 기능 자체가 무효가 되기 때문이다. → §5 D1.

### 2.3 본문 조회 — 목록에서 빼고 펼칠 때 가져온다 (초안 뒤집음)

**초안의 결정을 뒤집었다.** 처음에는 "펼칠 때마다 왕복이 생기니 목록 응답에 `content`를 포함한다"로 잡았다. 그 판단은 *한국어 텍스트 본문 · 게시글 수십 건*을 전제로 했고, 그 전제가 세 번 바뀌었다.

| 바뀐 것 | 목록 응답에 미치는 영향 |
| --- | --- |
| ko/en 필수(§2.9) | 본문 payload가 2배 |
| 페이지네이션 없음(D10) | 게시글 수에 비례해 단조 증가, 상한 없음 |
| 전체보기 화면 추가 | 정의상 전량을 받는 화면이라 `limit`으로도 막을 수 없음 |

마지막 항목이 결정적이다. 메인 화면만 놓고 보면 `GET /install/v1/posts`에 `limit`을 붙여 5건만 받으면 되지만(A안), **전체보기 화면은 전량을 보여주는 것이 목적이므로 `limit`이 통하지 않는다.** 게시글이 쌓일수록 그 화면만 계속 무거워진다. 두 화면을 한 번에 해결하는 것은 본문을 목록에서 빼는 쪽뿐이다.

그래서 목록(`PostSummary` / `AdminPostSummary`)은 본문을 담지 않고, 아코디언을 펼치는 시점에 `GET /install/v1/posts/{postId}`를 호출한다.

부수 효과가 하나 있다. 단건 조회 API는 원래 딥링크 전용으로만 뒀는데, 어떤 화면도 개별 게시글 URL을 만들지 않아 **호출자가 없는 엔드포인트**였다. 이 변경으로 아코디언이라는 주 호출자가 생기고, 숨김 글 404 규칙(D5)도 실제로 동작하는 경로가 된다.

대가는 명확하다 — 펼칠 때마다 왕복 한 번. 펼침 패널에 스켈레톤을 두고, 한 번 받은 본문은 다시 접었다 펴도 재요청하지 않는다.

Admin 목록도 같은 규칙을 따른다. Admin 목록 화면은 배지·Title·게시일자·작업 버튼만 그리므로 본문을 쓰지 않고, 본문이 필요한 수정 화면이 `GET /install/v1/admin/posts/{postId}`로 가져간다.

### 2.4 Category별 그룹화 — 별도 API를 두지 않는다

상세 페이지의 "Category별 그룹화"는 `GET /install/v1/posts` 응답을 `categoryId` 기준으로 클라이언트가 묶으면 된다. 그룹화 전용 응답 형태를 BFF에 추가하면 같은 데이터를 두 가지 형태로 서빙하게 된다. Category의 **표시 순서와 이름**만 `GET /install/v1/post-categories`로 제공한다.

### 2.5 숨김 — 삭제가 아닌 상태 전이

`DELETE`를 두지 않는다. `PUT /install/v1/admin/posts/{postId}/hidden`의 `{hidden: boolean}` 하나로 숨김/복구를 모두 처리한다. 요구사항이 "실제 삭제가 아닌 숨김 처리"이므로 삭제 엔드포인트가 존재하면 안 된다.

`pinned`도 같은 이유로 고정/해제를 별도 엔드포인트로 나누지 않고 `PUT .../pinned`의 `{pinned: boolean}` 하나로 둔다.

### 2.6 본문 HTML 정책 — Admin Guides 정책을 그대로 재사용한다

본문이 단순 텍스트인지 서식을 지원하는지가 미확정이지만, 같은 저장소의 `Admin Guides`가 이미 HTML allow-list 검증(`GUIDE_CONTENT_INVALID`)을 운영 중이다. 별도 정책을 새로 정의하는 대신 **동일한 allow-list**를 적용하고, 에러 코드만 이 Tag용으로 분리한다(`POST_CONTENT_INVALID`). 줄바꿈·링크가 `p`/`br`/`a`로 커버되므로 요구사항을 만족한다.

첨부파일은 지원하지 않는다. 이미지는 초안에서 제외했으나 §2.10에서 뒤집었다 — allow-list에 `img`를 추가한다. → §5 D6, D14.

### 2.7 수정 시 시각 — publishedAt은 불변

`PUT /install/v1/admin/posts/{postId}`는 `updatedAt`만 갱신하고 `publishedAt`은 건드리지 않는다. 목록 정렬 기준이 `publishedAt`이므로, 오타 하나를 고쳤다고 게시글이 목록 최상단으로 올라오면 안 된다.

### 2.8 수정은 PATCH가 아니라 PUT이다

프론트엔드가 partial update 요청을 만들지 않기로 해서, 수정은 `PUT`(전체 교체 저장)으로 둔다. 같은 저장소의 `Admin Guides`(`PUT /install/v1/admin/guides/{name}`)가 이미 전체 교체 방식이므로 관례도 일치한다.

대가는 하나 있다. 전체 교체이므로 **생략된 필드는 "유지"가 아니라 "비움"** 이다. `categoryId`를 빠뜨린 요청은 게시글을 조용히 미분류로 만든다. 수정 화면은 반드시 기존 값을 모두 채운 상태로 열고, 사용자가 건드리지 않은 필드도 그대로 다시 보내야 한다. 이 위험을 줄이려고 `titles`와 `contents`는 `required`로 두었지만, `categoryId`는 미분류가 정상 상태이므로 `required`로 강제할 수 없다.

### 2.9 다국어 — Title과 본문을 ko/en 쌍으로

게시글 등록 시 한국어/영어 Title과 본문을 모두 입력하는 요구가 추가됐다. `title`/`content`를 `titles`/`contents`의 `{ko, en}` 쌍으로 바꾼다.

이건 새로 설계할 구조가 아니다. 같은 저장소의 `Admin Guides`가 이미 `contents: {ko, en}` + HTML allow-list 검증으로 동작하고, 프론트엔드에도 대응 자산이 이미 있다 — 언어 탭/미리보기 토글(`segmentedControlStyles`), allow-list 검증기(`lib/utils/validate-guide-html.ts`), AST 렌더러(`render-guide-ast.tsx`), 언어별 빈 상태(`GuideCardEmptyLang`). 같은 패턴을 게시글에 적용한다.

결정 두 가지:

- **네 값 모두 필수**(D13). `Admin Guides`와 같은 규칙이라 fallback 로직이 아예 필요 없다. 대가는 운영 부담이다 — 공지 하나를 올릴 때마다 영문을 반드시 작성해야 한다.
- **조회는 양쪽을 모두 반환**한다. `lang` 파라미터를 두지 않는다. 화면이 언어를 고르므로 전환 시 재조회가 없고, 저장 단계에서 빈 언어를 막으므로 fallback 규칙을 계약에 넣을 필요도 없다. 대가는 payload가 2배가 되는 것인데, 페이지네이션 없는 목록 규모(D10)에서는 문제되지 않는다.

### 2.10 본문 이미지 — 업로드 API를 하나 추가한다

본문에 이미지를 넣고 위치를 조정하는 요구가 추가됐다. 범위는 **본문 안에서의 순서(위치)까지**이며, 정렬·크기 조절은 포함하지 않는다(D14).

`POST /install/v1/admin/posts/images`를 추가한다. 업로드 → URL 반환 → 그 URL을 본문 `img.src`에 저장하는 흐름이다.

| 옵션 | 내용 | 판단 |
| --- | --- | --- |
| A. 외부 URL만 허용 | 업로드 없이 기존 이미지 URL을 붙여넣기 | 기각. "업로드 가능"이 요구사항이다 |
| B. base64 인라인 | 본문에 이미지 바이트를 직접 담음 | **기각.** 단건 응답이 수 MB가 되고, 이미지가 본문과 함께 캐시·재전송된다. URL 참조면 브라우저가 이미지를 따로 캐시한다 |
| **C. 업로드 API + URL 참조** | 파일은 저장소에, 본문에는 URL만 | **채택** |

계약에 따라오는 것들:

- allow-list에 `img`와 `src`/`alt`/`width`/`height`를 추가한다. `class`/`style`/`align`은 넣지 않는다 — 넣는 순간 "관리자는 폰트 스타일을 수정할 수 없다"는 기존 요구사항에 구멍이 생기고, 정렬 기능을 안 만들기로 한 D14와도 어긋난다.
- `width`/`height`는 업로드 응답이 준 원본 픽셀 크기다. **관리자 입력값이 아니다.** 아코디언이 펼쳐질 때 이미지 로드로 레이아웃이 밀리는 것을 막기 위한 값이며, 표시 폭은 CSS가 통제한다.
- `img.src`는 허용된 저장소 호스트 prefix로 시작해야 한다. 임의 외부 URL은 `POST_CONTENT_INVALID`로 거부한다.
- 프론트엔드는 서버 allow-list만으로 끝나지 않는다. 렌더러가 `dangerouslySetInnerHTML` 없이 타입이 정의된 노드만 그리므로, `validate-guide-html.ts`와 `render-guide-ast.tsx` 양쪽에 `img` 노드를 추가해야 이미지가 화면에 나온다.
- 업로드만으로는 게시글에 연결되지 않는다. 저장하지 않고 이탈하면 고아 파일이 남는다 — 정리 정책이 필요하다(D16).

#### 조각 업로드를 배제하기 위한 크기 상한 (D17)

**파일 1개당 5MB 상한을 계약의 전제로 둔다.** 상한이 없으면 큰 파일을 위해 조각 업로드(S3 Multipart / GCS Resumable)를 고려해야 하고, 그러면 initiate → upload-parts → complete 3단계와 이어올리기 상태 관리가 계약에 들어온다. 상한을 두면 업로드는 요청 한 번으로 끝난다.

용어를 구분해 둔다. 혼동하면 스펙을 잘못 읽는다.

| 용어 | 의미 | 채택 |
| --- | --- | --- |
| `multipart/form-data` | 파일 하나를 담는 HTTP content-type. 요청 1회 | 채택 |
| Multipart / Resumable upload | 큰 파일을 조각내 올리는 프로토콜 | **배제** |

상한이 고정이므로 따라오는 결정들:

- BFF가 바이트를 버퍼링해 저장소로 넘겨도 메모리 사용량이 유계다. 브라우저가 저장소에 직접 올리는 **서명 URL 방식은 도입하지 않는다** — 엔드포인트가 늘고 저장소 자격증명이 클라이언트 경계 밖으로 나간다.
- 에디터가 업로드 전에 크기·형식을 먼저 검사한다. 서버 검증(`IMAGE_TOO_LARGE` / `UNSUPPORTED_IMAGE_TYPE`)은 그대로 두되, 5MB를 다 전송한 뒤 413을 받는 경험은 피한다.
- 5MB는 스크린샷 용도로 넉넉한 값이다. 더 조이려면 2MB가 현실적인 후보이며, **올리는 방향은 D17을 다시 여는 것**이다.

#### 남는 구멍 — 게시글 전체 무게 (D18)

파일 1개 상한은 게시글 전체를 제한하지 않는다. 5MB 이미지 20장을 넣은 게시글이 만들어질 수 있다. §2.3으로 목록에서 본문이 빠졌으므로 목록 응답은 영향을 받지 않지만, **그 글을 펼치는 사용자는 100MB를 받는다.** 위험이 목록에서 펼침 시점으로 옮겨갔을 뿐 사라지지는 않았다.

게시글당 이미지 개수 상한이나 본문 길이 상한이 필요한지 확인이 필요하다. 이번 범위에는 넣지 않았다.

## 3. 관련 BFF Swagger 위치

- Tag 가이드: `../tag-guides/faq-notices.md`
- 인라인 BFF Swagger 섹션 상태: Draft

## 4. 영향

- **화면 / 사용 주체**: 메인 페이지(FAQ/공지 아코디언, Pass 배너), Category별 상세 페이지, Admin 게시글 목록·수정·숨김·고정 화면, Admin Category 관리 화면
- **enum / state 영향**: `PostType`(`FAQ` / `NOTICE`) 신규. 카탈로그(`catalogs/enums-and-states.md`)가 아직 부트스트랩되지 않아 Tag 가이드 §6에만 기록한다.
- **error code 영향**: 아래 4건이 **신규 후보**다. 이 문서가 `Accepted`가 되기 전에는 `catalogs/error-codes.md`에 행을 추가하지 않는다(관리 계획 §4.4.1 — 트리거는 "backend가 추가하거나 추가 예정"이며, 현재는 FE 제안 단계).

  | 후보 코드 | HTTP | 발생 지점 |
  | --- | --- | --- |
  | `POST_CONTENT_INVALID` | 400 | `POST /install/v1/admin/posts`, `PUT /install/v1/admin/posts/{postId}` — 본문 allow-list·공백 위반 |
  | `POST_NOT_FOUND` | 404 | `posts/{postId}`를 다루는 모든 API |
  | `CATEGORY_NOT_FOUND` | 404 | 없는 `categoryId`로 게시글 생성/수정 |
  | `CATEGORY_IN_USE` | 409 | 게시글이 남아 있는 Category 삭제 시도 |
  | `CATEGORY_NAME_DUPLICATED` | 409 | 같은 유형 안에 동일한 Category명 존재 |
  | `UNSUPPORTED_IMAGE_TYPE` | 400 | `POST /install/v1/admin/posts/images` — png/jpeg/webp 외 형식 |
  | `IMAGE_TOO_LARGE` | 413 | `POST /install/v1/admin/posts/images` — 5MB 초과 |

  `VALIDATION_FAILED`는 기존 코드를 재사용하며 `관련 API Tag` 셀에 `FAQ & Notices` 추가가 필요하다.
- **다른 Tag 영향**: 없음. `Admin Guides`와 저장 대상이 겹치지 않는다.

## 5. 결정 사항

각 줄은 확인이 필요한 항목이며, 확정되면 Tag 가이드 본문에 반영한다.

| ID | 항목 | 이 문서의 기본안 | 확정 필요 |
| --- | --- | --- | --- |
| D1 | 정렬 기준 | `pinned desc → publishedAt desc`. 고정 그룹 내부에서 시간순 | 예 — 요구사항 원문이 모호 |
| D2 | FAQ / Notice 리소스 | 단일 `posts` + `type` 필드 | 아니오 — 메뉴 분리 여부와 무관하게 성립 |
| D3 | Category의 type 소속 | Category는 `type`을 가지며 FAQ/Notice가 **공유하지 않는다** | 예 |
| D4 | Category 삭제 정책 | 게시글이 1건이라도 있으면 `409 CATEGORY_IN_USE`로 거부 | 예 — "다른 Category로 이동" / "미분류 처리" 대안 존재 |
| D5 | 숨김 게시글 직접 접근 | 사용자 API에서 `404 POST_NOT_FOUND` (403이 아님 — 존재 자체를 노출하지 않는다) | 예 |
| D6 | 본문 형식 | `Admin Guides` HTML allow-list 재사용 + `img` 추가(§2.10). 첨부파일 미지원 | 아니오 — D14로 확정 |
| D7 | Category 표시 순서 | `displayOrder` 필드는 응답에 두되, **순서 변경 API는 이번 범위에서 제외** | 예 |
| D8 | Category 수정(이름 변경) | 요구사항에 없으므로 API 미포함 | 예 |
| D9 | Pass 소개 배너 | 고정 콘텐츠로 보고 **BFF API를 두지 않는다** | 예 — Admin 편집이 필요하면 `Admin Guides` Tag 재사용을 우선 검토 |
| D10 | 페이지네이션 | 사용자·Admin 목록 모두 **전체 배열 반환**. 페이징 없음 | 예 — 게시글 증가 시 Admin 목록부터 Spring `Page` 도입 |
| D11 | 관리자 권한 판정 | BFF가 `/install/v1/admin/**` 경로에서 기존 인증 컨텍스트로 판정. 별도 role 파라미터 없음 | 예 — 기존 admin 판정 기준 확인 필요 |
| D12 | 게시글 수정 method | `PUT` (전체 교체). FE가 partial update 요청을 만들지 않는다 | 아니오 — FE 결정. §2.8의 "생략 = 비움" 주의사항이 따라온다 |
| D13 | 다국어 필수 여부 | `titles.ko/en`, `contents.ko/en` 네 값 모두 필수 | 아니오 — 확정. `Admin Guides`와 동일 |
| D14 | 이미지 위치 조정 범위 | 본문 내 순서만. 정렬·크기 조절 없음 | 아니오 — 확정 |
| D15 | 이미지 저장소 | BFF 업로드 엔드포인트 + 오브젝트 스토리지(GCS 검토 중) | 예 — 저장소·URL 공개 범위·서명 URL 여부는 BE 협의 필요 |
| D16 | 고아 이미지 정리 | 미정 | 예 — 업로드 후 미저장분, 게시글에서 제거된 이미지의 수명 정책 |
| D17 | 이미지 크기 상한 | 파일 1개당 5MB · 요청 1회 1개. 조각(resumable) 업로드 배제 | 아니오 — 확정. 상한을 올리려면 이 결정을 다시 연다 |
| D18 | 게시글 전체 무게 | 제한 없음 | 예 — 게시글당 이미지 개수 또는 본문 길이 상한이 필요한지 |
| D19 | 목록 응답의 본문 포함 여부 | **미포함.** 아코디언 펼침 시 단건 조회 | 아니오 — 확정. §2.3의 초안 결정을 뒤집은 것 |

## 6. 후속 작업

- D1~D11 확정 → Tag 가이드 §5 반영, 이 문서 `Reviewing`으로 전환
- `Accepted` 전환 시 `catalogs/error-codes.md`에 §4의 신규 코드 4건 추가 + `VALIDATION_FAILED` 행의 `관련 API Tag`에 `FAQ & Notices` 추가 (관리 계획 §4.4.2 Added 흐름)
- backend 담당·PR 링크 확정 후 `담당` / `관련 PR` 메타 갱신
- FE-first이므로 인라인 Swagger는 FE가 사용을 시작하기 전까지 `Accepted`, BE 배포 후 `Released`로 전환 (관리 계획 §4.5)

## 7. 관련 링크

- 관련 Tag 가이드 변경 이력 행: `../tag-guides/faq-notices.md` §8, 26.08.12 Added
- 백엔드 PR / 릴리스 노트: TBD
- 운영 Slack thread / 인시던트 ID: TBD
