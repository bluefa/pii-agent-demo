# Admin Guides

> Confluence: 5.2.3.5.5.10.1.11
> 상태: Implemented
> API Tag: `Admin Guides`
> 담당: TBD
> 마지막 수정일: 2026-04-29
> 관련 PR: https://github.sec.samsung.net/bdp/data-integration-platform/pull/8126

## 1. 목적

Admin Guides는 Self-Installation Tool 관리자 화면에서 사용하는 guide content를 guide name 단위로 저장하고 조회하는 BFF API Tag다.

프론트엔드가 guide name catalog와 화면 배치 정보를 소유하고, BFF는 path variable의 `name`을 content 저장 키로만 사용한다. BFF는 guide name enum, 목록 API, provider/step/slot/placement 메타데이터를 관리하지 않는다.

## 2. BFF Swagger

> Swagger 상태: Implemented
> 생성 기준: PR #8126, head `a3723542720279b139eef00836b85fa20aff5225`

```yaml
openapi: 3.0.1
info:
  title: BFF API - Admin Guides
  version: v0
servers:
- url: https://dip-stg.di.atlas.samsung.com
  description: Generated server url
tags:
- name: Admin Guides
  description: Admin guide content APIs
paths:
  /install/v1/admin/guides/{name}:
    parameters:
    - name: name
      in: path
      required: true
      description: Guide content storage key. BFF does not validate this value against a guide name catalog.
      schema:
        type: string
        example: FRONTEND_ONLY_GUIDE
    get:
      tags:
      - Admin Guides
      summary: Get guide content
      operationId: getGuide
      x-expected-duration: 50ms
      description: |
        Guide name으로 저장된 ko/en guide content를 조회한다.

        저장된 row가 없거나 BFF가 모르는 name이어도 404를 반환하지 않는다. path의 `name`을 그대로 응답하고, 빈 content와 epoch `updatedAt`을 반환한다.
      responses:
        '200':
          description: 조회 성공. 저장된 content가 없으면 빈 content 반환.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GuideDetail'
              examples:
                empty:
                  summary: 저장된 content 없음
                  value:
                    name: FRONTEND_ONLY_GUIDE
                    contents:
                      ko: ""
                      en: ""
                    updatedAt: "1970-01-01T00:00:00Z"
                saved:
                  summary: 저장된 content 있음
                  value:
                    name: AWS_APPLYING
                    contents:
                      ko: "<h4>한국어 제목</h4><p>본문</p>"
                      en: "<h4>English title</h4><p>Body</p>"
                    updatedAt: "2026-04-28T09:00:00Z"
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
    put:
      tags:
      - Admin Guides
      summary: Update guide content
      operationId: updateGuide
      x-expected-duration: 50ms
      description: |
        Guide name에 해당하는 ko/en guide content를 전체 교체 저장한다.

        기존 row가 있으면 갱신하고, 없으면 새 row를 생성한다. BFF는 `name`을 catalog와 대조하지 않으며, 프론트엔드가 소유한 guide name을 그대로 저장 키로 사용한다.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GuideUpdateRequest'
            example:
              contents:
                ko: "<h4>한국어 제목</h4><p>본문</p>"
                en: "<h4>English title</h4><p>Body</p>"
      responses:
        '200':
          description: 저장 성공. 저장된 content와 updatedAt 반환.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GuideDetail'
              example:
                name: FRONTEND_ONLY_GUIDE
                contents:
                  ko: "<h4>한국어 제목</h4><p>본문</p>"
                  en: "<h4>English title</h4><p>Body</p>"
                updatedAt: "2026-04-28T09:00:00Z"
        '400':
          description: 요청 구조 또는 guide HTML 검증 실패
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
              examples:
                validation_failed:
                  summary: 요청 구조 검증 실패
                  value:
                    timestamp: "2026-04-29T02:27:09.123Z"
                    status: BAD_REQUEST
                    code: VALIDATION_FAILED
                    message: "contents.ko must be a string"
                    path: "uri=/install/v1/admin/guides/FRONTEND_ONLY_GUIDE"
                guide_content_invalid:
                  summary: HTML allow-list 또는 빈 본문 검증 실패
                  value:
                    timestamp: "2026-04-29T02:27:09.123Z"
                    status: BAD_REQUEST
                    code: GUIDE_CONTENT_INVALID
                    message: "Guide content contains disallowed HTML or empty text."
                    path: "uri=/install/v1/admin/guides/FRONTEND_ONLY_GUIDE"
        '500':
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorMessage'
components:
  schemas:
    GuideDetail:
      type: object
      properties:
        name:
          type: string
          description: 요청 path의 guide name. BFF는 catalog 검증 없이 저장 키로 사용한다.
          example: FRONTEND_ONLY_GUIDE
        contents:
          $ref: '#/components/schemas/GuideContents'
        updatedAt:
          type: string
          format: date-time
          description: 마지막 저장 시각. 저장된 row가 없으면 epoch.
          example: "1970-01-01T00:00:00Z"
    GuideContents:
      type: object
      properties:
        ko:
          type: string
          description: Korean guide HTML content.
          example: "<h4>한국어 제목</h4><p>본문</p>"
        en:
          type: string
          description: English guide HTML content.
          example: "<h4>English title</h4><p>Body</p>"
    GuideUpdateRequest:
      type: object
      required:
      - contents
      properties:
        contents:
          $ref: '#/components/schemas/GuideContentRequest'
    GuideContentRequest:
      type: object
      required:
      - ko
      - en
      properties:
        ko:
          type: string
          description: Korean guide HTML content. Required and must pass HTML allow-list validation.
        en:
          type: string
          description: English guide HTML content. Required and must pass HTML allow-list validation.
    ErrorMessage:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
          description: UTC 기준 ISO-8601 timestamp 문자열. 화면 표시가 필요하면 클라이언트 로컬 timezone 기준으로 변환한다.
          example: "2026-04-29T02:27:09.123Z"
        status:
          type: string
          example: BAD_REQUEST
        code:
          type: string
          nullable: true
          enum:
          - VALIDATION_FAILED
          - GUIDE_CONTENT_INVALID
        message:
          type: string
        path:
          type: string
```

## 3. API 목록

| Method | Path | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | `/install/v1/admin/guides/{name}` | guide name 기준 guide content 조회 | Implemented |
| PUT | `/install/v1/admin/guides/{name}` | guide name 기준 guide content 생성/갱신 | Implemented |

## 4. Response 설명

| Response 항목 | 설명 | 관련 기준 |
| --- | --- | --- |
| `name` | path variable로 전달된 guide name. BFF는 catalog 검증 없이 저장 키로 사용한다. | Frontend guide registry |
| `contents.ko` | 한국어 guide HTML. 저장된 row가 없으면 빈 문자열이다. | HTML allow-list |
| `contents.en` | 영어 guide HTML. 저장된 row가 없으면 빈 문자열이다. | HTML allow-list |
| `updatedAt` | 마지막 저장 시각. 저장된 row가 없으면 `1970-01-01T00:00:00Z`이다. | 공통 time 규칙 |
| `code` | `VALIDATION_FAILED`는 요청 구조 문제, `GUIDE_CONTENT_INVALID`는 HTML 또는 빈 본문 문제를 의미한다. | [에러 코드 카탈로그](../catalogs/error-codes.md) |

## 5. 주요 동작 규칙

- 프론트엔드가 guide name catalog, 표시 위치, provider/step/slot/placement 메타데이터를 소유한다.
- BFF는 `{name}`을 저장 키로만 사용하고, 알 수 없는 name을 거부하지 않는다.
- `GET`은 저장된 row가 없으면 `404`가 아니라 빈 `ko`, `en`과 epoch `updatedAt`을 반환한다.
- `PUT`은 기존 row가 있으면 갱신하고, 없으면 새 row를 생성한다.
- `PUT` 요청의 `contents.ko`, `contents.en`은 모두 문자열이어야 한다.
- `ko`, `en` 모두 HTML 제거 후 공백이 아닌 텍스트가 남아 있어야 한다.
- BFF는 허용되지 않은 HTML을 sanitize해서 저장하지 않고 `GUIDE_CONTENT_INVALID`로 거부한다.

### HTML allow-list

| 구분 | 허용 값 |
| --- | --- |
| Tags | `h4`, `p`, `br`, `ul`, `ol`, `li`, `strong`, `em`, `code`, `a` |
| Attributes | `a.href`, `a.target`, `a.rel` |
| href | `http://...`, `https://...`, `mailto:...`, `/...` |

`//...` protocol-relative URL, `javascript:...`, `data:...`, inline event handler, style/class attribute, allow-list 밖의 태그는 저장할 수 없다.

## 6. 변경/논의 이력 요약

| 날짜 | 상태 | 변경 유형 | 요약 | 관련 링크 |
| --- | --- | --- | --- | --- |
| 26.04.28 | Implemented | Added | Admin guide content 저장/조회 API 추가. Frontend가 guide name catalog를 소유하고 BFF는 name-keyed content store만 담당하도록 결정. | PR #8126 |
