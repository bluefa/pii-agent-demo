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

        **본문(`contents`)은 담지 않는다.** 담으면 응답 크기가 게시글 수에 비례해 커지고,
        페이지네이션이 없는 이 계약(§5 범위 밖)에서는 시간이 갈수록 단조 증가한다.
        본문은 아코디언을 펼칠 때 `GET /install/v1/posts/{postId}`로 가져온다.
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
                  $ref: '#/components/schemas/PostSummary'
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
        본문까지 담은 게시글 단건 조회. **아코디언을 펼칠 때 호출한다.** 딥링크(URL 직접 접근)도
        같은 엔드포인트를 쓴다.

        숨김 게시글은 `403`이 아니라 `404`를 반환한다. 존재 여부 자체를 사용자에게 노출하지 않는다.
        목록을 받은 뒤 관리자가 숨김 처리하면 펼치는 시점에 404가 날 수 있다 — 화면은 이 경우를
        오류가 아니라 "지금은 볼 수 없는 글"로 처리한다.
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
                  $ref: '#/components/schemas/AdminPostSummary'
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
          description: >-
            요청 구조 검증 실패(VALIDATION_FAILED), 본문 HTML 검증 실패(POST_CONTENT_INVALID),
            이미지 개수 초과(POST_IMAGE_LIMIT_EXCEEDED), 게시글 총 용량 초과(POST_SIZE_LIMIT_EXCEEDED)
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
    put:
      tags:
      - FAQ & Notices
      summary: Update a post
      operationId: updatePost
      x-expected-duration: 100ms
      description: |
        Title, 본문, Category를 **전체 교체 저장**한다. 요청 body가 수정 후의 완성된 상태이며,
        `categoryId`를 생략하면 기존 Category가 유지되는 것이 아니라 미분류가 된다.

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
          description: >-
            요청 구조 검증 실패(VALIDATION_FAILED), 본문 HTML 검증 실패(POST_CONTENT_INVALID),
            이미지 개수 초과(POST_IMAGE_LIMIT_EXCEEDED), 게시글 총 용량 초과(POST_SIZE_LIMIT_EXCEEDED)
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
  /install/v1/admin/posts/images:
    post:
      tags:
      - FAQ & Notices
      summary: Upload a body image
      operationId: uploadPostImage
      x-expected-duration: 800ms
      description: |
        본문에 넣을 이미지를 업로드하고 참조 URL을 돌려준다. 게시글과 무관하게 동작하며,
        업로드만으로는 어떤 게시글에도 연결되지 않는다. 실제 연결은 반환된 `url`이
        본문 HTML의 `img.src`로 저장되는 시점에 생긴다.

        본문에는 이미지 바이트를 넣지 않는다. 목록 API가 본문을 통째로 내려주는 구조이므로
        base64 인라인은 목록 응답을 수 MB 단위로 부풀린다.

        **파일 1개당 5MB 상한이 이 API의 설계 전제다.** 상한이 있으므로 업로드는
        `multipart/form-data` 요청 **한 번**으로 끝난다. 조각 업로드(S3 Multipart,
        GCS Resumable)의 initiate / upload-parts / complete 흐름도, 이어올리기 상태 관리도
        계약에 넣지 않는다. 상한을 올리려면 이 결정부터 다시 봐야 한다.
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required:
              - file
              properties:
                file:
                  type: string
                  format: binary
                  description: >-
                    png / jpeg / webp. 파일 1개당 최대 5MB. 요청 1회에 파일 1개만 보낸다.
      responses:
        '201':
          description: 업로드 성공
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ImageUploadResponse'
        '400':
          description: 허용되지 않는 형식 (UNSUPPORTED_IMAGE_TYPE)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '413':
          description: 파일 크기 초과 (IMAGE_TOO_LARGE)
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
      description: >-
        본문과 감사 필드까지 담은 Admin 게시글 단건. 수정 화면 진입과 등록·수정·상태 전이 응답에 쓰인다.
      allOf:
      - $ref: '#/components/schemas/AdminPostSummary'
      - type: object
        properties:
          contents:
            $ref: '#/components/schemas/LocalizedText'
          createdBy:
            type: string
          updatedBy:
            type: string
    AdminPostSummary:
      type: object
      description: >-
        Admin 목록용 게시글. 사용자 목록과 같은 이유로 본문을 담지 않는다.
        Admin 목록 화면은 배지·Title·게시일자·작업 버튼만 그리므로 본문이 필요 없다.
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
        titles:
          $ref: '#/components/schemas/LocalizedText'
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
          - UNSUPPORTED_IMAGE_TYPE
          - IMAGE_TOO_LARGE
          - POST_IMAGE_LIMIT_EXCEEDED
          - POST_SIZE_LIMIT_EXCEEDED
        message:
          type: string
        path:
          type: string
    ImageUploadResponse:
      type: object
      description: 업로드된 이미지의 참조 정보. 에디터는 이 값으로 본문에 img 태그를 만든다.
      properties:
        url:
          type: string
          description: >-
            저장된 이미지의 절대 URL. 본문 img.src에는 이 값만 넣을 수 있으며,
            BFF는 저장 시 허용된 호스트 prefix인지 검사한다.
          example: "https://storage.example.com/pass/posts/2026/08/9f3c1a.png"
        width:
          type: integer
          format: int32
          description: 원본 픽셀 너비. 레이아웃 밀림을 막기 위한 값이며 관리자가 조절하는 값이 아니다.
        height:
          type: integer
          format: int32
          description: 원본 픽셀 높이.
    LocalizedText:
      type: object
      description: 한국어/영어 쌍. 두 값 모두 항상 존재한다.
      properties:
        ko:
          type: string
        en:
          type: string
    LocalizedTextRequest:
      type: object
      description: 한국어/영어 모두 필수. 태그 제거 후 공백만 남으면 거부된다.
      required:
      - ko
      - en
      properties:
        ko:
          type: string
        en:
          type: string
    Post:
      description: >-
        본문까지 담은 사용자 화면용 게시글 단건. 아코디언을 펼칠 때 이 응답을 받는다.
      allOf:
      - $ref: '#/components/schemas/PostSummary'
      - type: object
        properties:
          contents:
            $ref: '#/components/schemas/LocalizedText'
    PostSummary:
      type: object
      description: >-
        목록용 게시글. 본문(`contents`)을 담지 않는다 — 목록 응답이 게시글 수에 비례해
        커지지 않도록 하기 위해서다. 본문은 펼칠 때 단건 조회로 가져온다.
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
        titles:
          $ref: '#/components/schemas/LocalizedText'
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
      - titles
      - contents
      properties:
        type:
          $ref: '#/components/schemas/PostType'
        categoryId:
          type: integer
          format: int64
          nullable: true
          description: 생략하거나 null이면 미분류 게시글이 된다.
        titles:
          $ref: '#/components/schemas/LocalizedTextRequest'
        contents:
          $ref: '#/components/schemas/LocalizedTextRequest'
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
      description: >-
        수정 후의 완성된 상태를 그대로 보내는 전체 교체 요청. 생략된 필드는 "유지"가 아니라 "비움"이다.
        한 언어만 고쳐도 네 값(titles.ko/en, contents.ko/en)을 모두 다시 보낸다.
      required:
      - titles
      - contents
      properties:
        categoryId:
          type: integer
          format: int64
          nullable: true
          description: 생략하거나 null이면 미분류가 된다. 기존 Category는 유지되지 않는다.
        titles:
          $ref: '#/components/schemas/LocalizedTextRequest'
        contents:
          $ref: '#/components/schemas/LocalizedTextRequest'
```

## 3. API 목록

| Method | Path | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | `/install/v1/posts` | 사용자용 게시글 목록. 숨김 제외, 고정→시간 정렬. **본문 없음** | Draft |
| GET | `/install/v1/posts/{postId}` | 본문 포함 단건 조회. 아코디언 펼침 + 딥링크. 숨김이면 404 | Draft |
| GET | `/install/v1/post-categories` | 사용자용 Category 목록. 비활성 제외 | Draft |
| GET | `/install/v1/admin/posts` | Admin 게시글 목록. 숨김 포함, `hidden` 노출. **본문 없음** | Draft |
| POST | `/install/v1/admin/posts` | 게시글 등록 | Draft |
| GET | `/install/v1/admin/posts/{postId}` | 본문 포함 단건 조회 (수정 화면 진입). 숨김도 조회 가능 | Draft |
| PUT | `/install/v1/admin/posts/{postId}` | Title / 본문 / Category 전체 교체 수정 | Draft |
| PUT | `/install/v1/admin/posts/{postId}/hidden` | 숨김 처리 / 복구 | Draft |
| PUT | `/install/v1/admin/posts/{postId}/pinned` | 상단 고정 / 고정 해제 | Draft |
| POST | `/install/v1/admin/posts/images` | 본문 이미지 업로드. URL 반환 | Draft |
| GET | `/install/v1/admin/post-categories` | Admin Category 목록. 비활성 포함, `postCount` 포함 | Draft |
| POST | `/install/v1/admin/post-categories` | Category 추가 | Draft |
| DELETE | `/install/v1/admin/post-categories/{categoryId}` | Category 삭제. 잔여 게시글 있으면 409 | Draft |

## 4. Response 설명

| Response 항목 | 설명 | 관련 기준 |
| --- | --- | --- |
| 목록 응답의 배열 순서 | 서버가 정렬을 마친 순서다. 클라이언트는 재정렬하지 않는다. 재정렬하면 메인 페이지와 상세 페이지의 순서가 갈라진다. | §5 정렬 규칙 |
| `titles` | 목록·단건 모두에 있으며 항상 `ko`와 `en`을 담는다. 화면이 언어를 고르므로 언어 전환에 재조회가 없다. | §5 다국어 규칙 |
| `contents` | **단건 응답에만 있다.** 목록(`PostSummary` / `AdminPostSummary`)에는 없다. 목록에서 본문을 읽으려 하면 `undefined`다 — 펼침 시 단건 조회로 가져와야 한다. | §5 본문 로딩 |
| `contents.*` 안의 `img` | `src`는 업로드 API가 돌려준 URL만 들어 있다. `width`/`height`는 원본 픽셀 크기이며 관리자가 조절한 값이 아니다 — 레이아웃 밀림을 막기 위한 값이다. | §5 본문 HTML allow-list |
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

기대 결과 예시 (요구사항 원문의 예시와 동일해야 한다):

| 순서 | 게시글 | `pinned` | `publishedAt` |
| --- | --- | --- | --- |
| 1 | FAQ A | true | 2026-08-12 |
| 2 | 공지 B | true | 2026-08-10 |
| 3 | FAQ C | false | 2026-08-11 |
| 4 | 공지 D | false | 2026-08-09 |

`publishedAt`이 더 최신인 FAQ C(08-11)가 공지 B(08-10)보다 **뒤에** 온다. 1순위 키가 `pinned`이기 때문이다.
이 순서가 나오지 않으면 정렬 구현이 잘못된 것이다.

### 숨김

- 게시글 삭제 API는 존재하지 않는다. 숨김만 존재한다.
- 사용자용 API(`/install/v1/posts*`)는 숨김 게시글을 어떤 경로로도 반환하지 않는다.
- 숨김 게시글 URL 직접 접근은 `403`이 아니라 `404 POST_NOT_FOUND`다. `403`은 "그 글이 존재한다"는 사실을 노출한다.
- 숨김/복구는 idempotent하다. 이미 같은 상태여도 `200`이며 에러가 아니다.

### 수정

- `PUT`은 `publishedAt`을 갱신하지 않고 `updatedAt`만 갱신한다.
- `PUT`은 partial update가 아니다. 수정 화면은 기존 값을 채운 상태로 열고, 사용자가 건드리지 않은 필드도 그대로 다시 보낸다. `categoryId`를 빠뜨리면 게시글이 조용히 미분류가 된다. 한국어만 고쳐도 `titles`와 `contents`의 네 값을 모두 다시 보낸다.
- `type` 변경은 지원하지 않는다.
- 폰트 스타일은 관리자가 수정할 수 없다 — HTML allow-list에 `style` / `class` 속성이 없으므로 계약 수준에서 이미 차단된다.

### 다국어

- `titles`와 `contents`는 각각 `ko`, `en`을 모두 갖는다. **네 값이 전부 필수**이며, HTML 태그를 제거한 뒤 공백만 남으면 저장이 거부된다. 기존 `Admin Guides` Tag와 같은 규칙이다.
- 조회 API는 언어를 고르지 않고 **양쪽을 모두 반환한다.** 화면이 언어를 선택하므로 언어 전환에 재조회가 없다. `lang` 쿼리 파라미터는 두지 않는다.
- 언어별 fallback은 없다. 한쪽이 비는 상태를 저장 단계에서 막기 때문에 조회 단계에서 대체할 일이 없다.
- 프론트엔드에는 이미 같은 구조의 자산이 있다 — 언어 탭/미리보기 토글(`segmentedControlStyles`), allow-list 검증기(`lib/utils/validate-guide-html.ts`), AST 렌더러(`render-guide-ast.tsx`). 새로 설계하지 않고 이들을 게시글에 적용한다.

### 본문 로딩

- 목록 API는 본문을 담지 않는다. 아코디언을 펼치는 시점에 `GET /install/v1/posts/{postId}`를 호출한다.
- 목록에 본문을 실으면 응답 크기가 `게시글 수 × 2개 언어`에 비례해 커진다. 페이지네이션이 없으므로(§5 범위 밖) 이 값은 시간이 갈수록 단조 증가하며, 특히 전체보기 화면은 정의상 전량을 받으므로 상한이 없다.
- 대가는 펼칠 때마다 왕복 한 번이다. 화면은 펼침 패널에 스켈레톤을 두고, 한 번 받은 본문은 다시 접었다 펴도 재요청하지 않는다.
- 같은 규칙이 Admin 목록에도 적용된다. Admin 목록 화면은 배지·Title·게시일자·작업 버튼만 그리므로 본문이 필요 없고, 수정 화면이 `GET /install/v1/admin/posts/{postId}`로 본문을 가져온다.
- 목록을 받은 뒤 관리자가 숨김 처리하면 펼침 시점에 `404 POST_NOT_FOUND`가 날 수 있다. 화면은 이를 오류가 아니라 "지금은 볼 수 없는 글"로 처리하고 해당 행을 목록에서 제거한다.

### 본문 이미지

- 이미지는 `POST /install/v1/admin/posts/images`로 먼저 업로드하고, 응답의 `url`을 본문 `img.src`에 넣는다. 본문에 바이트를 인라인(base64)하지 않는다.
- **파일 1개당 5MB, 요청 1회에 1개.** 이 상한이 있어서 조각 업로드(resumable / chunked) 프로토콜이 필요 없다. `multipart/form-data`는 파일 하나를 담는 표준 content-type일 뿐, 조각 업로드와 다른 이야기다.
- 상한이 고정이므로 BFF가 바이트를 메모리에 버퍼링해 저장소로 넘겨도 안전하다. 브라우저가 저장소에 직접 올리는 서명 URL 방식은 도입하지 않는다 — 엔드포인트가 늘고 저장소 자격증명이 클라이언트 쪽으로 나간다.
- 에디터는 업로드 전에 파일 크기·형식을 먼저 검사한다. 5MB짜리를 다 올린 뒤 413을 받는 것보다, 고르는 순간 막는 편이 낫다. 서버 검증은 그대로 유지한다.
- 관리자가 조절할 수 있는 것은 **본문 안에서의 위치(순서)뿐**이다. 정렬·크기 조절은 이번 범위가 아니다. `img`에 `class`/`style`/`align`을 허용하지 않으므로 계약 수준에서 막힌다.
- `width`/`height`는 업로드 응답이 준 원본 픽셀 크기를 에디터가 그대로 기록한 값이다. 관리자 입력값이 아니며, 화면 표시 폭은 CSS(`max-width: 100%`)가 통제한다.
- `img.src`는 **허용된 저장소 호스트 prefix로 시작해야 한다.** 임의 외부 URL은 `POST_CONTENT_INVALID`로 거부한다.
- 업로드만으로는 어떤 게시글에도 연결되지 않는다. 업로드 후 저장하지 않고 이탈하면 고아 파일이 남는다 — 정리 정책이 필요하다(§5 범위 밖).
- **게시글 하나에 이미지는 최대 10개**다. `titles`가 아니라 `contents.ko`와 `contents.en`을 합쳐서 센다. 같은 URL이 두 번 들어가면 1개로 센다 — 저장소에 파일이 하나이기 때문이다.
- **게시글 하나의 총 용량은 최대 10MB**다. 본문이 참조하는 이미지들의 바이트 합이며, ko/en을 합쳐 계산하고 중복 URL은 한 번만 더한다. 파일 1개 상한(5MB)과 별개로 동작하며, 둘 중 먼저 걸리는 쪽이 저장을 막는다.
- 두 상한은 업로드가 아니라 **저장 시점**에 검사한다. 업로드는 파일 단위라 그 시점에는 어느 게시글에 들어갈지 알 수 없다. 초과하면 `POST_IMAGE_LIMIT_EXCEEDED` 또는 `POST_SIZE_LIMIT_EXCEEDED`로 거부한다.
- 에디터는 저장 전에 같은 계산을 미리 수행해 남은 개수와 용량을 보여준다. 서버 검증은 그대로 유지한다.
- 아코디언은 접힌 상태에서도 이미지 노드가 렌더 트리에 존재하므로, 렌더러는 `loading="lazy"`를 붙인다. 붙이지 않으면 메인 화면 진입만으로 모든 게시글의 이미지가 내려받아진다.

### Category

- Category는 `type`에 소속된다. FAQ와 Notice가 같은 Category를 공유하지 않는다.
- 삭제는 잔여 게시글이 0건일 때만 가능하다. 숨김 게시글도 잔여 게시글로 계산한다.
- Category 이름 수정 API와 표시 순서 변경 API는 이번 범위에 포함하지 않는다. 요구사항에 없다.
- `categoryId`가 null인 미분류 게시글이 존재할 수 있다.

### 본문 HTML allow-list

`Admin Guides` Tag와 **동일한 allow-list**를 사용한다. 별도 정책을 만들지 않는다.

`Admin Guides`의 allow-list에 `img` 하나만 더한 형태다.

| 구분 | 허용 값 |
| --- | --- |
| Tags | `h4`, `p`, `br`, `ul`, `ol`, `li`, `strong`, `em`, `code`, `a`, `img` |
| Attributes | `a.href`, `a.target`, `a.rel`, `img.src`, `img.alt`, `img.width`, `img.height` |
| href | `http://...`, `https://...`, `mailto:...`, `/...` |
| img.src | 업로드 API가 반환한 저장소 호스트 prefix로 시작하는 URL만 |

`//...` protocol-relative URL, `javascript:...`, `data:...`, inline event handler, style/class 속성, allow-list 밖의 태그는 저장할 수 없다. 첨부파일은 지원하지 않는다. 허용되지 않은 HTML은 sanitize해서 저장하지 않고 `POST_CONTENT_INVALID`로 거부한다.

`img`를 허용하려면 프론트엔드도 두 곳을 함께 고쳐야 한다 — `validate-guide-html.ts`의 노드 타입과 `render-guide-ast.tsx`의 렌더 분기다. 렌더러는 `dangerouslySetInnerHTML`을 쓰지 않고 타입이 정의된 노드만 그리므로, 서버 allow-list만 열면 이미지가 조용히 사라진다.

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
| 26.08.12 | Draft | Changed | Title·본문을 ko/en 쌍(`titles`, `contents`)으로 변경하고 본문 이미지 업로드 API를 추가(12 → 13건). allow-list에 `img` 추가. Draft 단계라 별도 discussion 없이 같은 논의 문서(§2.9)에 이어 기록. | [2026-08-12 논의](../discussions/2026-08-12-faq-notices-added.md) |
| 26.08.12 | Draft | Changed | 목록 응답에서 본문을 제거하고 단건 조회로 옮김(`PostSummary` / `AdminPostSummary` 신설). 초안의 "목록에 본문 포함" 결정을 뒤집은 것으로, ko/en 2배 · 페이지네이션 없음 · 전체보기 화면이 겹쳐 목록 크기에 상한이 없어졌기 때문이다. 엔드포인트 수는 13건 그대로. | [2026-08-12 논의](../discussions/2026-08-12-faq-notices-added.md) §2.3 |
