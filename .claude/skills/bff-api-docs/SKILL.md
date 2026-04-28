---
name: bff-api-docs
description: Routes BFF API documentation changes (Tag guides, error codes, discussions, status transitions) to the right files and rules under docs/bff-api/. Use when the user wants to add/change/deprecate a BFF Tag, an error code, or update doc status. The full contract lives in docs/bff-api/management-plan.md; this skill is the routing map.
user_invocable: true
---

# /bff-api-docs

When the user signals a BFF API documentation change, use this skill to (1) figure out which files to touch and (2) follow the rules from [docs/bff-api/management-plan.md](../../../docs/bff-api/management-plan.md).

The plan is the contract. This skill is the routing map. When the two disagree, the plan wins — fix the skill.

## When to invoke

Apply this skill when the user mentions:

- adding / changing / deprecating / removing a BFF API endpoint, Tag, or response field
- adding / changing / deprecating / removing an error code
- moving the status of a Tag guide or discussion (Draft / Reviewing / Accepted / Implemented / Released / Rejected / Deprecated)
- starting a BFF API change discussion
- anything under `docs/bff-api/`

The user does **not** need to know command names. Map the natural-language request to the relevant row of "Request routing" below and proceed conversationally.

## Files map

```
docs/bff-api/
├── README.md            entry point (English)
├── strategy.md          why this structure exists (Korean) — rarely edited for routine changes
├── management-plan.md   how it's operated (Korean) — the contract, read sections cited below for any detail
├── tag-guides/{slug}.md per-Tag content + inline Swagger sample
│   _TEMPLATE.md         skeleton for new tag guides
├── catalogs/error-codes.md   cross-Tag error code catalog
└── discussions/         per-change discussion log
    README.md            English entry; index
    TEMPLATE.md          Korean discussion skeleton
```

## Request routing

| User's intent | Files to touch | Read first |
| --- | --- | --- |
| Add a new API Tag | `tag-guides/{slug}.md` (from `_TEMPLATE.md`), `discussions/{date}-{slug}-added.md` (from `TEMPLATE.md`), README Tag-index row | plan §4.1 |
| Change an existing Tag's contract | `tag-guides/{slug}.md` (inline YAML, API list, response notes, history row), `discussions/{date}-{slug}-{topic}.md` | plan §4.2 |
| Move a Tag-guide status | `tag-guides/{slug}.md` `> 상태:` line + `> 마지막 수정일:` + history row | plan §4.6 |
| Add an error code | `catalogs/error-codes.md` row, `discussions/{date}-error-codes-{code-slug}-added.md`, sentinel-managed table in each affected tag guide | plan §4.4 |
| Change / deprecate / remove an error code | `catalogs/error-codes.md` cell(s), discussion file, sentinel block in affected tag guides | plan §4.4.2 |
| Open a generic API change discussion | `discussions/{date}-{tag}-{topic}.md` | plan §4.3 |
| Validate current docs | (no writes — run plan §5 checks against affected files) | plan §5 |
| Refresh a tag guide's inline Swagger from a source | `tag-guides/{slug}.md` `## 2. BFF Swagger` and `## 3. API 목록` | plan §4.2 |

When the request doesn't match any row cleanly, read the plan from §4 onward and ask the user one clarifying question.

## Hard rules (don't break)

These are silent foot-guns. Verify before writing.

1. **Sentinel block protection.** In tag guides, the area between
   `<!-- BFF-API-DOCS:BEGIN error-code-table (managed by /bff-api-docs sync-error-refs) -->`
   and `<!-- BFF-API-DOCS:END error-code-table -->`
   is regenerated from the catalog. **Never hand-edit inside it.** If a guide doesn't have the block yet, insert an empty pair under `## ... 관련 error code` (create the section if missing) before the first regeneration.

2. **Catalog row schema** (`catalogs/error-codes.md` `## 4. Error Code 목록`).
   Eleven columns, fixed header order:
   `코드 | HTTP status | 의미 | 발생 조건 | 재시도 가능 여부 | 사용자 액션 | 운영자 확인 포인트 | 관련 API Tag | 관련 API | 폐기 예정 여부 | 추가일 / 변경일`.
   `코드` cell is a backtick-quoted UPPER_SNAKE identifier (`[A-Z][A-Z0-9_]+`).
   `폐기 예정 여부` starts with `예` or `아니오`. If `예`, the same cell holds `대체: NEW_CODE` or `EOL: YYYY-MM-DD` (or both).
   `관련 API Tag` cells store **display names** (e.g. `Admin Guides`); tag guides use **slugs** in filenames. When matching, strip backticks and outer whitespace from both sides; split comma-separated cells.

3. **Metadata scope.** Operational artifacts (`tag-guides/*`, `discussions/*` excluding README/TEMPLATE, `catalogs/*`) use Korean keys (`> 상태:`, `> 작성일:`, `> 마지막 수정일:`, plus the per-kind required keys in plan §3.1). Governance docs (every `README.md`, `strategy.md`, `management-plan.md`) use English keys (`Status`, `Created`, `Last updated`, `Confluence`). **Mixing the two scopes in one file is invalid.**

4. **English-only paths.** Per `CLAUDE.md` no-go #5: every `README.md` / `CLAUDE.md` / `AGENTS.md`, plus `.claude/skills/**`, `.claude/agents/**`, `.claude/hooks/**`, `docs/adr/**`. Inside `docs/bff-api/`, only the README files are English; everything else is Korean.

5. **Status lifecycle.** `Draft → Reviewing → Accepted → Implemented → Released`, with `Rejected` allowed from any non-`Released` state and `Deprecated` allowed from `Released`. `Released` requires a non-empty `> 관련 PR:` URL. Out-of-order transitions need an explicit reason from the user before applying.

6. **Discussion required.** For `Added` / `Changed` / `Deprecated` / `Removed`, create the discussion file *before or alongside* the artifact edit. `Guidance Updated` (error-code action/operator-check copy only) may skip the discussion. Filename: `YYYY-MM-DD-{tag-slug}-{topic-slug}.md` where `tag-slug` is `error-codes`, `multiple`, or an existing tag-guide slug; `topic-slug` is lowercase-hyphenated. For error codes, slugify `CODE.toLowerCase().replace(/_/g,'-')` (so `VALIDATION_FAILED` → `validation-failed`).

## How to handle common requests

For each request, the flow is: (1) resolve target → (2) confirm missing args one at a time → (3) show a Plan + Diff preview → (4) wait for the user's confirmation, then write with Edit/Write.

### "Tag {Name} 상태 {state}로 바꿔줘"

1. Resolve `{Name}` to a tag-guide file. If ambiguous, list candidates.
2. Read current `> 상태:`. If the requested transition is not one step forward (or `Rejected`/`Deprecated`), ask whether to allow the jump and why.
3. If new state is `Released` and `> 관련 PR:` is empty, ask for the URL and update that line too.
4. Diff: status line, `마지막 수정일`, one row appended to `## ... 변경 / 논의 이력` (`날짜 / 새 상태 / 변경 유형 / 요약 / 관련 논의`). Ask the user for the change-type if not obvious from context.

### "에러 코드 {CODE} 추가하자 / 바뀌었어"

1. Read `catalogs/error-codes.md`. Existing row → `Changed`; absent → `Added`.
2. Ask for any missing 11-column values that aren't trivial defaults (`의미`, `발생 조건`, `사용자 액션`, `운영자 확인 포인트`, `관련 API Tag`, `관련 API`). Default `폐기 예정 여부 = 아니오`, `추가일 / 변경일 = today`.
3. Create the discussion file from `discussions/TEMPLATE.md` with `대상 Tag: error-codes`, `변경 유형: Added` (or `Changed`), and ask the user for `변경 방향` (`BE-first` / `FE-first` / `Joint`).
4. Update the catalog row.
5. List tag guides resolved from `관련 API Tag`. For each: regenerate the sentinel-managed table from the catalog (see Hard rule #1). If a guide lacks the sentinel block, insert an empty pair first.
6. Show all diffs together; apply on user confirmation.

### "에러 코드 {CODE} 폐기 / 제거"

- **Deprecate**: set the row's `폐기 예정 여부` cell to `예 — 대체: NEW_CODE` or `예 — EOL: YYYY-MM-DD` (ask which; at least one). Bump `변경일`. Discussion file `-deprecated.md`. Regenerate sentinel tables — they will show the deprecation marker.
- **Remove**: refuse if any tag guide still has a backtick reference to `{CODE}` outside the sentinel block — ask the user to clean those first. Then move the row into a `## 7. Removed codes` section (create if absent), preserving cells. Discussion file `-removed.md` with the BE release-note URL. Regenerate sentinel tables.

### "Tag {Name} 추가하자"

1. Confirm the slug (lowercase-hyphenated, must not collide with an existing file).
2. Create `discussions/{today}-{slug}-added.md` first.
3. Copy `tag-guides/_TEMPLATE.md` to `tag-guides/{slug}.md`. Substitute `{Tag display name}` and `{today}`.
4. The inline Swagger is empty by default. Ask the user: do they have a swagger source path now (apply the swagger-refresh recipe below), or fill it later?
5. Append a row to README's Tag-index table.
6. Show all diffs; apply on confirmation.

### "Tag {Name} 응답 / API 바뀌었어"

1. Open `tag-guides/{slug}.md`. Update inline YAML (`## 2. BFF Swagger`), API-list table (`## 3.`), response notes (`## 4.`) per the user's description. Don't paraphrase Swagger schema into prose — the YAML is the contract.
2. Create `discussions/{today}-{slug}-{topic}.md` (`변경 유형: Changed`).
3. Append a `## ... 변경 / 논의 이력` row in the tag guide.

### "검증해줘" / "valid한지 봐줘"

Run plan §5 checks against affected files (or all of `docs/bff-api/` if the user didn't scope). **No writes.** Report Fail and Warn separately. The full check list is plan §5.1 – §5.6; key items:

- §5.1 metadata keys & enums (per scope — operational vs governance)
- §5.2 inline-YAML self-consistency: tags match the file, API-list table matches paths, no unreferenced/dangling `$ref`
- §5.3 catalog 11-column schema, code regex, deprecation cell, `관련 API`/`관련 API Tag` resolves
- §5.4 discussion filename pattern, `대상 Tag` slugs exist, `변경 방향` valid
- §5.5 README Tag-index and discussions index match the filesystem

### "Tag {Name} swagger 다시 뽑아줘"

1. Read the user-supplied swagger source (path).
2. Filter `paths` whose any operation tag matches the guide's `> API Tag:` value.
3. Compute the transitive `$ref` closure. Only `#/components/schemas/{X}` refs are followed; refuse external refs (`http://`, other-file refs) and non-schema component refs with a clear message. BFS through `properties`, `items`, `allOf`, `oneOf`, `anyOf`, `additionalProperties`.
4. Rewrite the YAML block deterministically (sorted keys) under `## 2. BFF Swagger`.
5. Rebuild `## 3. API 목록` from the same `(method, path)` set, preserving the `상태` column for paths that already had a row.
6. Show the diff; apply on confirmation.

## How to ask for missing info

- **One question at a time.** Don't pile multiple questions in one message.
- **Always include selectable options.** For slug args, list existing tag-guide slugs. For state args, list valid transitions from the current state. For change-type, list `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` and pre-select the most likely.
- **Default and confirm**, don't open-ended ask. "지난 변경 유형이 Added였어요. 이번도 Added 맞나요?" beats "변경 유형이 뭐예요?".
- **Inferable args don't need a question.** If today's date is needed, just use it. If the catalog already lists `관련 API Tag` for this code, don't ask again.

## Confirm-before-write

Before any Edit/Write, show:

```
## Plan
- create  docs/bff-api/discussions/2026-05-01-error-codes-validation-failed-added.md
- edit    docs/bff-api/catalogs/error-codes.md       (1 row appended)
- edit    docs/bff-api/tag-guides/admin-guides.md    (sentinel table regenerated)

## Diff preview
{unified diff per file}
```

Then wait. On user confirmation (`응` / `그래` / `적용해` / `yes`), call Edit/Write. For multi-file changes, reiterate the file list in the confirmation prompt so nothing is silently included.

If a write would cause a Fail-class violation of any Hard rule above (e.g. mixing metadata scopes, breaking the sentinel block, violating the catalog schema), refuse the write and tell the user what to fix. There is no override flag for Fail-class.

## Out of scope

- Does not push, commit, or open PRs. Use `/pr` and git for that.
- Does not parse Confluence directly — Confluence numbering lives only in `> Confluence:` metadata.
- Does not fabricate enum/state catalog content; that doc has not been bootstrapped.

## Single source of truth

When this skill and [docs/bff-api/management-plan.md](../../../docs/bff-api/management-plan.md) disagree, the plan wins. Update the plan first, then this skill.
