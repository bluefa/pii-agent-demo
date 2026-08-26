# Post Category 다국어 이름 — BFF 변경 요청 (델타)

- 대상: `install/v1` BFF 의 `FAQ & Notices` Tag
- 기준 문서: [2026-08-19 be-handoff](./2026-08-19-faq-notices-be-handoff.md) (12건 계약)
- 요청자: Pass FE
- 작성일: 2026-08-26
- **이 문서는 델타다.** 여기서 다루지 않은 것은 기준 문서 그대로다. 경로 · 상태코드 ·
  인증 · 정렬 · 숨김/고정 · 본문 allow-list 는 전부 변경 없음.

## 0. 요약

게시글의 Title 과 본문은 이미 ko/en 쌍(`titles`, `contents`)인데 **Category 이름만 단일
문자열**이다. 언어를 영어로 전환해도 목록 레일과 배지만 한국어로 남는다.

**필드 2개를 `LocalizedText` 로 개명한다.** 그게 전부다.

| 필드 | AS-IS | TO-BE |
| --- | --- | --- |
| `PostCategory.name` (+ `AdminPostCategory`) | `string` | `names: LocalizedText` |
| `PostSummary.categoryName` (+ `Post` · `AdminPostSummary` · `AdminPost`) | `string \| null` | `categoryNames: LocalizedText \| null` |
| `PostCategoryCreateRequest.name` | `string` | `names: LocalizedText` (ko/en 둘 다 필수) |

`LocalizedText` 는 이 Tag 에 이미 있는 스키마(`titles`/`contents` 가 쓰는 것)다. **새 스키마
0개 · 새 엔드포인트 0개 · 새 error code 0개.** 12건 그대로.

> `categoryName` 을 게시글 응답에서 아예 빼고 화면이 `categoryId` 로 join 하는 안도 검토했다.
> BE 는 이 값을 저장하지 않고 응답 시점에 join 으로 채우므로 "사본" 의 실제 비용은 게시글당
> 문자열 2개(≈40B)뿐이고, 빼면 사용자 화면이 Category API 를 새로 한 번 더 불러야 한다.
> 개명이 양쪽 다 더 작다.

## 1. 스키마 델타

```jsonc
// PostCategory / AdminPostCategory
{ "id": 3, "type": "NOTICE", "name": "점검", "displayOrder": 1 }                                   // AS-IS
{ "id": 3, "type": "NOTICE", "names": { "ko": "점검", "en": "Maintenance" }, "displayOrder": 1 }   // TO-BE

// PostSummary / Post / AdminPostSummary / AdminPost
{ "id": 41, "categoryId": 3, "categoryName": "점검", ... }                                         // AS-IS
{ "id": 41, "categoryId": 3, "categoryNames": { "ko": "점검", "en": "Maintenance" }, ... }         // TO-BE
// categoryId 가 null 이면 categoryNames 도 null — 지금과 같다

// PostCategoryCreateRequest
{ "type": "NOTICE", "name": "점검" }                                                               // AS-IS
{ "type": "NOTICE", "names": { "ko": "점검", "en": "Maintenance" } }                               // TO-BE
```

## 2. 엔드포인트별 영향 (12건 전량)

| 구분 | 건수 | 엔드포인트 | 변경 |
| --- | --- | --- | --- |
| 이름을 싣거나 받는다 | 3 | `GET /post-categories` · `GET /admin/post-categories` · `POST /admin/post-categories` | 응답 `names`. POST 는 **요청 body** 도 `names` + **409 판정 2축**(§3) |
| 응답 필드 개명 | 8 | `GET /posts` · `GET /posts/{id}` · `GET /admin/posts` · `POST /admin/posts` · `GET /admin/posts/{id}` · `PUT /admin/posts/{id}` · `PUT …/hidden` · `PUT …/pinned` | `categoryName` → `categoryNames`. 요청 body · 파라미터 · 필터 전부 그대로 |
| 무변경 | 1 | `DELETE /admin/post-categories/{id}` | — |

경로 prefix `/install/v1` 생략. 서버 판정 로직이 실제로 바뀌는 곳은 `POST /admin/post-categories` 1건뿐이다.

## 3. 검증 규칙 델타

- **필수 · 빈 값** — `names.ko` 와 `names.en` 둘 다 필수. trim 후 공백이면 `400 VALIDATION_FAILED`
  (`titles`/`contents` 와 같은 규칙). 언어별 fallback 은 없다.
- **중복 판정 2축** — 같은 `type` 안에서 `names.ko` 끼리, `names.en` 끼리 **각각** 유니크. 한쪽만
  겹쳐도 `409 CATEGORY_NAME_DUPLICATED`. `en` 만 같으면 영어 화면에서 두 그룹이 같은 이름으로
  보이기 때문이다. 비교는 trim 후 정확 일치(기존 판정과 같은 강도). `message` 에 어느 값이
  겹쳤는지 담는다 — 관리자 화면이 그 문장을 그대로 띄운다.
- FAQ 와 Notice 는 여전히 Category 를 공유하지 않는다.

## 4. 저장 계층 (참고)

`categories.name` → `name_ko` · `name_en`, unique `(type, name)` → `(type, name_ko)` + `(type, name_en)`.
이 Tag 는 아직 미구현이라 백필은 필요 없다.

## 5. 확인 필요

**D1. Category 이름 수정 API 신설 여부.** 현재 계약에 이름 수정이 없어 오타를 고치는 유일한 길이
삭제인데, 게시글이 1건이라도 있으면 `409 CATEGORY_IN_USE` 로 막힌다. 입력 축이 2개가 되면 오타
확률도 2배다. 신설안: `PUT /install/v1/admin/post-categories/{categoryId}` body `{ names }` →
`200 AdminPostCategory`, 검증 · 409 · 404 는 POST 와 동일(자기 자신은 제외). 넣으면 12 → 13건.
이번 범위 밖으로 두어도 나머지 계약은 성립한다.

## 6. 수용 기준 (기준 문서 §2.6 에 더한다)

1. Category 추가 → 사용자 · Admin 목록에서 `names.ko` · `names.en` 모두 나온다
2. `ko` 만 겹치는 추가 → 409 · `en` 만 겹치는 추가 → 409
3. 한쪽이 공백인 추가 → 400
4. 다른 `type` 에 같은 이름 → 201
5. 게시글 응답의 `categoryNames` 가 Category 의 `names` 와 같다
6. swagger yaml 에 반영 — 이 yaml 이 FE codegen 의 입력이다

## 7. FE 상태

이 델타는 FE 에 이미 구현돼 있다(mock-first). 상단 바의 언어 토글(쿠키 `pii-locale`)이
Home · 공지사항 · FAQ 화면에서 `titles` · `contents` · `categoryNames` 의 해당 언어를 고른다.
Admin 화면은 한국어 고정이며 Category 관리 모달이 ko/en 을 나란히 받는다.
