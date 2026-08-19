# 공지사항 · FAQ — 이미지를 저장 요청에 묶는다 (BE 구현 요청)

- 상태: **Proposal** (Draft 계약 변경 요청, BE 착수 전)
- 대상 Tag: `faq-notices` — [tag guide](../tag-guides/faq-notices.md)
- 선행 논의: [2026-08-12 신설](../discussions/2026-08-12-faq-notices-added.md)
- 작성일: 2026-08-19

---

## 1. 한 줄 요약

**독립 이미지 업로드 API 를 없애고, 이미지를 게시글 저장 요청 안에 넣는다.**
저장 전에는 바이트가 서버로 가지 않는다.

---

## 2. 왜 바꾸는가

현재 계약은 이미지를 **떠 있는 파일**로 만든다. `POST /admin/posts/images` 는 파일을 저장소에
넣고 URL 을 돌려주지만, 그 파일은 어떤 게시글에도 속하지 않는다. 소속이 생기는 것은 나중에
본문 HTML 이 그 URL 을 참조할 때뿐이고, 그 참조는 저장이 성공해야 생긴다.

여기서 세 가지가 나온다.

| 상황 | 현재 결과 |
| --- | --- |
| 이미지 올리고 저장 안 하고 이탈 | **고아 파일**. 누구도 참조하지 않고 남는다 |
| 업로드 201 응답 후 파일 유실 | 저장은 성공하고 **본문이 죽은 URL 을 가리킨다** |
| 저장된 글에서 이미지 제거 | 파일은 저장소에 그대로 남는다 |

이 셋을 막으려면 참조 수를 세는 정리 작업(D16)이 필요하다. 그 작업은 지금 `미정` 이다.

**Confluence 조사 결과**(§9)가 방향을 정했다. Confluence 도 본문과 파일은 별도 요청으로
보내지만, 업로드가 **페이지 ID 에 소속**되고 본문은 **URL 이 아니라 이름**을 참조한다.
그래서 저쪽에는 고아도 죽은 참조도 원리상 없다.

우리는 소속을 만드는 대신 **업로드 시점을 저장으로 미룬다.** 결과는 같고 초안 테이블이
필요 없다 — Confluence 가 초안 페이지를 먼저 만드는 이유는 그쪽 에디터가 첨부를 즉시
올리기 때문이다. 미루면 그 이유가 사라진다.

**치르는 비용**: 저장이 실패해 재시도하면 이미지 바이트를 다시 보낸다(최대 10MB).
이 비용은 인지하고 선택했다.

---

## 3. 새 API 셋 (12건)

변경된 것만 표시했다. 표시 없는 행은 **현행 그대로**다.

| | Method | Path | 설명 |
| --- | --- | --- | --- |
| | GET | `/install/v1/posts` | 사용자용 목록. 본문 없음 |
| | GET | `/install/v1/posts/{postId}` | 본문 포함 단건 |
| | GET | `/install/v1/post-categories` | 사용자용 Category 목록 |
| | GET | `/install/v1/admin/posts` | Admin 목록. 본문 없음 |
| **변경** | POST | `/install/v1/admin/posts` | 등록. **`multipart/form-data`** |
| **변경** | GET | `/install/v1/admin/posts/{postId}` | 본문 포함 단건 (수정 진입). **응답에 `images` 추가** (§4.5) |
| **변경** | PUT | `/install/v1/admin/posts/{postId}` | 전체 교체 수정. **`multipart/form-data`** |
| | PUT | `/install/v1/admin/posts/{postId}/hidden` | 숨김 / 복구 |
| | PUT | `/install/v1/admin/posts/{postId}/pinned` | 고정 / 해제 |
| **삭제** | ~~POST~~ | ~~`/install/v1/admin/posts/images`~~ | **없어진다** |
| | GET | `/install/v1/admin/post-categories` | Admin Category 목록 |
| | POST | `/install/v1/admin/post-categories` | Category 추가 |
| | DELETE | `/install/v1/admin/post-categories/{categoryId}` | Category 삭제 |

건수는 13건에서 **12건**이 된다 — 업로드 1건이 빠지고, 새로 들어오는 API 는 없다.

### 이미지 조회 API 는 없다

저장된 본문의 `img.src` 는 **브라우저가 직접 접근하는 스토리지 URL** 이다. 이것은 새 전제가
아니라 **현행 계약의 전제 그대로**다 — 프론트엔드는 이미 `NEXT_PUBLIC_POST_IMAGE_BASE_URL`
(스토리지 호스트)로 시작하는 src 만 허용하고, 그 URL 을 `<img>` 에 그대로 넣어 그린다.

BFF 는 파일을 **쓰고 지울 뿐 서빙하지 않는다.** 조회를 BFF API 로 만들면 세 가지가 나빠진다:

- 본문 속 URL 이 BFF 경로가 되는데, 브라우저는 BFF 에 직접 닿지 못한다(2-hop 구조).
  프론트엔드가 렌더링 시마다 URL 을 다시 써야 한다
- 게시글 하나가 이미지 10장이면 조회 트래픽 10배가 BFF 를 지나간다
- HTTP 캐싱(브라우저 · CDN)을 스토리지가 공짜로 주는데 BFF 가 다시 구현해야 한다

숨김 게시글의 이미지 URL 은 아는 사람에게 계속 열린다 — **현행과 동일한 특성**이며, 숨김은
게시글 조회 API 가 막는다. mock 환경의 서빙 라우트(`GET /pass/api/v1/admin/posts/images/…`)는
mock 전용으로 유지된다.

실배포에 브라우저 접근 가능한 스토리지 호스트가 **없다면** 이 전제가 무너진다 — §10.5 에서
확인을 요청한다.

---

## 4. 저장 요청 상세

### 4.1 요청 형태

```
POST /install/v1/admin/posts
PUT  /install/v1/admin/posts/{postId}

Content-Type: multipart/form-data; boundary=----X
```

파트는 두 종류다.

| 파트 이름 | 개수 | Content-Type | 내용 |
| --- | --- | --- | --- |
| `post` | 정확히 1 | `application/json` | 아래 JSON. **기존 request body 와 동일** |
| `files` | 0 ~ 10 | `image/png` `image/jpeg` `image/webp` | 새로 추가된 이미지. `filename` 이 **키** |

`post` 파트의 JSON 은 지금 계약과 **한 글자도 다르지 않다.**

```jsonc
// POST — 등록
{
  "type": "NOTICE",              // "FAQ" | "NOTICE", 필수
  "categoryId": 3,               // number | null, 생략 가능
  "titles":   { "ko": "...", "en": "..." },
  "contents": { "ko": "<p>...</p>", "en": "<p>...</p>" }
}
```

```jsonc
// PUT — 수정. `type` 없음(전체 교체이지 이동이 아니다)
{
  "categoryId": 3,
  "titles":   { "ko": "...", "en": "..." },
  "contents": { "ko": "<p>...</p>", "en": "<p>...</p>" }
}
```

### 4.2 본문이 새 이미지를 가리키는 방법

새 이미지는 아직 URL 이 없다. 본문은 `cid:` 스킴으로 **키**를 참조하고, 서버가 저장하면서
실제 URL 로 바꿔 쓴다. (`cid:` 는 RFC 2392 의 Content-ID URL — multipart 안에서 파트를
가리키라고 있는 스킴이다.)

```html
<p>구성은 아래와 같습니다.</p>
<img src="cid:k7f3a91c" alt="구성도.png" width="800" height="450">
```

키는 프론트엔드가 만든다. 형식은 `^[a-z0-9]{8,32}$`.
같은 키를 `contents.ko` 와 `contents.en` 이 함께 참조할 수 있다 — 파트는 하나다.

### 4.3 요청 전문 예시

한국어 본문에 새 그림 1장, 영어 본문이 같은 그림을 재사용, 그리고 수정이라 기존 그림 1장이
그대로 남는 경우:

```
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

읽는 법:

- `cid:k7f3a91c` → `files` 파트 중 `filename="k7f3a91c"` 인 것. **새로 저장한다**
- `https://storage.example/posts/41/9c22.png` → 41번 글이 이미 가진 파일. **유지한다**
- 41번 글이 가진 파일 중 본문 어디에도 없는 것 → **삭제한다**

### 4.4 응답

기존과 동일한 `AdminPost` 를 돌려준다. 단, `contents` 안의 `cid:` 는 **전부 실제 스토리지
URL 로 치환된 상태**여야 한다. 저장된 본문에는 `cid:` 가 남지 않는다.

### 4.5 수정 진입 읽기에 `images` 추가

`GET /install/v1/admin/posts/{postId}` 응답에 이 글이 소유한 파일 목록을 더한다.

```jsonc
{
  // ... 기존 AdminPost 필드 전부 그대로 ...
  "images": [
    { "url": "https://storage.example/posts/41/9c22.png", "bytes": 1843200 }
  ]
}
```

**이게 없으면 수정 화면의 용량 예산이 깨진다.** 프론트엔드는 "이미지 N장 · X MB / 10MB"
카운터를 그리고 저장 전에 상한을 미리 막는데, 바이트 크기는 본문 HTML 어디에도 없다.
등록에서는 파일이 전부 로컬이라 알지만, 수정에서는 기존 이미지 크기를 알 길이 없다 —
8MB 짜리 글에 4MB 를 더 얹어도 카운터는 4MB 로 보이고, 관리자는 작성을 다 마친 **저장
시점에야** `POST_SIZE_LIMIT_EXCEEDED` 를 만난다. 사용자용 단건(`GET /posts/{postId}`)에는
필요 없다 — 세는 화면이 수정 화면뿐이다.

---

## 5. 서버가 저장 시 하는 일 (순서)

이 순서 전체가 **하나의 트랜잭션**이다. 어느 단계에서 실패하든 파일도 글도 남지 않는다.
(스토리지 쓰기가 DB 트랜잭션 밖이라면 실패 시 파일 정리는 BE 내부에서 해결한다 — 계약이
보장하는 것은 **실패 응답이면 글도 참조도 남지 않는다**는 관측 가능한 결과다.)

1. `post` 파트 JSON 파싱 · 필수값 검사 (제목 ko/en 비어 있으면 거부)
2. `contents.ko` · `contents.en` 을 allow-list 로 검사 (§7)
3. 본문의 모든 `img.src` 수집. 두 종류로 나뉜다
   - `cid:<키>` → 대응 `files` 파트가 **반드시** 있어야 한다. 없으면 `POST_IMAGE_REF_MISSING`
   - URL → **이 글이 소유한 파일**이어야 한다. 아니면 `POST_IMAGE_REF_UNKNOWN`
     (등록(POST)은 소유한 파일이 없으므로 URL 참조 자체가 이 오류다)
4. 어떤 본문도 참조하지 않는 `files` 파트가 있으면 `POST_IMAGE_UNREFERENCED`
   — 프론트엔드 버그를 조용히 넘기지 않기 위해서다
5. 상한 검사. **ko / en 을 합쳐서, 같은 키·같은 URL 은 한 번만** 센다
   - 개수 10 초과 → `POST_IMAGE_LIMIT_EXCEEDED`
   - 총 바이트 10MB 초과 → `POST_SIZE_LIMIT_EXCEEDED`
   - 파일 1개가 5MB 초과 → `IMAGE_TOO_LARGE`
   - 허용 밖 MIME → `UNSUPPORTED_IMAGE_TYPE`
6. `files` 를 스토리지에 쓴다.
   같은 글 안에서 **바이트가 완전히 같은 파트는 한 파일로** 저장한다(sha256 등)
7. 본문의 `cid:<키>` 를 해당 파일의 **스토리지 URL** 로 치환
8. 치환된 본문으로 글을 저장
9. 이 글이 소유했지만 7단계 본문 어디에도 없는 파일을 **삭제**
10. 커밋

### 5.1 파일 소유는 글 단위다 (참조 카운트 없음)

한 파일은 **정확히 한 글**에 속한다. 두 글이 같은 그림을 쓰면 저장소에 두 벌이 생긴다.

현행 계약은 파일을 글 사이에 공유시켰고, 그래서 D16 정리 정책이 *"참조 수가 0이 될 때
삭제"* 여야 했다. 소유가 글 단위가 되면 그 계산이 사라진다 — 9단계가 곧 정리이고,
글을 지우면 파일도 같이 간다.

중복 저장은 실제로는 거의 안 생긴다. 중복이 문제였던 실제 흐름은 *"한국어에 넣은 스크린샷을
English 탭에서 다시 넣기"* 인데, 그건 **같은 글 안**이라 6단계가 한 파일로 접는다.

---

## 6. 사라지는 규칙

tag guide §5 `본문 이미지` 에서 다음 항목이 **삭제**된다.

- ~~"이미지는 `POST /admin/posts/images` 로 먼저 업로드하고 응답의 `url` 을 본문에 넣는다"~~
- ~~"요청 1회에 1개"~~ — 이제 저장 요청 하나가 최대 10개를 싣는다
- ~~"업로드만으로는 어떤 게시글에도 연결되지 않는다 … 고아 파일이 남는다"~~ — 발생하지 않는다
- ~~"고아 파일 정리 정책(D16)은 참조 수가 0이 될 때 삭제여야 한다"~~ — **D16 자체가 닫힌다**
- ~~"두 상한은 업로드가 아니라 저장 시점에 검사한다. 업로드는 파일 단위라 어느 게시글에
  들어갈지 알 수 없다"~~ — 앞 문장은 남고 뒤 이유가 사라진다. 이제 알 수 있다
- "프론트엔드에 mock 전용 라우트 `GET /pass/api/v1/admin/posts/images/{imageId}` 가
  있다" — 이 문장은 **유지**된다. 실배포 서빙은 스토리지가 맡고(§3), mock 은 이 라우트가
  스토리지 역할을 계속 대신한다

**유지되는 규칙**: 파일 1개 5MB · 글 1개 10장 / 10MB · ko+en 합산 · 중복 1회 계산 ·
관리자가 조절 가능한 것은 위치뿐 · 렌더러 `loading="lazy"` · base64 인라인 금지 ·
서명 URL 방식 미도입.

---

## 7. allow-list 변경

`img.src` 규칙이 **요청과 저장으로 갈라진다.**

| | 허용 값 |
| --- | --- |
| 요청 본문 (`post` 파트) | `cid:<키>` 또는 **이 글이 소유한** 이미지 URL |
| 저장된 본문 | 이미지 URL **만**. `cid:` 는 저장되지 않는다 |

나머지 allow-list(태그·속성·`href`)는 전부 그대로다. `//...`, `javascript:`, `data:` 는
계속 거부한다 — `cid:` 는 저 목록에 추가되는 예외가 아니라 **요청에서만 유효한 임시 참조**다.

---

## 8. error code

| 코드 | HTTP | 언제 |
| --- | --- | --- |
| `POST_IMAGE_REF_MISSING` | 400 | 본문의 `cid:` 에 대응하는 파트가 없다 |
| `POST_IMAGE_REF_UNKNOWN` | 400 | 본문이 이 글 소유가 아닌 이미지 URL 을 가리킨다 |
| `POST_IMAGE_UNREFERENCED` | 400 | 어떤 본문도 참조하지 않는 `files` 파트가 있다 |
| `POST_IMAGE_LIMIT_EXCEEDED` | 400 | 글 하나에 이미지 10개 초과 (기존) |
| `POST_SIZE_LIMIT_EXCEEDED` | 400 | 글 하나의 이미지 총합 10MB 초과 (기존) |
| `IMAGE_TOO_LARGE` | 413 | 파일 1개가 5MB 초과 (기존) |
| `UNSUPPORTED_IMAGE_TYPE` | 400 | png / jpeg / webp 아님 (기존) |
| `POST_CONTENT_INVALID` | 400 | allow-list 위반 (기존) |

앞의 3개가 신규다. 전부 ProblemDetails 의 `detail` 에 **어느 키/어느 URL** 인지 담아 준다 —
이미지 8장짜리 글에서 "이미지가 잘못됐습니다" 만 오면 관리자가 찾을 방법이 없다.

---

## 9. 근거 — Confluence 조사 (2026-08-19)

| | Confluence | 이 제안 |
| --- | --- | --- |
| 본문 + 파일 | 별도 요청 | **한 요청** |
| 파일 여러 개 | `file` 파트 반복 | `files` 파트 반복 (동일) |
| 업로드 대상 | 페이지 ID | **저장 요청 자체** |
| 미발행 글 | 초안 페이지가 ID 를 먼저 받음 | **불필요** (업로드를 미루므로) |
| 본문 참조 | `<ri:attachment ri:filename="...">` | `cid:<키>` → 저장 시 URL |
| 고아 파일 | 초안과 함께 삭제 | 발생하지 않음 |

Confluence 는 본문과 파일을 같이 보내지 않는다. Atlassian KB 는 업로드 직후에 대해
"at this point, the attachment will not yet be added to the page content" 라고 적고, 본문을
따로 `PUT` 한다. 우리가 한 요청으로 갈 수 있는 이유는 **글당 10MB 상한**이 있어 요청 크기가
닫혀 있기 때문이다 — 상한 없는 위키에는 못 쓰는 방법이다.

출처:
[KB — 업로드 절차](https://support.atlassian.com/confluence/kb/using-the-confluence-rest-api-to-upload-an-attachment-to-one-or-more-pages/) ·
[REST child/attachment](https://docs.atlassian.com/atlassian-confluence/REST/5.5/) ·
[초안에 첨부하기](https://community.developer.atlassian.com/t/attaching-a-file-via-restapi-to-a-confluence-page-draft/46609) ·
[Storage Format](https://confluence.atlassian.com/doc/confluence-storage-format-790796544.html)

---

## 10. 확인이 필요한 것

### 10.1 `width` / `height` 를 서버가 다시 쓰면 안 된다 ⚠️

tag guide 는 이 두 값을 *"원본 픽셀 크기이며 관리자가 조절하는 값이 아니다"* 로 적어 두었다.
**이미 배포된 에디터는 그 규칙을 따르지 않는다** — S / M / L / 원본 프리셋이 있고, 고른 값이
`width`/`height` 로 들어간다(원본 픽셀이 아니라 표시 크기).

지금까지는 업로드 응답이 주는 값이라 충돌이 잠재해 있었지만, 이 개편은 서버를 저장 시점의
유일한 기록자로 만든다. **서버가 원본 크기로 덮어쓰면 프리셋 기능이 조용히 죽는다.**

> **요청**: 서버는 `width`/`height` 를 **검증만** 하고(양의 정수, 원본 픽셀 이하) 덮어쓰지
> 않는다. tag guide 의 해당 문장도 함께 고친다.

### 10.2 키를 `filename` 에 싣는 것에 대해

`Content-Disposition` 의 `filename` 을 키로 쓰는 것은 Confluence 의 `ri:filename` 과 같은
발상이고, Spring 에서 `List<MultipartFile>` + `getOriginalFilename()` 로 바로 읽힌다.
원래 파일명은 본문 `img.alt` 에 이미 들어 있어 잃지 않는다.

BE 가 `filename` 오버로딩을 꺼리면 대안은 `post` JSON 에 매니페스트를 넣고 `files` 순서로
짝짓는 방식이다(Confluence 의 comment 규칙과 동일). **순서 의존이 생기므로 권하지 않는다.**

### 10.3 요청 크기 상한

이미지 10MB + JSON + multipart 오버헤드. 게이트웨이/서버의 `max-request-size` 를
**최소 12MB** 로 잡아야 한다. 지금 값이 얼마인지 확인이 필요하다.

### 10.4 등록(POST)에서 URL 참조

새 글에는 소유한 파일이 없으므로 본문의 이미지는 전부 `cid:` 여야 한다. URL 이 오면
`POST_IMAGE_REF_UNKNOWN` 으로 거부한다 — 이 해석이 맞는지 확인 바란다.

### 10.5 브라우저가 접근 가능한 스토리지 호스트가 실배포에 있는가

이 제안 전체가 §3 의 전제 — 이미지는 스토리지가 직접 서빙한다 — 위에 있다. 현행 계약도
같은 전제였지만(업로드 응답의 `url` 을 본문에 그대로 저장), 실배포 인프라에서 확인된 적은
없다.

**없다면** 조회 API 를 추가해야 한다: `GET /install/v1/posts/{postId}/images/{imageId}`
(인증 불필요 — 공지사항은 로그인 없이 보는 화면이다). 이 경우 두 가지가 따라온다:

- 숨김 게시글 이미지를 404 로 막는다면 **관리자는 예외**여야 한다 — 아니면 숨김 글의
  수정 화면이 자기 이미지를 그리지 못한다
- 저장된 본문 속 URL 이 BFF 경로가 되므로, 프론트엔드가 렌더링 시 `/install/v1/` 을
  자기 프록시 경로로 바꿔 그린다 (편집기 · 조회 화면 두 곳)

---

## 11. 프론트엔드가 함께 하는 일 (참고)

BE 작업 범위는 아니지만, 계약이 성립하려면 이쪽도 바뀐다.

- 붙여넣기 · 드롭 · 파일 선택이 **업로드하지 않는다**. `URL.createObjectURL(file)` 로
  미리보기를 만들고 키를 발급해 `cid:<키>` 로 노드를 넣는다. 미리보기 src(`blob:`)는
  에디터 안에서만 유효하다 — 저장 직전 문서의 `blob:` 을 `cid:` 로 바꿔 보낸다
- 형식 · 5MB 검사는 그 시점에 그대로 한다(서버 검증은 유지)
- `width`/`height` 는 로컬에서 잰다(`naturalWidth` / `naturalHeight`)
- 수정 진입 시 §4.5 의 `images` 로 용량 카운터를 seed 한다 — 기존 이미지 바이트는
  이 응답만이 안다
- 저장 시 **문서를 훑어 살아 있는 `cid:` 키만** 모아 파트를 만든다. 지웠거나 실행 취소된
  이미지는 문서에 없으므로 자연히 빠진다 — 키 맵에 남은 찌꺼기는 무해하다
- 저장 호출의 timeout 을 올린다 — 공용 fetch 래퍼 기본값 30초는 JSON 용이고, 최대 10MB
  multipart 는 느린 회선에서 넘을 수 있다 (`FetchJsonOptions.timeout` 이 이미 있다)
- 언마운트 시 `URL.revokeObjectURL`
- 저장 실패 시 폼과 로컬 이미지를 유지한다. 재시도는 바이트를 다시 보낸다
