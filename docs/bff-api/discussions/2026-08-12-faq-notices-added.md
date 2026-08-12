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

### 2.3 본문 조회 — 목록 응답에 본문을 포함한다

메인 페이지가 아코디언이므로, 펼칠 때마다 상세 API를 호출하면 클릭당 네트워크 왕복이 생긴다. 게시글 수가 수백 건 규모가 아니므로 목록 응답에 `content`를 포함해 아코디언을 즉시 펼친다.

단건 조회 API(`GET /install/v1/posts/{postId}`)는 **목록용이 아니라 딥링크용**으로만 둔다. 숨김 게시글 URL 직접 접근 시 404를 반환하는 지점이 필요하다(§5 D5).

### 2.4 Category별 그룹화 — 별도 API를 두지 않는다

상세 페이지의 "Category별 그룹화"는 `GET /install/v1/posts` 응답을 `categoryId` 기준으로 클라이언트가 묶으면 된다. 그룹화 전용 응답 형태를 BFF에 추가하면 같은 데이터를 두 가지 형태로 서빙하게 된다. Category의 **표시 순서와 이름**만 `GET /install/v1/post-categories`로 제공한다.

### 2.5 숨김 — 삭제가 아닌 상태 전이

`DELETE`를 두지 않는다. `PUT /install/v1/admin/posts/{postId}/hidden`의 `{hidden: boolean}` 하나로 숨김/복구를 모두 처리한다. 요구사항이 "실제 삭제가 아닌 숨김 처리"이므로 삭제 엔드포인트가 존재하면 안 된다.

`pinned`도 같은 이유로 고정/해제를 별도 엔드포인트로 나누지 않고 `PUT .../pinned`의 `{pinned: boolean}` 하나로 둔다.

### 2.6 본문 HTML 정책 — Admin Guides 정책을 그대로 재사용한다

본문이 단순 텍스트인지 서식을 지원하는지가 미확정이지만, 같은 저장소의 `Admin Guides`가 이미 HTML allow-list 검증(`GUIDE_CONTENT_INVALID`)을 운영 중이다. 별도 정책을 새로 정의하는 대신 **동일한 allow-list**를 적용하고, 에러 코드만 이 Tag용으로 분리한다(`POST_CONTENT_INVALID`). 줄바꿈·링크가 `p`/`br`/`a`로 커버되므로 요구사항을 만족한다.

이미지·첨부파일은 allow-list에 `img`가 없으므로 **이번 범위에서 지원하지 않는다**. → §5 D6.

### 2.7 수정 시 시각 — publishedAt은 불변

`PATCH /install/v1/admin/posts/{postId}`는 `updatedAt`만 갱신하고 `publishedAt`은 건드리지 않는다. 목록 정렬 기준이 `publishedAt`이므로, 오타 하나를 고쳤다고 게시글이 목록 최상단으로 올라오면 안 된다.

## 3. 관련 BFF Swagger 위치

- Tag 가이드: `../tag-guides/faq-notices.md`
- 인라인 BFF Swagger 섹션 상태: Draft

## 4. 영향

- **화면 / 사용 주체**: 메인 페이지(FAQ/공지 아코디언, Pass 배너), Category별 상세 페이지, Admin 게시글 목록·수정·숨김·고정 화면, Admin Category 관리 화면
- **enum / state 영향**: `PostType`(`FAQ` / `NOTICE`) 신규. 카탈로그(`catalogs/enums-and-states.md`)가 아직 부트스트랩되지 않아 Tag 가이드 §6에만 기록한다.
- **error code 영향**: 아래 4건이 **신규 후보**다. 이 문서가 `Accepted`가 되기 전에는 `catalogs/error-codes.md`에 행을 추가하지 않는다(관리 계획 §4.4.1 — 트리거는 "backend가 추가하거나 추가 예정"이며, 현재는 FE 제안 단계).

  | 후보 코드 | HTTP | 발생 지점 |
  | --- | --- | --- |
  | `POST_CONTENT_INVALID` | 400 | `POST/PATCH /install/v1/admin/posts` — 본문 allow-list·공백 위반 |
  | `POST_NOT_FOUND` | 404 | `posts/{postId}`를 다루는 모든 API |
  | `CATEGORY_NOT_FOUND` | 404 | 없는 `categoryId`로 게시글 생성/수정 |
  | `CATEGORY_IN_USE` | 409 | 게시글이 남아 있는 Category 삭제 시도 |

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
| D6 | 본문 형식 | `Admin Guides` HTML allow-list 재사용. 이미지·첨부 미지원 | 예 |
| D7 | Category 표시 순서 | `displayOrder` 필드는 응답에 두되, **순서 변경 API는 이번 범위에서 제외** | 예 |
| D8 | Category 수정(이름 변경) | 요구사항에 없으므로 API 미포함 | 예 |
| D9 | Pass 소개 배너 | 고정 콘텐츠로 보고 **BFF API를 두지 않는다** | 예 — Admin 편집이 필요하면 `Admin Guides` Tag 재사용을 우선 검토 |
| D10 | 페이지네이션 | 사용자·Admin 목록 모두 **전체 배열 반환**. 페이징 없음 | 예 — 게시글 증가 시 Admin 목록부터 Spring `Page` 도입 |
| D11 | 관리자 권한 판정 | BFF가 `/install/v1/admin/**` 경로에서 기존 인증 컨텍스트로 판정. 별도 role 파라미터 없음 | 예 — 기존 admin 판정 기준 확인 필요 |

## 6. 후속 작업

- D1~D11 확정 → Tag 가이드 §5 반영, 이 문서 `Reviewing`으로 전환
- `Accepted` 전환 시 `catalogs/error-codes.md`에 §4의 신규 코드 4건 추가 + `VALIDATION_FAILED` 행의 `관련 API Tag`에 `FAQ & Notices` 추가 (관리 계획 §4.4.2 Added 흐름)
- backend 담당·PR 링크 확정 후 `담당` / `관련 PR` 메타 갱신
- FE-first이므로 인라인 Swagger는 FE가 사용을 시작하기 전까지 `Accepted`, BE 배포 후 `Released`로 전환 (관리 계획 §4.5)

## 7. 관련 링크

- 관련 Tag 가이드 변경 이력 행: `../tag-guides/faq-notices.md` §8, 26.08.12 Added
- 백엔드 PR / 릴리스 노트: TBD
- 운영 Slack thread / 인시던트 ID: TBD
