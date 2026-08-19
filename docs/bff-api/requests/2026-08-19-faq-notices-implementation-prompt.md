# 공지사항 · FAQ — BE 구현 요청 프롬프트

- 상태: **Phase 1 구현 요청** + Phase 2 계약 리뷰 요청
- 대상 Tag: `faq-notices`
- 작성일: 2026-08-19
- 사용법: 아래 수평선부터 문서 끝까지가 프롬프트 전문이다. BE 레포의 에이전트에 그대로
  붙여넣고, 문서 2건을 같이 준다:
  1. `docs/bff-api/tag-guides/faq-notices.md` — 태그 가이드 (계약 전체)
  2. `docs/bff-api/requests/2026-08-19-faq-notices-save-with-images.md` — 이미지 저장 방식
     변경 제안 (Phase 2 의 근거)

**Phase 를 나눈 이유**: 이미지 저장(멀티파트 · 스토리지 연동)은 BE 준비가 안 됐다.
이미지를 뺀 나머지는 확정이라 먼저 나간다. 두 Phase 의 **경로와 건수가 동일(12건)** 해서
Phase 1 을 먼저 배포해도 Phase 2 가 어떤 경로도 깨지 않는다 — Phase 2 는 저장 2건의
Content-Type, Admin 단건 응답, allow-list 의 `img` 만 바꾼다.

**FE 영향 (Phase 1)**: 프론트엔드의 저장 · 조회 호출은 이미 `application/json` 이라 Phase 1
계약과 그대로 맞는다. 실 BE 에 붙이는 시점에 에디터의 이미지 진입점 3곳(버튼 · 붙여넣기 ·
끌어놓기)을 끄는 작은 패치 하나만 필요하다 — Phase 1 서버에는 업로드 경로가 없다.

---

너는 install/v1 BFF 레포에서 작업한다. 공지사항 · FAQ(`faq-notices`) API 를 구현한다.

함께 받은 문서 2건이 계약의 진실이다. 이 프롬프트는 범위와 순서를 정할 뿐, 필드 이름 ·
검증 규칙 · 에러 형식이 어긋나면 **태그 가이드(`faq-notices.md`)가 이긴다.**

**지금 구현하는 것은 Phase 1 뿐이다. 이미지는 Phase 1 에 없다.**
Phase 2 는 코드를 쓰지 말고, 마지막 절의 확인 요청 3건에만 답하라.

## Phase 1 — 이미지 없는 게시글 (지금 구현)

### 엔드포인트 12건

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/install/v1/posts` | 사용자용 목록. **본문 없음** |
| GET | `/install/v1/posts/{postId}` | 본문 포함 단건. 숨김 글이면 404 |
| GET | `/install/v1/post-categories` | 사용자용 Category 목록 |
| GET | `/install/v1/admin/posts` | Admin 목록. 본문 없음. 숨김 글 포함 |
| POST | `/install/v1/admin/posts` | 등록. **`application/json`** |
| GET | `/install/v1/admin/posts/{postId}` | 본문 포함 단건 (수정 진입) |
| PUT | `/install/v1/admin/posts/{postId}` | 수정. **전체 교체**, `application/json` |
| PUT | `/install/v1/admin/posts/{postId}/hidden` | 숨김 / 복구 |
| PUT | `/install/v1/admin/posts/{postId}/pinned` | 고정 / 해제 |
| GET | `/install/v1/admin/post-categories` | Admin Category 목록 |
| POST | `/install/v1/admin/post-categories` | Category 추가 |
| DELETE | `/install/v1/admin/post-categories/{categoryId}` | Category 삭제 |

`/admin/**` 은 ADMIN 역할 필수, 나머지는 인증 불필요 — 공지사항은 로그인 없이 보는
화면이다. **`POST /install/v1/admin/posts/images` 는 만들지 마라.** 태그 가이드에 남아
있더라도 변경 제안에서 삭제된 경로다.

### 계약 원칙 (요약 — 세부는 태그 가이드)

- 스키마 · 필드 이름은 태그 가이드 §2 그대로. wire 는 camelCase
- 에러는 ProblemDetails(RFC 9457). `detail` 은 관리자에게 그대로 보여 줄 수 있는 문장
- 목록 응답에 `contents` 를 넣지 않는다 — 본문은 단건 조회만 싣는다
- `PUT` 은 부분 수정이 아니라 **전체 교체**다. 생략된 필드는 비워진다
- `publishedAt` 은 최초 발행 시각으로 고정 — 수정해도 움직이지 않는다. `updatedAt` 만 갱신
- 정렬: `pinned` desc → `publishedAt` desc. 두 그룹으로 나뉘고 그룹 안에서만 시간순
- Category 삭제는 소속 게시글 수(숨김 포함)가 0 일 때만

### 검증 (Phase 1)

- `titles.ko` · `titles.en` · `contents.ko` · `contents.en` 전부 필수. 공백만이면 거부
- `contents` 는 allow-list 검사: `h4 p br ul ol li strong em code a` —
  **`img` 는 Phase 1 allow-list 에 없다.** 업로드 경로가 없으니 유효한 `src` 가 존재할 수
  없고, `img` 가 오면 그 자체로 `POST_CONTENT_INVALID` 다
- 허용 밖 태그 · 속성 · 스킴(`javascript:` 등) → 400 `POST_CONTENT_INVALID`,
  `detail` 에 무엇이 걸렸는지 담는다

### 수용 기준

1. curl 왕복 시나리오가 통과한다:
   등록 → Admin 목록 → 단건 → 수정(전체 교체 확인: 생략 필드가 비워진다) → 숨김
   (사용자 단건 404 · Admin 단건은 조회됨) → 복구 → 고정(목록 맨 위로) → Category
   추가 · 게시글 소속 → 삭제 거부(postCount>0) → 소속 해제 후 삭제 성공
2. 거부 케이스가 각각 지정된 code 로 떨어진다: 빈 제목, `img` 포함 본문,
   허용 밖 태그, 없는 `postId`(404)
3. swagger yaml 에 12건이 반영된다 — 이것이 프론트엔드 codegen 의 입력이라,
   **yaml 에 없는 필드는 프론트엔드가 쓸 수 없다**

## Phase 2 — 이미지를 저장 요청에 묶기 (착수 금지, 계약 리뷰만)

변경 제안(`2026-08-19-faq-notices-save-with-images.md`)이 전문이다. 요약:

- 독립 업로드 API 없이, 저장 요청이 `multipart/form-data` 로 `post` JSON 파트와
  `files` 파트(0~10장)를 함께 싣는다
- 새 이미지는 본문이 `cid:<키>` 로 참조하고, 서버가 저장하면서 스토리지 URL 로 치환한다
- 이미지 서빙은 스토리지가 직접 한다 — **조회 API 를 만들지 않는다**
- 파일 소유는 글 단위. 본문에서 빠진 파일은 저장 시 삭제 — 고아 파일 정리(D16)가
  통째로 사라진다
- `GET /install/v1/admin/posts/{postId}` 응답에 `images: [{url, bytes}]` 추가
- 신규 에러 3종: `POST_IMAGE_REF_MISSING` · `POST_IMAGE_REF_UNKNOWN` ·
  `POST_IMAGE_UNREFERENCED`

경로 · 건수는 Phase 1 과 같다. 바뀌는 것은 저장 2건의 Content-Type, Admin 단건 응답,
allow-list 에 `img` 가 (요청은 `cid:` 또는 이 글 소유 URL, 저장본은 URL 만으로) 들어오는
것뿐이다.

**지금 답해 줄 것 3건** (제안 문서 §10):

1. **§10.1** — 서버는 `img` 의 `width`/`height` 를 **검증만** 하고 덮어쓰지 않는다.
   이미 배포된 에디터의 S/M/L 표시 크기 프리셋이 이 값에 실린다. 덮어쓰면 그 기능이
   조용히 죽는다. 동의하는가?
2. **§10.5** — 실배포에 **브라우저가 직접 접근 가능한 스토리지 호스트**가 있는가?
   없다면 Phase 2 설계가 바뀌어야 한다(조회 API 추가 + 관리자 예외)
3. **§10.4** — 등록(POST)에서 본문의 URL 참조는 `POST_IMAGE_REF_UNKNOWN` 으로
   거부한다. 이 해석이 맞는가?
