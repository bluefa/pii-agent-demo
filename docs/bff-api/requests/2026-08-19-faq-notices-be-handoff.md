# 공지사항 · FAQ BFF API — 구현 요청

- 대상: `install/v1` BFF 의 `FAQ & Notices` Tag 전체
- 요청자: Pass FE
- 작성일: 2026-08-19
- **이 문서 하나가 전달물의 전부다.** 계약 세부까지 여기 다 있고, 별도 첨부는 없다.

## 0. 요약

FAQ 와 공지사항 게시글, 그리고 게시글이 속하는 Category 를 조회·관리하는 API 다.
FAQ 와 Notice 는 필드가 같아 **단일 `posts` 리소스** + `type`(`FAQ`/`NOTICE`) 구분이다.
게시글 **삭제는 없고 숨김 전이만 있다.** Title · 본문은 ko/en 쌍이며, 본문은 목록에 싣지
않고 단건 조회로만 나간다.

구현은 두 Phase 로 나눈다. **경로와 건수(12건)는 두 Phase 가 동일**해서, Phase 1 을 먼저
배포해도 Phase 2 가 어떤 경로도 깨지 않는다.

| | 범위 | 저장 요청 |
| --- | --- | --- |
| **Phase 1 — 지금 구현** | 이미지 없는 게시글 · Category 전체 | `application/json` |
| **Phase 2 — §3 합의 후 착수** | 이미지를 저장 요청에 묶는다 | `multipart/form-data` |

Phase 를 나눈 이유: 이미지 저장(스토리지 연동)은 BE 준비가 안 됐고, 나머지 계약은 확정이라
먼저 나간다. FE 의 저장·조회 호출은 이미 Phase 1 계약(JSON)과 일치한다.

## 1. 공통 규칙

- `/install/v1/admin/**` 은 **ADMIN 역할 필수.** 나머지는 인증 불필요 — 공지사항은 로그인
  없이 보는 화면이다
- wire 는 camelCase, 시각은 ISO-8601 UTC 문자열
- 에러 응답은 전 엔드포인트 공통 스키마다. `message` 는 관리자 화면에 그대로 보여 줄 수
  있는 문장으로 쓴다 — "이미지가 잘못됐습니다"가 아니라 **무엇이** 걸렸는지 담는다

```jsonc
// ErrorMessage
{
  "timestamp": "2026-08-19T02:27:09.123Z",
  "status": "BAD_REQUEST",
  "code": "POST_CONTENT_INVALID",   // §2.5 / §3.8 의 enum. nullable
  "message": "허용되지 않는 태그입니다: <table>",
  "path": "/install/v1/admin/posts"
}
```

---

## 2. Phase 1 — 이미지 없는 게시글 (지금 구현)

### 2.1 엔드포인트 12건

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/install/v1/posts` | 사용자용 목록. 숨김 제외. **본문 없음**. `?type=` `?categoryId=` 필터 |
| GET | `/install/v1/posts/{postId}` | 본문 포함 단건 (아코디언 펼침 · 딥링크). **숨김이면 404** |
| GET | `/install/v1/post-categories` | 사용자용 Category 목록. 비활성 제외. `?type=` 필터. `displayOrder` 오름차순 |
| GET | `/install/v1/admin/posts` | Admin 목록. **숨김 포함**, `hidden` 노출. 본문 없음. `?type=` `?categoryId=` `?hidden=` 필터 |
| POST | `/install/v1/admin/posts` | 등록 → `201 AdminPost`. 생성 시 `pinned=false` `hidden=false` |
| GET | `/install/v1/admin/posts/{postId}` | 본문 포함 단건 (수정 진입). 숨김도 200 |
| PUT | `/install/v1/admin/posts/{postId}` | **전체 교체** 수정 → `200 AdminPost` |
| PUT | `/install/v1/admin/posts/{postId}/hidden` | 숨김/복구. body `{"hidden": bool}`. idempotent |
| PUT | `/install/v1/admin/posts/{postId}/pinned` | 고정/해제. body `{"pinned": bool}`. idempotent |
| GET | `/install/v1/admin/post-categories` | Admin Category 목록. 비활성 포함, `postCount` 포함. `?type=` |
| POST | `/install/v1/admin/post-categories` | Category 추가 → `201` |
| DELETE | `/install/v1/admin/post-categories/{categoryId}` | Category 삭제 → `204`. 잔여 게시글 있으면 409 |

> 구 초안(2026-08-12)에 있던 `POST /install/v1/admin/posts/images` (독립 이미지 업로드)는
> **만들지 않는다.** Phase 2 에서 업로드가 저장 요청 안으로 들어오면서 삭제된 경로다.

### 2.2 스키마

```jsonc
// PostType: "FAQ" | "NOTICE"

// LocalizedText — ko/en 쌍. 응답에서는 둘 다 항상 존재.
// 요청에서는 둘 다 필수이며, HTML 태그를 제거한 뒤 공백만 남으면 거부한다.
{ "ko": "...", "en": "..." }

// PostSummary — 사용자 목록의 원소. contents 없음.
{
  "id": 41,
  "type": "NOTICE",
  "categoryId": 3,            // null = 미분류
  "categoryName": "점검",     // categoryId 가 null 이면 같이 null
  "titles": { "ko": "...", "en": "..." },
  "publishedAt": "2026-08-12T01:00:00Z",  // 최초 등록 시각. 수정으로 절대 안 변한다
  "updatedAt": "2026-08-12T01:00:00Z",
  "pinned": false
}

// Post — 사용자 단건. PostSummary + contents.
// hidden 필드는 존재하지 않는다 — false 인 게 아니라 필드 자체가 없다.
{ /* PostSummary 전부 */, "contents": { "ko": "<p>...</p>", "en": "<p>...</p>" } }

// AdminPostSummary — Admin 목록의 원소. PostSummary +
{ /* PostSummary 전부 */, "hidden": false, "hiddenAt": null }
// hiddenAt: 마지막 숨김 시각. 복구하면 null 로 돌아간다 (이력이 아니라 현재 상태의 부가 정보)

// AdminPost — Admin 단건이자 등록·수정·상태 전이의 응답. AdminPostSummary +
{ /* AdminPostSummary 전부 */,
  "contents": { "ko": "...", "en": "..." },
  "createdBy": "admin01", "updatedBy": "admin02" }

// PostCategory — 사용자용
{ "id": 3, "type": "NOTICE", "name": "점검", "displayOrder": 1 }

// AdminPostCategory — Admin 용. PostCategory +
{ /* PostCategory 전부 */, "active": true, "postCount": 2 }
// postCount 는 숨김 게시글을 포함한 수다

// PostCreateRequest
{
  "type": "NOTICE",           // 필수
  "categoryId": 3,            // 생략 또는 null = 미분류
  "titles":   { "ko": "...", "en": "..." },   // 필수, 둘 다
  "contents": { "ko": "...", "en": "..." }    // 필수, 둘 다
}

// PostUpdateRequest — type 없음(변경 미지원). 전체 교체:
// 생략된 필드는 "유지"가 아니라 "비움"이다. categoryId 를 빼면 미분류가 된다.
{ "categoryId": 3, "titles": { ... }, "contents": { ... } }

// PostCategoryCreateRequest — displayOrder 는 같은 type 안 마지막 순번 자동 부여
{ "type": "NOTICE", "name": "점검" }
```

### 2.3 동작 규칙

**정렬** — 사용자·Admin 목록 모두 서버가 정렬해 내려주고 클라이언트는 재정렬하지 않는다.
1순위 `pinned` 내림차순, 2순위 `publishedAt` 내림차순. 고정과 일반은 **분리된 두 그룹**이고
그룹 안에서만 시간순이다. `sort` 파라미터는 없다. 기대 결과:

| 순서 | 게시글 | pinned | publishedAt |
| --- | --- | --- | --- |
| 1 | FAQ A | true | 2026-08-12 |
| 2 | 공지 B | true | 2026-08-10 |
| 3 | FAQ C | false | 2026-08-11 |
| 4 | 공지 D | false | 2026-08-09 |

FAQ C(08-11)가 더 최신인데 공지 B(08-10)보다 **뒤**다. 이 순서가 안 나오면 잘못 구현한 것이다.

**숨김** — 삭제 API 는 없다. 사용자용 API 는 숨김 글을 어떤 경로로도 반환하지 않으며, 직접
접근은 `403` 이 아니라 **`404 POST_NOT_FOUND`** 다(403 은 "존재한다"를 노출한다).
`hidden=true` 전이 시 `hiddenAt` 기록, `false` 시 null. 같은 상태로 재전이해도 200.

**수정** — `publishedAt` 은 절대 갱신하지 않고 `updatedAt` 만 갱신한다(오타 수정이 글을
목록 최상단으로 끌어올리면 안 된다). 고정/숨김 전이는 `updatedAt` 을 갱신하지 **않는다** —
내용이 바뀐 경우에만 갱신한다.

**다국어** — 조회는 언어를 고르지 않고 양쪽을 다 준다(`lang` 파라미터 없음). 언어별
fallback 없음 — 한쪽이 비는 상태를 저장 단계에서 막기 때문이다.

**Category** — `type` 에 소속되며 FAQ/Notice 가 Category 를 공유하지 않는다. 같은 type
안 `name` 중복은 `409 CATEGORY_NAME_DUPLICATED`. 삭제는 잔여 게시글(숨김 포함) 0건일
때만 — 아니면 `409 CATEGORY_IN_USE`. 등록·수정에서 없는/비활성 `categoryId` 는
`404 CATEGORY_NOT_FOUND`. 이름 수정·순서 변경 API 는 범위 밖.

**페이지네이션 없음** — 목록은 전체 배열이다. 게시글이 늘면 Admin 목록부터 Page envelope
을 도입한다(그때 별도 논의).

### 2.4 본문 HTML 검증 (Phase 1)

허용 밖 HTML 은 sanitize 해서 저장하지 말고 **`400 POST_CONTENT_INVALID` 로 거부**한다.

| 구분 | 허용 값 |
| --- | --- |
| Tags | `h4` `p` `br` `ul` `ol` `li` `strong` `em` `code` `a` — **`img` 없음** |
| Attributes | `a.href` `a.target` `a.rel` |
| href | `http://` `https://` `mailto:` `/...` |

`//` protocol-relative · `javascript:` · `data:` · inline handler · `style`/`class` 속성 금지.
**`img` 는 Phase 1 에서 그 자체로 거부다** — 업로드 경로가 없어 유효한 `src` 가 존재할 수
없다. Phase 2 가 allow-list 에 `img` 를 추가한다(§3.7).

### 2.5 에러 코드 (Phase 1)

| code | HTTP | 언제 |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | 요청 구조 위반 (필수 필드 누락, 빈 제목/본문 등) |
| `POST_CONTENT_INVALID` | 400 | 본문 HTML allow-list 위반 |
| `POST_NOT_FOUND` | 404 | 없는 게시글, 또는 사용자 경로의 숨김 게시글 |
| `CATEGORY_NOT_FOUND` | 404 | 없는/비활성 categoryId |
| `CATEGORY_NAME_DUPLICATED` | 409 | 같은 type 안 이름 중복 |
| `CATEGORY_IN_USE` | 409 | 잔여 게시글이 있는 Category 삭제 시도 |

### 2.6 수용 기준

1. curl 왕복 시나리오가 통과한다: 등록 → Admin 목록 → 단건 → 수정(생략 필드가 비워지는
   것 확인) → 숨김(사용자 단건 404 · Admin 단건 200) → 복구 → 고정(목록 최상단, §2.3 표
   순서 재현) → Category 추가 · 게시글 소속 → 삭제 409 → 소속 해제 후 삭제 204
2. 거부 케이스가 지정된 code 로 떨어진다: 빈 제목 → `VALIDATION_FAILED`, `img`/허용 밖
   태그 포함 본문 → `POST_CONTENT_INVALID`, 없는 postId → `POST_NOT_FOUND`
3. **swagger yaml 에 12건이 반영된다.** 이 yaml 이 FE codegen 의 입력이다 — yaml 에 없는
   필드는 FE 가 쓸 수 없다

---

## 3. Phase 2 — 이미지를 저장 요청에 묶는다 (합의 후 착수)

### 3.1 왜 이렇게 하는가

독립 업로드(구 초안 방식)는 이미지를 **떠 있는 파일**로 만든다: 업로드 후 저장 없이 이탈하면
고아 파일, 업로드 성공 후 파일 유실이면 본문이 죽은 URL 을 참조, 글에서 이미지를 빼도
파일은 남는다 — 참조 수를 세는 정리 작업이 별도로 필요해진다.

업로드 시점을 **저장으로 미루면** 셋 다 원리상 사라진다. 저장 전에는 바이트가 서버로 가지
않고, 에디터의 미리보기·크기·위치 조작은 전부 로컬에서 일어난다.
비용은 저장 실패 재시도 시 바이트 재전송(최대 10MB)이며, 인지하고 선택했다.

### 3.2 저장 요청 형태

`POST /install/v1/admin/posts` 와 `PUT /install/v1/admin/posts/{postId}` 가
`multipart/form-data` 가 된다. **경로는 그대로, 파트는 두 종류다:**

| 파트 이름 | 개수 | Content-Type | 내용 |
| --- | --- | --- | --- |
| `post` | 정확히 1 | `application/json` | **Phase 1 의 request body 와 한 글자도 다르지 않은 JSON** |
| `files` | 0 ~ 10 | `image/png` `image/jpeg` `image/webp` | 새로 추가된 이미지. `filename` 이 **키** |

새 이미지는 아직 URL 이 없으므로 본문이 `cid:` 스킴으로 키를 참조한다(RFC 2392 —
multipart 파트를 가리키는 표준 스킴). 키는 FE 가 만들며 형식은 `^[a-z0-9]{8,32}$`.
같은 키를 `contents.ko` 와 `contents.en` 이 함께 참조할 수 있다 — 파트는 하나다.

수정 요청 예시 (한국어에 새 그림 1장, 영어가 같은 그림 재사용, 기존 그림 1장 유지):

```
PUT /install/v1/admin/posts/41
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="post"
Content-Type: application/json

{"categoryId":3,
 "titles":{"ko":"점검 안내","en":"Maintenance"},
 "contents":{
   "ko":"<p>안내</p><img src=\"cid:k7f3a91c\" alt=\"구성도.png\" width=\"800\" height=\"450\"><img src=\"https://storage.example/posts/41/9c22.png\" alt=\"이전.png\" width=\"640\" height=\"360\">",
   "en":"<p>Notice</p><img src=\"cid:k7f3a91c\" alt=\"diagram.png\" width=\"800\" height=\"450\">"}}
------X
Content-Disposition: form-data; name="files"; filename="k7f3a91c"
Content-Type: image/png

<바이트>
------X--
```

- `cid:k7f3a91c` → `files` 파트 중 `filename="k7f3a91c"`. **새로 저장한다**
- `https://storage.example/...` → 41번 글이 이미 가진 파일. **유지한다**
- 41번 글이 가진 파일 중 본문 어디에도 없는 것 → **삭제한다**

응답은 Phase 1 과 같은 `AdminPost` 다. 단 `contents` 의 `cid:` 는 전부 실제 스토리지 URL
로 치환된 상태여야 한다 — **저장된 본문에 `cid:` 는 남지 않는다.**

### 3.3 서버 저장 알고리즘

전체가 하나의 트랜잭션이다. 실패 응답이면 글도 파일 참조도 남지 않는다.
(스토리지 쓰기가 DB 트랜잭션 밖이면 실패 시 파일 정리는 BE 내부에서 해결한다.)

1. `post` 파트 JSON 파싱 · 필수값 검사
2. `contents.ko` · `contents.en` allow-list 검사 (§3.7)
3. 본문의 모든 `img.src` 수집 — 두 종류다
   - `cid:<키>` → 대응 `files` 파트 필수. 없으면 `POST_IMAGE_REF_MISSING`
   - URL → **이 글이 소유한 파일**이어야 한다. 아니면 `POST_IMAGE_REF_UNKNOWN`
     (등록은 소유 파일이 없으므로 URL 참조 자체가 이 오류다 — §3.10-③)
4. 어떤 본문도 참조하지 않는 `files` 파트가 있으면 `POST_IMAGE_UNREFERENCED`
   — FE 버그를 조용히 넘기지 않기 위해서다
5. 상한 검사 — **ko/en 합산, 같은 키·같은 URL 은 1회만 계산**
   - 개수 10 초과 → `POST_IMAGE_LIMIT_EXCEEDED` / 총 10MB 초과 → `POST_SIZE_LIMIT_EXCEEDED`
   - 파일 1개 5MB 초과 → `IMAGE_TOO_LARGE` / 허용 밖 MIME → `UNSUPPORTED_IMAGE_TYPE`
6. `files` 를 스토리지에 쓴다. 같은 글 안에서 바이트가 완전히 같은 파트는 한 파일로
   저장한다(sha256 등)
7. 본문의 `cid:<키>` 를 해당 파일의 스토리지 URL 로 치환
8. 치환된 본문으로 글 저장
9. 이 글이 소유했지만 새 본문 어디에도 없는 파일 **삭제**
10. 커밋

### 3.4 파일 소유는 글 단위다

한 파일은 정확히 한 글에 속한다. 글을 지우는 개념이 없으므로(숨김만 존재) 파일 수명은
저장 알고리즘 9단계가 전부다 — **참조 카운트도, 고아 파일 정리 배치도 필요 없다.**
두 글이 같은 그림을 쓰면 저장소에 두 벌이 생기는데, 실제 중복 흐름("한국어에 넣은
스크린샷을 English 탭에 다시 넣기")은 **같은 글 안**이라 6단계가 한 파일로 접는다.

### 3.5 이미지 서빙은 스토리지가 한다 — 조회 API 를 만들지 않는다

저장된 `img.src` 는 **브라우저가 직접 접근하는 스토리지 URL** 이다. FE 는 그 URL 을
`<img>` 에 그대로 넣어 그리고, 허용된 스토리지 호스트 prefix 로 시작하는지만 검사한다.
BFF 는 파일을 쓰고 지울 뿐 서빙하지 않는다 — BFF 경유 조회는 렌더링 시 URL 재작성을
강제하고, 글 하나당 이미지 10장의 조회 트래픽을 BFF 에 태우며, 스토리지가 공짜로 주는
HTTP 캐싱을 다시 구현해야 한다.

숨김 글의 이미지 URL 은 아는 사람에게 계속 열린다 — 숨김은 게시글 조회 API 가 막는
것으로 충분하다고 판단했다.

### 3.6 수정 진입 읽기에 `images` 추가

`GET /install/v1/admin/posts/{postId}` 응답에 이 글이 소유한 파일 목록을 더한다.

```jsonc
{ /* AdminPost 전부 그대로 */,
  "images": [ { "url": "https://storage.example/posts/41/9c22.png", "bytes": 1843200 } ] }
```

이게 없으면 수정 화면의 용량 예산이 깨진다 — FE 는 "이미지 N장 · X MB / 10MB" 카운터로
저장 전에 상한을 막는데, 기존 이미지의 바이트 크기는 본문 HTML 어디에도 없다. 이 필드가
없으면 관리자는 작성을 다 마친 저장 시점에야 `POST_SIZE_LIMIT_EXCEEDED` 를 만난다.
사용자용 단건에는 넣지 않는다 — 세는 화면이 수정 화면뿐이다.

### 3.7 allow-list 변경 (Phase 2)

Tags 에 `img`, Attributes 에 `img.src` `img.alt` `img.width` `img.height` 가 추가된다.
`img.src` 규칙은 **요청과 저장이 갈라진다:**

| | 허용 값 |
| --- | --- |
| 요청 본문 (`post` 파트) | `cid:<키>` 또는 **이 글이 소유한** 스토리지 URL |
| 저장된 본문 | 스토리지 URL **만**. `cid:` 는 저장되지 않는다 |

`cid:` 는 allow-list 에 추가되는 스킴이 아니라 **요청에서만 유효한 임시 참조**다.
`//` · `javascript:` · `data:` 거부는 그대로다.

### 3.8 에러 코드 추가분 (Phase 2)

| code | HTTP | 언제 |
| --- | --- | --- |
| `POST_IMAGE_REF_MISSING` | 400 | 본문의 `cid:` 에 대응하는 파트가 없다 |
| `POST_IMAGE_REF_UNKNOWN` | 400 | 본문이 이 글 소유가 아닌 이미지 URL 을 가리킨다 |
| `POST_IMAGE_UNREFERENCED` | 400 | 어떤 본문도 참조하지 않는 `files` 파트가 있다 |
| `POST_IMAGE_LIMIT_EXCEEDED` | 400 | 이미지 10장 초과 |
| `POST_SIZE_LIMIT_EXCEEDED` | 400 | 이미지 총합 10MB 초과 |
| `IMAGE_TOO_LARGE` | 413 | 파일 1개 5MB 초과 |
| `UNSUPPORTED_IMAGE_TYPE` | 400 | png / jpeg / webp 아님 |

앞의 3개가 신규다. 전부 `message` 에 **어느 키/어느 URL** 인지 담아 준다.

### 3.9 상한과 인프라

파일 1개 5MB · 글 1개 10장 / 10MB (ko+en 합산, 중복 1회). 따라서 게이트웨이/서버의
`max-request-size` 는 **최소 12MB** (이미지 10MB + JSON + multipart 오버헤드).

### 3.10 착수 전에 답해 줄 것 3건

1. **`width`/`height` 를 서버가 덮어쓰지 않는다** — 검증만 한다(양의 정수). 이미 배포된
   에디터의 S/M/L **표시 크기** 프리셋이 이 속성에 실린다. 서버가 원본 픽셀로 덮어쓰면
   그 기능이 조용히 죽는다. 동의하는가?
2. **실배포에 브라우저가 직접 접근 가능한 스토리지 호스트가 있는가?** §3.5 전체가 이 전제
   위에 있다. 없다면 조회 API 를 추가하는 설계로 바꿔야 한다(그 경우 숨김 글 404 에
   관리자 예외 필요 — 수정 화면이 자기 이미지를 그려야 한다)
3. **등록(POST)에서 본문의 URL 참조는 `POST_IMAGE_REF_UNKNOWN` 으로 거부한다** —
   새 글에는 소유 파일이 없으므로 전부 `cid:` 여야 한다. 이 해석이 맞는가?
