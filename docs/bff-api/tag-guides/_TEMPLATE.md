# {Tag display name}

> Confluence: TBD
> 상태: Draft
> API Tag: `{Tag display name}`
> 담당: TBD
> 작성일: {today}
> 마지막 수정일: {today}
> 관련 PR: TBD

> 사용법: `/bff-api-docs new-tag-guide {slug}` 이 이 파일을 읽어 새 Tag 가이드를 생성한다. 이 파일을 직접 편집하지 말고, 생성된 가이드를 편집한다.

## 1. 목적

(이 Tag가 다루는 도메인을 한두 줄로.)

## 2. BFF Swagger

> Swagger 상태: Draft

```yaml
openapi: 3.0.1
info:
  title: BFF API - {Tag display name}
  version: v0
tags:
- name: {Tag display name}
paths: {}
components:
  schemas: {}
```

## 3. API 목록

| Method | Path | 설명 | 상태 |
| --- | --- | --- | --- |

## 4. Response 설명

(Swagger schema 복사 금지. 운영 의미·null/empty 해석·화면 영향만.)

## 5. 주요 동작 규칙

## 6. 관련 enum / state

(필요 시 `../catalogs/...` 링크.)

## 7. 관련 error code

<!-- BFF-API-DOCS:BEGIN error-code-table (managed by /bff-api-docs sync-error-refs) -->
| 코드 | 의미 | 발생 API |
| --- | --- | --- |
<!-- BFF-API-DOCS:END error-code-table -->

## 8. 변경 / 논의 이력

| 날짜 | 상태 | 변경 유형 | 요약 | 관련 논의 |
| --- | --- | --- | --- | --- |
