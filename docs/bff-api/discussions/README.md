# Discussions

> Confluence: 5.2.3.5.5.10.3
> Status: Draft
> Created: 2026-04-28
> Last updated: 2026-04-28

This directory tracks BFF API changes — additions, contract changes, error-code changes, deprecations, removals — as one Markdown file per change. Each file holds the proposal **and** the change-history for a single change, so we don't maintain two parallel logs.

> **Note on language.** This `README.md` is English per project rules (every `README.md` is English-only). Discussion bodies are written in Korean to match the rest of `docs/bff-api/`.

## 1. Filename convention

```text
YYYY-MM-DD-{tag-slug}-{topic-slug}.md
```

- `tag-slug` mirrors the Tag-guide filename slug (e.g. `scan-jobs`, `approval-requests`). For changes that cross Tags use `multiple`; for error-code-only changes use `error-codes`.
- `topic-slug` is a short identifier (`added`, `response-changed`, `deprecated`, `error-code-added`, `field-renamed`, etc.).
- Same-day collisions get suffixed `-2`, `-3`.

The Confluence page title still follows `[yy.mm.dd] {API Tag 또는 주제} 관련 논의`. The mapping is preserved in each file's `Confluence Title:` metadata line — it is **a blockquote metadata line**, not YAML frontmatter.

## 2. Document template

Copy the skeleton below when starting a new discussion (or run `/bff-api-docs new-discussion {tag} {topic}` once the skill ships). The blockquote metadata block at the top is required; section headers are required but their bodies can stay empty until known.

```markdown
# {Title — e.g., Scan Jobs API 추가}

> Confluence Title: [26.04.27] Scan Jobs API 추가 관련 논의
> Created: 2026-04-27
> Last updated: 2026-04-27
> Status: Draft
> Tags: Scan Jobs
> Change type: Added | Changed | Deprecated | Removed | Fixed
> Direction: BE-first | FE-first | Joint
> Related PR: TBD

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

The `Direction:` field captures whether the change lands in backend first (`BE-first`), in frontend first (`FE-first`), or simultaneously (`Joint`). This is what `management-plan.md` §4.6 uses to decide whether the Tag guide should temporarily diverge from production.

## 3. Status lifecycle

`Draft → Reviewing → Accepted → Implemented → Released` (or `Rejected` at any point).
A discussion at `Implemented` or later must have a `Related PR:` URL — the skill enforces this.

## 4. Index

| Date | Title | Tags | Status | File |
| --- | --- | --- | --- | --- |
| _no discussion docs yet_ | | | | |

> The index is rebuilt by `/bff-api-docs index` (separate from `validate`, which only reports). Do not hand-edit this section once the skill is in place.
