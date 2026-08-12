# FAQ & Notices

> Confluence: TBD
> 상태: Draft
> API Tag: `FAQ & Notices`
> 담당: TBD
> 작성일: 2026-08-12
> 마지막 수정일: 2026-08-12
> 관련 PR: TBD

## 1. 목적

FAQ와 공지사항 게시글, 그리고 그 게시글이 속하는 Category를 조회·관리하는 BFF API Tag다. 사용자용 조회 API와 Admin 관리 API를 함께 담으며, 게시글 삭제는 존재하지 않고 숨김 상태 전이만 존재한다.

FAQ와 Notice는 필드가 동일하므로 **단일 `posts` 리소스**로 두고 `type`(`FAQ` / `NOTICE`)으로 구분한다. 메뉴를 분리하든 하나의 목록으로 합치든 이 계약은 바뀌지 않는다.

## 2. BFF Swagger

> Swagger 상태: Draft
> 생성 기준: FE 제안 초안. backend 구현 없음. [2026-08-12 논의](../discussions/2026-08-12-faq-notices-added.md) 참조.

```yaml
openapi: 3.0.1
info:
  title: BFF API - FAQ & Notices
  version: v0
servers:
- url: https://dip-stg.di.atlas.samsung.com
  description: Generated server url
tags:
- name: FAQ & Notices
  description: FAQ / notice post and category APIs
paths:
  /install/v1/posts:
    get:
      tags:
      - FAQ & Notices
      summary: List visible posts
      operationId: listPosts
      x-expected-duration: 100ms
      description: |
        사용자 화면용 게시글 목록. 숨김(`hidden = true`) 게시글은 반환하지 않는다.

        정렬은 BFF가 수행하며 클라이언트는 응답 순서를 그대로 사용한다.
        1순위 `pinned` 내림차순(고정 게시글이 앞), 2순위 `publishedAt` 내림차순(최신이 앞).

        아코디언 즉시 펼침을 위해 목록 응답에 `content`를 포함한다. 별도의 본문 조회 호출이 필요 없다.
      parameters:
      - name: type
        in: query
        required: false
        description: 생략하면 FAQ와 NOTICE를 함께 반환한다.
        schema:
          $ref: '#/components/schemas/PostType'
      - name: categoryId
        in: query
        required: false
        description: 생략하면 모든 Category의 게시글을 반환한다. 존재하지 않는 id를 넘기면 빈 배열이다.
        schema:
          type: integer
          format: int64
      responses:
        '200':
          description: 조회 성공. 조건에 맞는 게시글이 없으면 빈 배열.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Post'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/posts/{postId}:
    parameters:
    - name: postId
      in: path
      required: true
      schema:
        type: integer
        format: int64
    get:
      tags:
      - FAQ & Notices
      summary: Get a visible post
      operationId: getPost
      x-expected-duration: 50ms
      description: |
        게시글 단건 조회. 딥링크(URL 직접 접근)용이며 목록 렌더링에는 사용하지 않는다.

        숨김 게시글은 `403`이 아니라 `404`를 반환한다. 존재 여부 자체를 사용자에게 노출하지 않는다.
      responses:
        '200':
          description: 조회 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Post'
        '404':
          description: 존재하지 않거나 숨김 처리된 게시글
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/post-categories:
    get:
      tags:
      - FAQ & Notices
      summary: List categories
      operationId: listPostCategories
      x-expected-duration: 50ms
      description: |
        사용자 화면용 Category 목록. 비활성 Category는 반환하지 않는다.

        상세 페이지의 Category별 그룹화는 클라이언트가 게시글의 `categoryId`로 묶어서 처리하며,
        이 API는 그룹의 **이름과 표시 순서**만 제공한다. `displayOrder` 오름차순으로 정렬되어 있다.
      parameters:
      - name: type
        in: query
        required: false
        description: 생략하면 FAQ와 NOTICE의 Category를 함께 반환한다.
        schema:
          $ref: '#/components/schemas/PostType'
      responses:
        '200':
          description: 조회 성공
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/PostCategory'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/admin/posts:
    get:
      tags:
      - FAQ & Notices
      summary: List all posts including hidden
      operationId: listAdminPosts
      x-expected-duration: 100ms
      description: |
        Admin 화면용 게시글 목록. 숨김 게시글을 **포함**하며 각 항목이 `hidden`을 노출한다.

        정렬은 사용자 목록과 동일하다(`pinned` 내림차순 → `publishedAt` 내림차순).
        숨김 게시글도 같은 정렬에 섞여 들어오며, 목록에서 분리되지 않는다.
      parameters:
      - name: type
        in: query
        required: false
        schema:
          $ref: '#/components/schemas/PostType'
      - name: categoryId
        in: query
        required: false
        schema:
          type: integer
          format: int64
      - name: hidden
        in: query
        required: false
        description: 숨김 상태로 필터링한다. 생략하면 숨김 여부와 무관하게 전부 반환한다.
        schema:
          type: boolean
      responses:
        '200':
          description: 조회 성공
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/AdminPost'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
    post:
      tags:
      - FAQ & Notices
      summary: Create a post
      operationId: createPost
      x-expected-duration: 100ms
      description: |
        게시글을 생성한다. 생성 시점이 `publishedAt`이 되며 `updatedAt`은 같은 값으로 시작한다.

        생성된 게시글은 `pinned = false`, `hidden = false`다. 고정·숨김은 별도 API로 전이한다.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PostCreateRequest'
      responses:
        '201':
          description: 생성 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminPost'
        '400':
          description: 요청 구조 검증 실패(VALIDATION_FAILED) 또는 본문 HTML 검증 실패(POST_CONTENT_INVALID)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '404':
          description: 존재하지 않거나 비활성 상태인 categoryId (CATEGORY_NOT_FOUND)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/admin/posts/{postId}:
    parameters:
    - name: postId
      in: path
      required: true
      schema:
        type: integer
        format: int64
    get:
      tags:
      - FAQ & Notices
      summary: Get a post including hidden
      operationId: getAdminPost
      x-expected-duration: 50ms
      description: 수정 화면 진입용 단건 조회. 숨김 게시글도 `200`으로 조회된다.
      responses:
        '200':
          description: 조회 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminPost'
        '404':
          description: 존재하지 않는 게시글 (POST_NOT_FOUND)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
    patch:
      tags:
      - FAQ & Notices
      summary: Update a post
      operationId: updatePost
      x-expected-duration: 100ms
      description: |
        Title, 본문, Category를 수정한다. 전달된 필드만 반영하는 partial update다.

        `publishedAt`은 절대 갱신하지 않고 `updatedAt`만 갱신한다. 목록 정렬 기준이 `publishedAt`이므로
        본문 오타 수정이 게시글을 목록 최상단으로 끌어올려서는 안 된다.

        `type` 변경은 지원하지 않는다. FAQ를 Notice로 바꾸는 요구사항이 없다.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PostUpdateRequest'
      responses:
        '200':
          description: 수정 성공. 갱신된 `updatedAt`을 포함한 전체 게시글 반환.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminPost'
        '400':
          description: 요청 구조 검증 실패(VALIDATION_FAILED) 또는 본문 HTML 검증 실패(POST_CONTENT_INVALID)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '404':
          description: 존재하지 않는 게시글(POST_NOT_FOUND) 또는 categoryId(CATEGORY_NOT_FOUND)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/admin/posts/{postId}/hidden:
    parameters:
    - name: postId
      in: path
      required: true
      schema:
        type: integer
        format: int64
    put:
      tags:
      - FAQ & Notices
      summary: Set post hidden state
      operationId: setPostHidden
      x-expected-duration: 50ms
      description: |
        게시글을 숨김 처리하거나 복구한다. `DELETE`는 제공하지 않는다 — 삭제는 요구사항상 존재하지 않는 동작이다.

        `hidden = true`면 `hiddenAt`이 현재 시각으로 기록되고, `hidden = false`면 `hiddenAt`이 null이 된다.
        이미 같은 상태여도 `200`이며 에러가 아니다(idempotent).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PostHiddenRequest'
      responses:
        '200':
          description: 전이 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminPost'
        '400':
          description: 요청 구조 검증 실패 (VALIDATION_FAILED)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '404':
          description: 존재하지 않는 게시글 (POST_NOT_FOUND)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/admin/posts/{postId}/pinned:
    parameters:
    - name: postId
      in: path
      required: true
      schema:
        type: integer
        format: int64
    put:
      tags:
      - FAQ & Notices
      summary: Set post pinned state
      operationId: setPostPinned
      x-expected-duration: 50ms
      description: |
        게시글을 상단 고정하거나 고정 해제한다. 고정 개수 상한은 두지 않는다.

        고정은 정렬 그룹만 바꾸며 `publishedAt` / `updatedAt`을 변경하지 않는다.
        이미 같은 상태여도 `200`이다(idempotent).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PostPinnedRequest'
      responses:
        '200':
          description: 전이 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminPost'
        '400':
          description: 요청 구조 검증 실패 (VALIDATION_FAILED)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '404':
          description: 존재하지 않는 게시글 (POST_NOT_FOUND)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/admin/post-categories:
    get:
      tags:
      - FAQ & Notices
      summary: List all categories including inactive
      operationId: listAdminPostCategories
      x-expected-duration: 50ms
      description: |
        Admin 화면용 Category 목록. 비활성 Category를 포함하며 `postCount`를 함께 반환한다.

        `postCount`는 숨김 게시글을 포함한 수다. 삭제 가능 여부(`postCount == 0`)를 화면에서
        미리 판단하기 위한 값이며, 최종 판정은 서버가 삭제 요청 시점에 다시 수행한다.
      parameters:
      - name: type
        in: query
        required: false
        schema:
          $ref: '#/components/schemas/PostType'
      responses:
        '200':
          description: 조회 성공
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/AdminPostCategory'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
    post:
      tags:
      - FAQ & Notices
      summary: Create a category
      operationId: createPostCategory
      x-expected-duration: 50ms
      description: |
        Category를 추가한다. `displayOrder`는 같은 `type` 안에서 마지막 순번으로 자동 부여된다.

        같은 `type` 안에서 `name`은 중복될 수 없다.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PostCategoryCreateRequest'
      responses:
        '201':
          description: 생성 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AdminPostCategory'
        '400':
          description: 요청 구조 검증 실패 (VALIDATION_FAILED)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '409':
          description: 같은 type 안에 동일한 name이 이미 존재 (CATEGORY_NAME_DUPLICATED)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/admin/post-categories/{categoryId}:
    parameters:
    - name: categoryId
      in: path
      required: true
      schema:
        type: integer
        format: int64
    delete:
      tags:
      - FAQ & Notices
      summary: Delete a category
      operationId: deletePostCategory
      x-expected-duration: 50ms
      description: |
        Category를 삭제한다. 게시글이 1건이라도 남아 있으면 `409 CATEGORY_IN_USE`로 거부한다.
        숨김 게시글도 잔여 게시글로 계산한다 — 숨김은 삭제가 아니기 때문이다.

        게시글을 고아 데이터로 남기지 않기 위한 정책이며, 삭제 전 게시글을 다른 Category로 옮기거나
        숨김 처리 후 제거하는 것은 Admin의 책임이다.
      responses:
        '204':
          description: 삭제 성공
        '404':
          description: 존재하지 않는 Category (CATEGORY_NOT_FOUND)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '409':
          description: 게시글이 남아 있어 삭제할 수 없음 (CATEGORY_IN_USE)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
components:
  schemas:
    AdminPost:
      type: object
      description: Admin 화면용 게시글. Post에 숨김 상태와 감사 필드를 더한 형태다.
      properties:
        id:
          type: integer
          format: int64
        type:
          $ref: '#/components/schemas/PostType'
        categoryId:
          type: integer
          format: int64
          nullable: true
        categoryName:
          type: string
          nullable: true
        title:
          type: string
        content:
          type: string
        publishedAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
        pinned:
          type: boolean
        hidden:
          type: boolean
          description: true면 사용자 API에서 반환되지 않는다.
        hiddenAt:
          type: string
          format: date-time
          nullable: true
          description: 마지막으로 숨김 처리된 시각. hidden이 false면 null.
        createdBy:
          type: string
        updatedBy:
          type: string
    AdminPostCategory:
      type: object
      properties:
        id:
          type: integer
          format: int64
        type:
          $ref: '#/components/schemas/PostType'
        name:
          type: string
        displayOrder:
          type: integer
          format: int32
        active:
          type: boolean
        postCount:
          type: integer
          format: int32
          description: 숨김 게시글을 포함한 잔여 게시글 수.
    ErrorMessage:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
          description: UTC 기준 ISO-8601 timestamp 문자열.
          example: "2026-08-12T02:27:09.123Z"
        status:
          type: string
          example: BAD_REQUEST
        code:
          type: string
          nullable: true
          enum:
          - VALIDATION_FAILED
          - POST_CONTENT_INVALID
          - POST_NOT_FOUND
          - CATEGORY_NOT_FOUND
          - CATEGORY_IN_USE
          - CATEGORY_NAME_DUPLICATED
        message:
          type: string
        path:
          type: string
    Post:
      type: object
      description: 사용자 화면용 게시글. 숨김 관련 필드를 노출하지 않는다.
      properties:
        id:
          type: integer
          format: int64
        type:
          $ref: '#/components/schemas/PostType'
        categoryId:
          type: integer
          format: int64
          nullable: true
          description: Category가 지정되지 않은 게시글은 null이다.
        categoryName:
          type: string
          nullable: true
        title:
          type: string
        content:
          type: string
          description: HTML 본문. allow-list를 통과한 값만 저장되어 있다.
        publishedAt:
          type: string
          format: date-time
          description: 최초 등록 시각. 수정해도 변하지 않는다. 화면에는 yy-mm-dd로 표기한다.
        updatedAt:
          type: string
          format: date-time
        pinned:
          type: boolean
          description: true면 목록 상단 고정 그룹에 속한다.
    PostCategory:
      type: object
      properties:
        id:
          type: integer
          format: int64
        type:
          $ref: '#/components/schemas/PostType'
        name:
          type: string
        displayOrder:
          type: integer
          format: int32
          description: 오름차순 표시 순서.
    PostCategoryCreateRequest:
      type: object
      required:
      - type
      - name
      properties:
        type:
          $ref: '#/components/schemas/PostType'
        name:
          type: string
          description: 같은 type 안에서 고유해야 한다. 공백만으로 이루어질 수 없다.
    PostCreateRequest:
      type: object
      required:
      - type
      - title
      - content
      properties:
        type:
          $ref: '#/components/schemas/PostType'
        categoryId:
          type: integer
          format: int64
          nullable: true
          description: 생략하거나 null이면 미분류 게시글이 된다.
        title:
          type: string
          description: 필수. 공백만으로 이루어질 수 없다.
        content:
          type: string
          description: 필수. HTML allow-list를 통과해야 하며, 태그 제거 후 텍스트가 남아야 한다.
    PostHiddenRequest:
      type: object
      required:
      - hidden
      properties:
        hidden:
          type: boolean
    PostPinnedRequest:
      type: object
      required:
      - pinned
      properties:
        pinned:
          type: boolean
    PostType:
      type: string
      enum:
      - FAQ
      - NOTICE
    PostUpdateRequest:
      type: object
      description: 전달된 필드만 반영하는 partial update. 모든 필드를 생략하면 VALIDATION_FAILED다.
      properties:
        categoryId:
          type: integer
          format: int64
          nullable: true
          description: null을 명시하면 미분류로 바꾼다. 키 자체를 생략하면 기존 값을 유지한다.
        title:
          type: string
        content:
          type: string
```

## 3. API 목록

| Method | Path | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | `/install/v1/posts` | 사용자용 게시글 목록. 숨김 제외, 고정→시간 정렬, 본문 포함 | Draft |
| GET | `/install/v1/posts/{postId}` | 사용자용 게시글 단건 조회 (딥링크용). 숨김이면 404 | Draft |
| GET | `/install/v1/post-categories` | 사용자용 Category 목록. 비활성 제외 | Draft |
| GET | `/install/v1/admin/posts` | Admin 게시글 목록. 숨김 포함, `hidden` 노출 | Draft |
| POST | `/install/v1/admin/posts` | 게시글 등록 | Draft |
| GET | `/install/v1/admin/posts/{postId}` | Admin 게시글 단건 조회. 숨김도 조회 가능 | Draft |
| PATCH | `/install/v1/admin/posts/{postId}` | Title / 본문 / Category 수정 | Draft |
| PUT | `/install/v1/admin/posts/{postId}/hidden` | 숨김 처리 / 복구 | Draft |
| PUT | `/install/v1/admin/posts/{postId}/pinned` | 상단 고정 / 고정 해제 | Draft |
| GET | `/install/v1/admin/post-categories` | Admin Category 목록. 비활성 포함, `postCount` 포함 | Draft |
| POST | `/install/v1/admin/post-categories` | Category 추가 | Draft |
| DELETE | `/install/v1/admin/post-categories/{categoryId}` | Category 삭제. 잔여 게시글 있으면 409 | Draft |

## 4. Response 설명

| Response 항목 | 설명 | 관련 기준 |
| --- | --- | --- |
| 목록 응답의 배열 순서 | 서버가 정렬을 마친 순서다. 클라이언트는 재정렬하지 않는다. 재정렬하면 메인 페이지와 상세 페이지의 순서가 갈라진다. | §5 정렬 규칙 |
| `publishedAt` | 최초 등록 시각이며 수정으로 변하지 않는다. 화면 표기는 `yy-mm-dd`로 절삭한다. | 화면 요구사항 |
| `updatedAt` | 마지막 수정 시각. 고정/숨김 전이로는 갱신되지 않는다. 내용이 바뀐 경우에만 갱신된다. | §5 시각 규칙 |
| `categoryId` / `categoryName` | 둘 다 null이면 미분류 게시글이다. 상세 페이지의 Category 그룹화에서 별도 "미분류" 그룹으로 처리해야 한다. | §5 Category 규칙 |
| `pinned` | 정렬 그룹만 결정한다. 고정 그룹 내부는 다시 `publishedAt` 내림차순이다. | §5 정렬 규칙 |
| `hidden` (Admin 전용) | Admin 목록에서 숨김 배지를 표시하는 근거다. 사용자 응답 스키마(`Post`)에는 이 필드가 존재하지 않는다 — 값이 false인 게 아니라 필드 자체가 없다. | §5 숨김 규칙 |
| `hiddenAt` | 마지막 숨김 시각. 복구하면 null로 돌아가므로 숨김 이력이 아니라 **현재 상태의 부가 정보**다. 이력이 필요하면 별도 설계가 필요하다. | §5 숨김 규칙 |
| `postCount` (Admin Category) | 숨김 게시글을 포함한 수다. 0이 아니면 삭제 버튼을 비활성화하는 근거로 쓰지만, 최종 판정은 삭제 요청 시점의 서버 응답이다. | §5 Category 규칙 |
| `code` | 400은 입력 문제, 404는 대상 부재, 409는 상태 충돌이다. 코드별 의미는 카탈로그를 따른다. | [에러 코드 카탈로그](../catalogs/error-codes.md) |

## 5. 주요 동작 규칙

### 정렬

- 사용자·Admin 목록 모두 `pinned` 내림차순 → `publishedAt` 내림차순으로 정렬한다.
- 고정 게시글과 일반 게시글은 **분리된 두 그룹**이며, 각 그룹 내부에서만 시간순이다. 전체를 시간순으로 섞으면 상단 고정 기능이 무효가 된다.
- `sort` 쿼리 파라미터는 제공하지 않는다. 정렬 선택 요구사항이 없다.

### 숨김

- 게시글 삭제 API는 존재하지 않는다. 숨김만 존재한다.
- 사용자용 API(`/install/v1/posts*`)는 숨김 게시글을 어떤 경로로도 반환하지 않는다.
- 숨김 게시글 URL 직접 접근은 `403`이 아니라 `404 POST_NOT_FOUND`다. `403`은 "그 글이 존재한다"는 사실을 노출한다.
- 숨김/복구는 idempotent하다. 이미 같은 상태여도 `200`이며 에러가 아니다.

### 수정

- `PATCH`는 `publishedAt`을 갱신하지 않고 `updatedAt`만 갱신한다.
- `type` 변경은 지원하지 않는다.
- `title`, `content`는 필수값이며 공백만으로 이루어질 수 없다. `content`는 HTML 태그 제거 후 텍스트가 남아야 한다.
- 폰트 스타일은 관리자가 수정할 수 없다 — HTML allow-list에 `style` / `class` 속성이 없으므로 계약 수준에서 이미 차단된다.

### Category

- Category는 `type`에 소속된다. FAQ와 Notice가 같은 Category를 공유하지 않는다.
- 삭제는 잔여 게시글이 0건일 때만 가능하다. 숨김 게시글도 잔여 게시글로 계산한다.
- Category 이름 수정 API와 표시 순서 변경 API는 이번 범위에 포함하지 않는다. 요구사항에 없다.
- `categoryId`가 null인 미분류 게시글이 존재할 수 있다.

### 본문 HTML allow-list

`Admin Guides` Tag와 **동일한 allow-list**를 사용한다. 별도 정책을 만들지 않는다.

| 구분 | 허용 값 |
| --- | --- |
| Tags | `h4`, `p`, `br`, `ul`, `ol`, `li`, `strong`, `em`, `code`, `a` |
| Attributes | `a.href`, `a.target`, `a.rel` |
| href | `http://...`, `https://...`, `mailto:...`, `/...` |

이미지(`img`)와 첨부파일은 allow-list에 없으므로 지원하지 않는다. 허용되지 않은 HTML은 sanitize해서 저장하지 않고 `POST_CONTENT_INVALID`로 거부한다.

### 범위 밖

- **Pass 소개 배너**: 고정 콘텐츠로 보고 이 Tag에 API를 두지 않는다. Admin 편집이 필요해지면 `Admin Guides` Tag(`/install/v1/admin/guides/{name}`) 재사용을 먼저 검토한다 — name-keyed content store가 배너 한 벌에 정확히 맞는 구조다.
- **페이지네이션**: 사용자·Admin 목록 모두 전체 배열을 반환한다. 게시글이 늘어나면 Admin 목록부터 Spring `Page` envelope을 도입한다.

## 6. 관련 enum / state

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `PostType` | `FAQ`, `NOTICE` | 게시글과 Category 양쪽에서 사용한다. |

enum 카탈로그(`catalogs/enums-and-states.md`)가 아직 부트스트랩되지 않아 이 표에 기록한다. 카탈로그가 생기면 이관한다.

## 7. 관련 error code

> 이 Tag의 error code는 아직 `catalogs/error-codes.md`에 등록되지 않았다. [2026-08-12 논의](../discussions/2026-08-12-faq-notices-added.md)가 `Accepted`로 전환될 때 카탈로그에 추가하고, 아래 블록을 `/bff-api-docs sync-error-refs`로 재생성한다. 후보 코드 목록은 그 논의의 §4에 있다.

<!-- BFF-API-DOCS:BEGIN error-code-table (managed by /bff-api-docs sync-error-refs) -->
| 코드 | 의미 | 발생 API |
| --- | --- | --- |
<!-- BFF-API-DOCS:END error-code-table -->

## 8. 변경 / 논의 이력

| 날짜 | 상태 | 변경 유형 | 요약 | 관련 논의 |
| --- | --- | --- | --- | --- |
| 26.08.12 | Draft | Added | FAQ / 공지사항 게시글·Category API 12건 초안 작성. 단일 `posts` 리소스 + `type` 구분, 삭제 없이 숨김 전이, Category 삭제는 잔여 게시글 0건일 때만 허용하는 방향으로 제안. | [2026-08-12 논의](../discussions/2026-08-12-faq-notices-added.md) |
