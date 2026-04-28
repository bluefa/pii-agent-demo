# Discussions

> Confluence: 5.2.3.5.5.10.3
> Status: Draft
> Created: 2026-04-28
> Last updated: 2026-04-28

This directory tracks BFF API changes — additions, contract changes, error-code changes, deprecations, removals — as one Markdown file per change. Each file holds the proposal **and** the change-history for a single change, so we don't maintain two parallel logs.

> **Note on language.** This `README.md` is English per project rules (every `README.md` is English-only). Discussion document **bodies** are written in Korean to match the rest of `docs/bff-api/`. The Korean skeleton lives in [TEMPLATE.md](./TEMPLATE.md), which is not a README and therefore is allowed to be Korean.

## 1. Filename convention

```text
YYYY-MM-DD-{tag-slug}-{topic-slug}.md
```

- `tag-slug` mirrors the Tag-guide filename slug (e.g. `scan-jobs`, `approval-requests`). For changes that cross Tags use `multiple`; for error-code-only changes use `error-codes`.
- `topic-slug` is a short identifier (`added`, `response-changed`, `deprecated`, `error-code-added`, `field-renamed`, etc.).
- Same-day collisions get suffixed `-2`, `-3`.

The Confluence page title still follows `[yy.mm.dd] {API Tag 또는 주제} 관련 논의`. The mapping is preserved in each file's `Confluence Title:` blockquote metadata line — it is **a blockquote metadata line**, not YAML frontmatter.

## 2. Required metadata

Each discussion's blockquote metadata block at the top must contain the keys defined in [management-plan.md §3](../management-plan.md). The starter file includes all of them. Do not invent new keys here without updating §3 first.

| Key (Korean header) | Required value |
| --- | --- |
| `Confluence` | Confluence page number |
| `Confluence Title` | `[yy.mm.dd] ... 관련 논의` |
| `상태` | `Draft` / `Reviewing` / `Accepted` / `Implemented` / `Released` / `Rejected` |
| `작성일`, `마지막 수정일` | `YYYY-MM-DD` |
| `대상 Tag` | tag-guide slug(s) (comma-separated; or reserved `error-codes` / `multiple`) |
| `변경 유형` | `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` |
| `변경 방향` | `BE-first` / `FE-first` / `Joint` (see [management-plan.md §4.5](../management-plan.md)) |
| `담당` | Owner / team |
| `관련 PR` | URL (required when `상태` is `Implemented` or later) |

## 3. Document skeleton

Use [TEMPLATE.md](./TEMPLATE.md) as the starting point. The skill will eventually copy from there:

```bash
/bff-api-docs new-discussion {tag} {topic}
```

That command:

- Resolves today's date and the `Confluence Title` line
- Pre-fills the metadata block with placeholders matching §3
- Appends a row to this README's index (§5)

## 4. Status lifecycle

`Draft → Reviewing → Accepted → Implemented → Released` (or `Rejected` at any point).
A discussion at `Implemented` or later must have a `관련 PR` URL — the skill enforces this.

## 5. Index

| Date | Title | Tags | Status | File |
| --- | --- | --- | --- | --- |
| _no discussion docs yet_ | | | | |

> The index is rebuilt by `/bff-api-docs index` (separate from `validate`, which only reports). Do not hand-edit this section once the skill is in place.
