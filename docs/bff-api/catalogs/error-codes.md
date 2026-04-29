# 에러 코드 카탈로그

> Confluence: 5.2.3.5.5.10.2.1
> 상태: Draft
> 마지막 수정일: 2026-04-29
> 대상: BFF API error code의 운영 의미, 사용자 액션, 운영자 확인 포인트

## 1. 목적

이 문서는 BFF API error code의 운영 의미를 설명하는 카탈로그다.

Swagger/OpenAPI와 코드는 error code 값과 response schema의 원본이다. 이 문서는 값을 대체하지 않고, 각 code가 어떤 상황에서 발생하는지, 사용자가 무엇을 해야 하는지, 운영자가 무엇을 확인해야 하는지를 정리한다.

## 2. 공통 원칙

- Error code 값의 원본은 BFF Swagger와 구현 코드다.
- 이 문서는 code의 의미, 발생 조건, 재시도 가능 여부, 사용자/운영자 액션을 설명한다.
- 동일 code라도 API Tag별 발생 조건이 다를 수 있으므로 `관련 API Tag`와 `관련 API`를 함께 기록한다.
- 사용자 입력이나 요청 구조 문제는 일반적으로 재시도 전에 입력값 또는 클라이언트 payload를 수정해야 한다.
- 서버가 허용하지 않는 business rule 위반은 자동 sanitize 또는 묵시적 보정 없이 명시적인 error code로 반환한다.

## 3. Error Response Format

Admin Guides BFF는 `application/json`의 `ErrorMessage` 형식을 사용한다.

```json
{
  "timestamp": "2026-04-29T02:27:09.123Z",
  "status": "BAD_REQUEST",
  "code": "VALIDATION_FAILED",
  "message": "contents.ko must be a string",
  "path": "uri=/install/v1/admin/guides/FRONTEND_ONLY_GUIDE"
}
```

| Field | 의미 |
| --- | --- |
| `timestamp` | BFF가 error response를 생성한 시각. UTC 기준 ISO-8601 문자열이며, 화면 표시가 필요하면 클라이언트 로컬 timezone 기준으로 변환한다. |
| `status` | HTTP status 이름 |
| `code` | BFF error code. 일부 공통 에러에서는 null일 수 있다. |
| `message` | 개발자/운영자가 원인 파악에 참고할 수 있는 메시지 |
| `path` | 요청 URI 정보 |

## 4. Error Code 목록

| 코드 | HTTP status | 의미 | 발생 조건 | 재시도 가능 여부 | 사용자 액션 | 운영자 확인 포인트 | 관련 API Tag | 관련 API | 폐기 예정 여부 | 추가일 / 변경일 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `VALIDATION_FAILED` | 400 Bad Request | 요청 JSON 구조 또는 필드 타입이 BFF 계약과 맞지 않음 | `contents`가 없거나 null인 경우, `contents.ko` 또는 `contents.en`이 없거나 문자열이 아닌 경우, JSON body 파싱 실패 | 아니오. 같은 payload로 재시도해도 실패한다. | 화면에서 저장 요청 payload 생성 로직을 수정한다. 사용자가 직접 해결할 수 있는 입력 문제가 아니라면 저장 실패 안내 후 재시도 버튼보다 문의/새로고침을 우선한다. | 클라이언트가 `contents.ko`, `contents.en`을 항상 string으로 전송하는지 확인한다. API client, editor state serialization, Content-Type을 확인한다. | Admin Guides | `PUT /install/v1/admin/guides/{name}` | 아니오 | 2026-04-28 |
| `GUIDE_CONTENT_INVALID` | 400 Bad Request | Guide HTML content가 BFF allow-list 또는 non-empty 규칙을 만족하지 않음 | `ko` 또는 `en`의 HTML 제거 후 텍스트가 비어 있는 경우, 허용되지 않은 HTML tag/attribute/link scheme이 포함된 경우 | 아니오. content를 수정해야 한다. | 사용자가 guide 본문을 입력하거나 허용된 서식만 사용하도록 안내한다. 에디터는 저장 전에 동일한 allow-list 검증을 수행하고, 실패 위치를 가능한 한 입력 화면에서 표시한다. | 서버 validator와 프론트 validator의 allow-list가 같은지 확인한다. 저장 요청이 sanitize된 값이 아니라 원본 HTML을 보내고 있는지, 금지 tag/attribute가 editor에서 생성되는지 확인한다. | Admin Guides | `PUT /install/v1/admin/guides/{name}` | 아니오 | 2026-04-28 |

## 5. Admin Guides 운영 기준

Admin Guides는 guide name catalog를 BFF에서 검증하지 않는다.

- 알 수 없는 `{name}`을 조회해도 `GUIDE_NOT_FOUND`를 반환하지 않는다.
- 저장된 row가 없으면 `GET /install/v1/admin/guides/{name}`은 `200 OK`와 빈 `contents`를 반환한다.
- `PUT /install/v1/admin/guides/{name}`에서 검증 대상은 path의 `name`이 아니라 request body 구조와 HTML content다.

따라서 Admin Guides에서 운영자가 우선 확인해야 할 error code는 `VALIDATION_FAILED`와 `GUIDE_CONTENT_INVALID`다.

## 6. 관련 API Tag

| API Tag | 문서 | 관련 error code |
| --- | --- | --- |
| Admin Guides | [admin-guides.md](../tag-guides/admin-guides.md) | `VALIDATION_FAILED`, `GUIDE_CONTENT_INVALID` |
