# API 관련 논의

> Confluence: 5.2.3.5.5.10.3
> 대상: BFF API의 변경 제안과 변경 이력을 함께 기록하는 공간

이 디렉터리는 BFF API의 변경, 추가, 폐기, 응답 구조 변경, 에러 코드 변경 등에 대한 논의 기록을 모은다.
변경 제안과 변경 이력을 따로 관리하지 않고 한 문서에서 상태 전이로 관리한다.

## 1. 파일명 규칙

```text
YYYY-MM-DD-{tag-slug}-{topic-slug}.md
```

- `tag-slug`: 관련 Tag 가이드 파일명에 쓰인 슬러그 (예: `scan-jobs`, `error-codes`, `multiple` — Tag 여러 개에 걸친 경우)
- `topic-slug`: 짧은 주제 식별자 (`added`, `response-changed`, `deprecated`, `error-code-added` 등)
- 같은 날짜에 같은 주제가 여러 개면 끝에 `-2`, `-3`을 붙인다.

Confluence 페이지 제목은 별도로 `[yy.mm.dd] {API Tag 또는 주제} 관련 논의` 규칙을 따른다.
파일 본문 frontmatter의 `confluenceTitle`로 매핑을 보존한다.

## 2. 작성 템플릿

새 논의를 시작할 때는 아래 골격을 복사해 사용한다.
스킬을 통해 생성하는 경우 `/bff-api-docs new-discussion` 으로 자동 생성된다.

```markdown
# {제목 — 예: Scan Jobs API 추가}

> Confluence Title: [26.04.27] Scan Jobs API 추가 관련 논의
> 작성일: 2026-04-27
> 마지막 수정일: 2026-04-27
> 상태: Draft
> 대상 Tag: Scan Jobs
> 변경 유형: Added | Changed | Deprecated | Removed | Fixed
> 관련 PR: TBD

## 1. 논의 배경
## 2. 논의 내용
## 3. 관련 BFF Swagger 위치
- Tag 가이드: ../tag-guides/scan-jobs.md
- BFF Swagger 섹션 상태: Draft / Reviewing / Accepted / Implemented / Released

## 4. 영향
- 화면 / 사용 주체:
- enum/state 영향:
- error code 영향:

## 5. 결정 사항
## 6. 후속 작업
## 7. 관련 링크
```

## 3. 인덱스

| 날짜 | 제목 | Tag | 상태 | 파일 |
| --- | --- | --- | --- | --- |
| _아직 논의 문서 없음_ | | | | |

> 인덱스는 `/bff-api-docs validate` 또는 `/bff-api-docs index` 명령이 자동 갱신한다.
