---
name: bff-api-docs
description: Validate and author docs under docs/bff-api/. Implements the commands defined in docs/bff-api/management-plan.md §6 (validate, new-tag-guide, new-discussion, update-status, error-code, sync-error-refs, extract-tag, index). Every write defaults to dry-run; --apply is required to mutate files.
user_invocable: true
---

# /bff-api-docs

Maintain `docs/bff-api/` per the operational plan. The plan is the contract; this skill executes it.

Single source of truth for *what* the rules are: [docs/bff-api/management-plan.md](../../../docs/bff-api/management-plan.md). When the plan and this skill disagree, **the plan wins** — fix the skill, not the plan.

This file is English-only (`.claude/skills/**` per `CLAUDE.md` no-go rule). Korean output templates live under `docs/bff-api/` and are read at runtime, not inlined here:

- Tag guide skeleton — `docs/bff-api/tag-guides/_TEMPLATE.md`
- Discussion skeleton — `docs/bff-api/discussions/TEMPLATE.md`

The skill still references Korean **identifiers** in backticks (metadata keys like `> 상태:`, catalog column names like `폐기 예정 여부`, section headings like `## 2. BFF Swagger`). These are literal strings the skill must match against in operational docs — they cannot be paraphrased into English without breaking the contract defined by [management-plan.md §3.1](../../../docs/bff-api/management-plan.md). All prose, instructions, and command descriptions are English.

## Invocation

```text
/bff-api-docs <command> [args] [--apply] [--force]
```

| Command | Implements | Default mode |
| --- | --- | --- |
| `validate` | plan §5 | read-only |
| `new-tag-guide {slug}` | plan §4.1 W1 | dry-run unless `--apply` |
| `new-discussion {tag} {topic}` | plan §4.3 W3 | dry-run unless `--apply` |
| `update-status {file} {state} {change-type}` | plan §4.6 W5 | dry-run unless `--apply` |
| `error-code {add\|change\|guidance\|deprecate\|remove} {CODE}` | plan §4.4 W4 | dry-run unless `--apply` |
| `sync-error-refs [--init] [{file}]` | plan §4.4.5 | dry-run unless `--apply` |
| `extract-tag {slug} <swagger-source>` | plan §6 | dry-run unless `--apply` |
| `index` | plan §5.5 | dry-run unless `--apply` |

`--force` is only honored for `index` and is a no-op everywhere else.

## Output contract (every command)

1. **Plan**: bullet list of files that *would* be created / edited / left alone.
2. **Diff preview**: unified diff or before/after snippet for each touched file. For new files, show the full content.
3. **Footer**: `Dry-run. Re-run with --apply to write.` or `Applied. {N} file(s) written.`.
4. **Self-test gate** (see §9): before any write, render the resulting content in memory and run every Fail-class check from plan §5.1 / §5.3 / §5.4 against it. Refuse the write if any Fail trips. No `--force` for Fail-class.

## Conventions used by every command

### Path resolution
All paths are repo-root relative. Run from the repo root or a worktree root. Use Read/Edit/Write for file IO; use Bash only for `git`, `grep`, `find`, and `python3` recipes.

### Display name vs slug
The catalog stores **display names** in its `관련 API Tag` cell (e.g. `Admin Guides`). Tag-guide files use **slugs** in filenames (`admin-guides.md`). The skill resolves slug ↔ display name by reading each tag guide's `> API Tag:` metadata. A cell may hold a comma-separated list — split on `,`, trim whitespace, resolve each.

### Metadata parsing
The blockquote metadata block is the consecutive `> Key: Value` lines after the H1. Use:

```python
import re, pathlib
def meta(path):
    out = {}
    for line in pathlib.Path(path).read_text().splitlines()[1:]:
        m = re.match(r"^>\s+([^:]+?):\s*(.*)$", line)
        if m:
            out[m.group(1).strip()] = m.group(2).strip()
        elif line.strip() and not line.startswith(">"):
            break
    return out
```

This is "blockquote metadata", not YAML frontmatter — do not introduce `---` fences.

### Markdown table parsing
Treat any `|`-pipe table as: header row (separators `---`) then data rows. Strip leading/trailing pipes, split on `|`, strip cells. Empty cells are empty strings, not missing.

### Inline YAML extraction
The first ```` ```yaml ```` … ```` ``` ```` block under the `## 2. BFF Swagger` heading is the Tag's contract sample. Parse with `python3 -c 'import yaml,sys,json;print(json.dumps(yaml.safe_load(sys.stdin.read())))'`.

---

## 1. `validate`

Read-only. Runs plan §5.1 – §5.6 in order, separates Fail / Warn, lists locations.

### 1.1 Discovery

```bash
TAG_GUIDES=$(ls docs/bff-api/tag-guides/*.md 2>/dev/null | grep -v '/_TEMPLATE.md$')
DISCUSSIONS=$(ls docs/bff-api/discussions/*.md 2>/dev/null | grep -vE '/(README|TEMPLATE)\.md$')
CATALOG=docs/bff-api/catalogs/error-codes.md
GOVERNANCE="docs/bff-api/README.md docs/bff-api/strategy.md docs/bff-api/management-plan.md docs/bff-api/discussions/README.md"
ALLOWLIST=docs/bff-api/.error-code-allowlist  # optional
```

### 1.2 Plan §5.1 — Metadata (Fail)

For every file, run the metadata parser (see "Conventions"), then enforce per kind:

- **Operational** files (`tag-guides/*` excluding `_TEMPLATE.md`, `discussions/*` excluding README/TEMPLATE, `catalogs/*`):
  - keys present: `Confluence`, `상태`, `작성일`, `마지막 수정일`
  - tag guides also: `API Tag`, `담당`
  - discussions also: `Confluence Title`, `대상 Tag`, `변경 유형`, `변경 방향`
  - `상태` ∈ {`Draft`, `Reviewing`, `Accepted`, `Implemented`, `Released`, `Deprecated`, `Rejected`}
  - any English governance keys present (`Status`, `Created`, `Last updated`) → Fail (mixing scopes)
  - tag guide `상태=Released` ⇒ `관련 PR` is non-empty URL
  - discussion `상태 ∈ {Implemented, Released}` ⇒ `관련 PR` is non-empty URL
- **Governance** files (`README.md` ×2, `strategy.md`, `management-plan.md`):
  - keys present: `Confluence`, `Status`, `Created`, `Last updated`
  - `Status` ∈ {`Draft`, `Proposed`, `Approved`, `Superseded`}
  - any Korean operational keys present (`상태`, `작성일`, `마지막 수정일`) → Fail

### 1.3 Plan §5.2 — Self-consistency lint (Warn)

For each tag guide: extract inline YAML (see Conventions). Then:

1. Parse YAML. Invalid YAML → Warn (single finding, stop further §5.2 checks for that file).
2. `tags[0].name` and every `paths.{path}.{method}.tags[0]` equal the file's `> API Tag:` value.
3. Extract the `## 3. API 목록` table. Compute set of `(METHOD upper, path)` pairs. Compute the same set from YAML `paths`. Symmetric diff non-empty → Warn (list each missing pair on either side).
4. Collect every `$ref: '#/components/schemas/{X}'` across paths. Compute reachable closure (recurse into nested objects/arrays/oneOf/anyOf). Schemas in `components.schemas` not reachable → Warn (over-broad extraction). Refs to schemas absent from `components.schemas` → Warn (dangling).
5. For each `(METHOD, path)`, search `docs/swagger/*.yaml` for the same path under any method. Not found anywhere → Warn (not Fail; BFF-only paths exist).

### 1.4 Plan §5.3 — Catalog consistency (Fail)

Parse the catalog table at `## 4. Error Code 목록`. Required column count = 11; header sequence:

```
코드 | HTTP status | 의미 | 발생 조건 | 재시도 가능 여부 | 사용자 액션 | 운영자 확인 포인트 | 관련 API Tag | 관련 API | 폐기 예정 여부 | 추가일 / 변경일
```

For every data row:

- All 11 cells non-empty.
- `코드` cell content matches the regex `^\`[A-Z][A-Z0-9_]+\`$` (i.e. a backtick-quoted identifier).
- `추가일 / 변경일` matches `^\d{4}-\d{2}-\d{2}( / \d{4}-\d{2}-\d{2})?$`.
- `폐기 예정 여부` starts with `예` or `아니오`. If `예`, the cell contains either `대체:` or `EOL:` (or both).
- Each comma-separated `관련 API Tag` value resolves to an existing tag guide (display-name → slug map; see Conventions).
- Each line in `관련 API` matches `^[A-Z]+ /\S+$` and the (METHOD, path) pair exists in the inline YAML of every tag guide that this row's `관련 API Tag` resolves to.

For every tag guide body, extract every backticked uppercase identifier matching `[A-Z][A-Z0-9_]+`. Each must be a row in the catalog OR a line in `.error-code-allowlist` (one identifier per line, `#`-prefixed comments allowed). Otherwise Fail.

### 1.5 Plan §5.4 — Discussion rules (Fail)

For each `discussions/*.md` (excluding README/TEMPLATE):

- Filename matches `^\d{4}-\d{2}-\d{2}-[a-z0-9-]+-[a-z0-9-]+(-\d+)?\.md$`.
- `대상 Tag` slugs each exist as a tag guide OR are reserved (`error-codes`, `multiple`).
- `변경 방향` ∈ {`BE-first`, `FE-first`, `Joint`}.
- `상태 ∈ {Implemented, Released}` ⇒ `관련 PR` non-empty.
- Discussion that has `대상 Tag` listing 5+ slugs → Warn (plan §4.5.2 ack rule reminder).

### 1.6 Plan §5.5 — Index sync (Warn)

- `docs/bff-api/README.md` Tag table — actual rows must equal expected rows (one per tag-guide file, excluding `_TEMPLATE.md`).
- `docs/bff-api/discussions/README.md` index table — actual rows must equal expected rows (one per discussion file, excluding README/TEMPLATE).

Auto-fix is `index` (§8); validate only reports.

### 1.7 Plan §5.6 — Upstream drift

Phase 2 only. If `docs/bff-api/.upstream/swagger.yaml` does not exist, skip silently. If it exists, perform plan §5.6 checks (Warn): set diff of `(METHOD, path)` per Tag, and deep-diff of request/response schemas for each shared pair. Implementation deferred until the snapshot exists.

### 1.8 Output template

```text
## /bff-api-docs validate

### Fail (M)
- §5.1 docs/bff-api/tag-guides/foo.md:1 — missing `> 담당:`
- §5.3 docs/bff-api/tag-guides/bar.md — code `WHATEVER_FOO` not in catalog or allowlist
- §5.4 docs/bff-api/discussions/2026-04-29-scan-jobs-...md — `상태=Released` but `관련 PR` empty

### Warn (N)
- §5.2 docs/bff-api/tag-guides/scan-jobs.md — 12 unreferenced component schemas
- §5.5 docs/bff-api/README.md — Tag index missing row for `services`

### OK
- §5.4 — 0 discussions
```

When invoked from another `/bff-api-docs` write command via the §9 self-test, only the affected files are scanned, and only the Fail categories are reported.

---

## 2. `new-tag-guide {slug}`

1. Validate `slug` matches `^[a-z0-9-]+$` and `docs/bff-api/tag-guides/{slug}.md` does not exist.
2. Read `docs/bff-api/tag-guides/_TEMPLATE.md`. Substitute `{Tag display name}` (default = slug → Title Case, user can override on `--apply`) and `{today}` (`YYYY-MM-DD`).
3. Render in memory. Run §9 self-test on rendered content.
4. Plan also includes: appending one row to `docs/bff-api/README.md` Tag index table (delegate logic to `index` §8 — preview the row diff alongside).
5. Advise user (in the output, not as a separate write) to:
   - Run `/bff-api-docs new-discussion {slug} added` first if not already (plan §4.1 step 2).
   - Run `/bff-api-docs extract-tag {slug} <swagger-source>` after to populate the inline YAML.

`--apply` writes both files.

---

## 3. `new-discussion {tag} {topic}`

1. Validate `tag` is an existing tag-guide slug, or one of the reserved `multiple` / `error-codes`. Validate `topic` matches `^[a-z0-9-]+$`.
2. Compute filename `docs/bff-api/discussions/$(date +%Y-%m-%d)-{tag}-{topic}.md`. If the same name exists, suffix `-2`, `-3`, etc.
3. Read `docs/bff-api/discussions/TEMPLATE.md`. Substitute today's date, derive `Confluence Title: [yy.mm.dd] {tag-display} 관련 논의` from today's date and the resolved tag display name. Set `대상 Tag: {tag}`. Leave `변경 유형`, `변경 방향`, `담당`, `관련 PR` as the template's placeholder values.
4. Run §9 self-test.
5. Plan also includes: appending one row to `docs/bff-api/discussions/README.md` index table (delegate to `index`).

---

## 4. `update-status {file} {state} {change-type}`

`change-type` is required (no inference). Allowed values: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`.

1. Validate `state` is in the operational enum. Governance docs are not editable by this command.
2. Validate the requested transition is allowed:
   `Draft → Reviewing → Accepted → Implemented → Released`, with `Rejected` allowed from any non-`Released` state and `Deprecated` allowed from `Released`. Other jumps require `--force` (warn-only).
3. Replace `> 상태:` value. Update `> 마지막 수정일:` to today.
4. Append a row to the file's `## ... 변경 / 논의 이력` table: `today | {new state} | {change-type} | — | —`. Refuse if the table is missing — that means the doc lacks the required structure, and we will not synthesize one.
5. If `state == Released`, refuse unless `> 관련 PR:` is a non-empty URL.
6. Special case: if previous state was `Implemented` and new state is `Rejected`, also append a `Reverted` row to mark rollback (plan §4.5.1).

---

## 5. `error-code {sub} {CODE}`

`{CODE}` matches `^[A-Z][A-Z0-9_]+$`. Catalog file: `docs/bff-api/catalogs/error-codes.md`, table at `## 4. Error Code 목록`, 11 columns.

| Sub | Catalog effect | Discussion effect | Affected tag guides |
| --- | --- | --- | --- |
| `add` | Append a row. All 11 cells non-empty (interactively prompt). `폐기 예정 여부` defaults to `아니오`. `추가일 / 변경일` defaults to today. | Create `discussions/{today}-error-codes-{code}-added.md` from TEMPLATE. `대상 Tag: error-codes`. `변경 유형: Added`. Ask user for `변경 방향`. | List the tag guides resolved from `관련 API Tag`. Advise running `sync-error-refs --apply` after. |
| `change` | Edit specified cell(s). Bump `변경일` half of `추가일 / 변경일`. Quote previous values into the discussion. | `…-{code}-changed.md`. | Same as `add` — sync afterwards. |
| `guidance` | Edit `사용자 액션` and/or `운영자 확인 포인트` only. Bump `변경일`. | Discussion optional — ask user (default skip). | None — guidance updates do not change the contract. |
| `deprecate` | Set `폐기 예정 여부` cell to `예 — 대체: NEW_CODE` or `예 — EOL: YYYY-MM-DD` (at least one). Bump `변경일`. | `…-{code}-deprecated.md`. | Sync afterwards. The deprecated row's row in tag-guide sentinel tables will display the deprecation marker (sync handles it). |
| `remove` | Move the row to a `## 7. Removed codes` section (create if absent), preserving the row contents. | `…-{code}-removed.md` with the BE release-note URL. | Refuse if any tag guide still has a backtick reference to `{CODE}` outside the sentinel block; user must remove those first. Sync afterwards. |

Tag guide annotation propagation is the responsibility of `sync-error-refs`, not this command — the user runs sync explicitly so they see the diff.

---

## 6. `sync-error-refs [--init] [{file}]`

Per plan §4.4.5. Operates on tag guides only.

### Sentinel parsing

Exact strings (do not paraphrase):

```text
<!-- BFF-API-DOCS:BEGIN error-code-table (managed by /bff-api-docs sync-error-refs) -->
... managed content ...
<!-- BFF-API-DOCS:END error-code-table -->
```

The managed region is everything between (exclusive) the BEGIN line and the END line. Detect with regex matching the literal markers; do not trim trailing comments inside the markers.

### Without `--init`

For each tag guide (or just `{file}`):

1. Locate the BEGIN/END pair. If absent → emit `no managed block — run with --init first` and skip.
2. Inspect the managed region. Allowed content: a single markdown table whose header is `| 코드 | 의미 | 발생 API |` (separator row, then 0+ data rows) plus blank lines. Anything else → refuse with `human-edited content detected inside managed block`. No write even with `--apply`.
3. Build the new table from the catalog: every row whose `관련 API Tag` resolves (display-name → slug; comma split) to this guide's slug. For each match:
   - `코드` ← catalog `코드`
   - `의미` ← catalog `의미`
   - `발생 API` ← from catalog `관련 API`, the `METHOD path` lines whose path appears in this guide's inline YAML (filter the catalog's list down to the relevant subset)
   - If `폐기 예정 여부` starts with `예`, append ` (deprecated)` to the `의미` cell, and if a `대체:` is set, also append ` → REPLACEMENT_CODE`.
4. Replace the managed region. Diff-preview. `--apply` to write.

### With `--init`

For each tag guide whose sentinel block is missing:

1. Find a `## ... 관련 error code` heading. If found, insert an empty sentinel block (header row + separator + zero data rows) immediately under it.
2. If no such heading exists, append `## 7. 관련 error code` plus an empty sentinel block at the end of the file (above `## ... 변경 / 논의 이력` if present, else at EOF).
3. Diff-preview. `--apply` to write.

`--init` does not regenerate tables. After `--init --apply`, run a normal `sync-error-refs` to populate.

---

## 7. `extract-tag {slug} <swagger-source>`

`<swagger-source>` is a path to a swagger YAML or JSON file.

### `$ref` closure rules

- Only `#/components/schemas/{NAME}` refs are followed. Other component types (`parameters`, `responses`, `requestBodies`, `securitySchemes`, …) are inlined-only — if a path uses them, fail with `unsupported $ref kind: {ref}`.
- External refs (`http://...`, `./other.yaml#/...`) → fail with `external $ref not supported`.
- Closure is computed transitively: BFS from the union of refs in the chosen paths' request/response bodies, parameters, examples; visit each schema once; recurse into `properties`, `items`, `allOf`, `oneOf`, `anyOf`, `additionalProperties`. Stop at non-ref leaves.

### Steps

1. Parse the source. Resolve the tag display name from `docs/bff-api/tag-guides/{slug}.md` (read `> API Tag:`).
2. Filter `paths` to those whose any operation has the tag (in `tags[]`).
3. Compute the schema closure (rules above). Drop everything else from `components`.
4. Render a deterministic YAML block (sort keys, stable order) and replace the existing inline YAML in `## 2. BFF Swagger`.
5. Rebuild `## 3. API 목록` from the same `(method, path)` set: one row per operation with `Method | Path | summary | (preserved 상태 from prior table; default `Draft`)`.
6. Run §9 self-test on the rendered content. Refuse if §5.2 self-consistency would fail (e.g., the source had unsupported refs).
7. Diff-preview. `--apply` to write.

`--check` is read-only — performs steps 1–5 in memory and reports the diff only.

---

## 8. `index`

Pure read of the filesystem; rewrites the two index sections.

### What is an index region

- `docs/bff-api/README.md` Tag table — the markdown table under `## 2. Tag guides`. Columns: `API Tag` (display name from each guide's `> API Tag:`), `File` (relative `[name](path)`), `Status` (operational enum from `> 상태:`).
- `docs/bff-api/discussions/README.md` index table — under `## 5. Index`. Columns: `Date` (parsed from filename), `Title` (H1 from file), `Tags` (`> 대상 Tag:`), `Status` (`> 상태:`), `File`.

### Rewrite rules

- Sort by filename ascending.
- Always rewrite the entire region between the heading line and the next `##` (or EOF). Preserve heading and any leading paragraph; replace only the table.
- If the existing region contains content that is not a table or a leading paragraph (e.g. ad-hoc bullets, manual cross-references), refuse unless `--force`. With `--force`, the non-table content is moved beneath the regenerated table with a `<!-- moved by /bff-api-docs index -->` marker so nothing is silently lost.

`--apply` to write. Self-test (§9) runs against the rewritten regions.

---

## 9. Self-test before write

For every command that mutates files, run this sequence on the *rendered* content (not the on-disk version) before calling Edit/Write:

1. Render the proposed diff in memory: list of `(path, new-content)` tuples.
2. For each tuple, run the §1.2 metadata checks (treating the new content as the file).
3. For tag guide writes, additionally run §1.3 self-consistency lint and §1.4 catalog consistency on the resulting inline YAML and code references.
4. For catalog writes, run §1.4 row validation on every modified row.
5. For discussion writes, run §1.5.

Any Fail → refuse the write, report the failing checks and the offending file/line. The user fixes inputs and re-runs. There is no `--force` for Fail-class — see "Output contract" #4.

## 10. Out of scope

- Does not push, commit, or open PRs. The user does that with `/pr` or git.
- Does not parse Confluence directly. Confluence numbering lives only in `> Confluence:` metadata.
- Does not generate enum/state catalog content; that doc has not been bootstrapped yet.

When in doubt, read [docs/bff-api/management-plan.md](../../../docs/bff-api/management-plan.md). Update this skill only after the plan is updated.
