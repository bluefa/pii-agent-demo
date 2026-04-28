---
name: bff-api-docs
description: Validate and author docs under docs/bff-api/. Implements the commands defined in docs/bff-api/management-plan.md §6 (validate, new-tag-guide, new-discussion, update-status, error-code, sync-error-refs, extract-tag, index). Every write defaults to dry-run; --apply is required to mutate files.
user_invocable: true
---

# /bff-api-docs

Maintain `docs/bff-api/` per the operational plan. The plan is the contract; this skill executes it.

Single source of truth for *what* the rules are: [docs/bff-api/management-plan.md](../../../docs/bff-api/management-plan.md). When the plan and this skill disagree, **the plan wins** — fix the skill, not the plan.

## Invocation

```text
/bff-api-docs <command> [args] [--apply] [--force]
```

| Command | Implements | Default mode |
| --- | --- | --- |
| `validate` | §5 | read-only |
| `new-tag-guide {slug}` | §4.1 W1 | dry-run unless `--apply` |
| `new-discussion {tag} {topic}` | §4.3 W3 | dry-run unless `--apply` |
| `update-status {file} {state}` | §4.6 W5 | dry-run unless `--apply` |
| `error-code {add\|change\|guidance\|deprecate\|remove} {CODE}` | §4.4 W4 | dry-run unless `--apply` |
| `sync-error-refs [--init] [{file}]` | §4.4.5 | dry-run unless `--apply` |
| `extract-tag {slug} <swagger-source>` | §6 | dry-run unless `--apply` |
| `index` | §5.5 | dry-run unless `--apply` |

`--force` is only honored for `index` and is a no-op everywhere else (use it to overwrite a manually-edited index region).

## Output contract (every command)

1. **Plan**: bullet list of files that *would* be created / edited / left alone.
2. **Diff preview**: unified diff or before/after snippet for each touched file. For new files, show the full content.
3. **Footer**: either
   - `Dry-run. Re-run with --apply to write.` (default), or
   - `Applied. {N} file(s) written.` (when `--apply` was passed).
4. If any **Fail-class** check from §5 trips on the affected files, refuse the write and print the failing checks. The user fixes those first; no `--force` for Fail-class.

## Resolving paths

All paths in this skill are relative to the repo root. Run from the repo root or a worktree root. Use the Read/Edit/Write tools for file IO; use Bash for `git`, `grep`, `find`, and `python3` recipes only.

---

## 1. `validate`

Read-only. Runs every §5 check, separates Fail / Warn, lists locations.

### 1.1 Discovery

```bash
TAG_GUIDES=$(ls docs/bff-api/tag-guides/*.md 2>/dev/null)
DISCUSSIONS=$(ls docs/bff-api/discussions/*.md 2>/dev/null | grep -v 'README.md\|TEMPLATE.md')
CATALOG=docs/bff-api/catalogs/error-codes.md
GOVERNANCE="docs/bff-api/README.md docs/bff-api/strategy.md docs/bff-api/management-plan.md docs/bff-api/discussions/README.md"
```

### 1.2 §5.1 Metadata (Fail)

Parse the blockquote metadata block (consecutive `> Key: Value` lines after H1) for each file with this Python helper, then check the kind-appropriate keys per §3.1 / §3.2:

```python
import re, sys, pathlib
def meta(p):
    txt = pathlib.Path(p).read_text().splitlines()
    out = {}
    for line in txt[1:]:
        m = re.match(r"^>\s+([A-Za-z 가-힣]+):\s*(.*)$", line)
        if m: out[m.group(1).strip()] = m.group(2).strip()
        elif line.strip() and not line.startswith(">"): break
    return out
```

Required keys:

- **Operational** (`tag-guides/*`, `discussions/*` excluding README/TEMPLATE, `catalogs/*`): `Confluence`, `상태`, `작성일`, `마지막 수정일`. Tag guides also: `API Tag`, `담당`. Discussions also: `Confluence Title`, `대상 Tag`, `변경 유형`, `변경 방향`. **Mixing English keys (`Status`, `Created`, …) on these files = Fail.**
- **Governance** (`docs/bff-api/README.md`, `docs/bff-api/strategy.md`, `docs/bff-api/management-plan.md`, `docs/bff-api/discussions/README.md`): `Confluence`, `Status`, `Created`, `Last updated`. **Mixing Korean keys = Fail.**
- `상태` value in the operational enum (`Draft`/`Reviewing`/`Accepted`/`Implemented`/`Released`/`Deprecated`/`Rejected`).
- `Status` value in the governance enum (`Draft`/`Proposed`/`Approved`/`Superseded`).
- Tag guide with `상태: Released` must have `관련 PR` URL. Discussion with `상태: Implemented`/`Released` must have `관련 PR` URL.

### 1.3 §5.2 Self-consistency lint (Warn)

For each tag guide:

1. Extract the first ` ```yaml ` … ` ``` ` block. Parse with `python3 -c "import yaml,sys,json;print(json.dumps(yaml.safe_load(sys.stdin.read())))"`. Fail-warn if not valid YAML.
2. Confirm `tags[0].name` matches the guide's `> API Tag:` value. Confirm every `paths.*.{method}.tags[0]` equals it too.
3. Extract the *API list* table (markdown table whose header is `| Method | Path | …`). Compare its `(method, path)` pairs to YAML `paths.*` keys. Diff in either direction → Warn.
4. Collect all `$ref: '#/components/schemas/X'` occurrences and the `components.schemas.*` keys. Unreferenced schemas → Warn (over-broad extraction). Dangling refs → Warn.
5. Cheap external check: `(method, path)` pairs not present in any `docs/swagger/*.yaml` → Warn. Not Fail because BFF-only paths exist legitimately.

### 1.4 §5.3 Catalog consistency (Fail)

```bash
ALLOWLIST=docs/bff-api/.error-code-allowlist
CODE_RE='`[A-Z][A-Z0-9_]+`'
```

- For each tag guide, `grep -oE "$CODE_RE"` and dedupe. Each candidate must be a code in the catalog table OR in the allowlist file (one identifier per line, `#` comments). Otherwise Fail.
- Catalog row's `관련 API Tag` slug must exist as a `tag-guides/*.md` file.
- Catalog row's `관련 API` cell — for each `METHOD path` line, that pair must exist in the named guide's inline YAML `paths`.
- Each catalog row's `폐기 예정 여부` cell starts with `예` or `아니오`. If `예`, must contain `대체:` or `EOL:` in the same cell.
- Each catalog row's `코드` cell must be a backticked identifier matching `[A-Z][A-Z0-9_]+`.

### 1.5 §5.4 Discussion rules (Fail)

- Filename `^\d{4}-\d{2}-\d{2}-[a-z0-9-]+-[a-z0-9-]+\.md$`.
- `> 대상 Tag:` slugs all exist as `tag-guides/*.md`, OR are reserved (`error-codes`, `multiple`).
- `> 변경 방향:` ∈ `BE-first` / `FE-first` / `Joint`.
- `> 상태:` ∈ `Implemented`/`Released` ⇒ `> 관련 PR:` is non-empty.

### 1.6 §5.5 Index sync (Warn)

- `docs/bff-api/README.md` Tag table rows must equal `ls tag-guides/*.md` (slug + status).
- `docs/bff-api/discussions/README.md` index table rows must equal real discussion files.

### 1.7 §5.6 Upstream drift

If `docs/bff-api/.upstream/swagger.yaml` exists, run drift check (Warn). Otherwise skip silently — Phase 2 not yet active.

### 1.8 Output

```text
## /bff-api-docs validate

### Fail (M)
- §5.1 docs/bff-api/tag-guides/foo.md: missing `> 담당:`
- §5.3 docs/bff-api/tag-guides/bar.md: code `WHATEVER_FOO` not in catalog or allowlist

### Warn (N)
- §5.2 docs/bff-api/tag-guides/scan-jobs.md: 12 unreferenced component schemas
- §5.5 docs/bff-api/README.md: Tag index missing row for `services`

### OK
- §5.4 all discussions valid
```

Exit-equivalent: if Fail count > 0, every other `/bff-api-docs` write command in the same session must refuse to write the affected files until they pass.

---

## 2. `new-tag-guide {slug}`

1. Validate `slug` matches `^[a-z0-9-]+$` and the file does not yet exist.
2. Render the template below, filling `{slug}`, `{Tag display name}` (slug → Title Case as default; user can edit afterward), today's date.
3. Print the rendered file as the diff preview.
4. On `--apply`, Write the file and append a row to `docs/bff-api/README.md` Tag table (delegating to `index` for the README update — preview both files in the diff).

Template (do not deviate without updating the plan):

````markdown
# {Tag display name}

> Confluence: TBD
> 상태: Draft
> API Tag: `{Tag display name}`
> 담당: TBD
> 작성일: {today}
> 마지막 수정일: {today}
> 관련 PR: TBD

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
````

The sentinel block is created from the start so `sync-error-refs` runs without `--init`.

---

## 3. `new-discussion {tag} {topic}`

1. Validate `tag` is either an existing tag-guide slug or `multiple` / `error-codes`. Validate `topic` matches `^[a-z0-9-]+$`.
2. Compute filename `docs/bff-api/discussions/$(date +%Y-%m-%d)-{tag}-{topic}.md`. If the same name exists, suffix `-2`, `-3`, etc.
3. Read `docs/bff-api/discussions/TEMPLATE.md`. Fill metadata: today's date, `Confluence Title: [yy.mm.dd] {tag-display} 관련 논의` (derive `yy.mm.dd` from today), `대상 Tag: {tag}`. Leave `변경 유형`, `변경 방향`, `담당`, `관련 PR` as the template's placeholder values for the author to fill.
4. Diff-preview both the new file and the index row that will be added to `docs/bff-api/discussions/README.md` (under §5).
5. On `--apply`, Write the new file and run the index-row insertion.

---

## 4. `update-status {file} {state}`

1. Validate `state` is in the operational enum (governance docs are not updated by this command).
2. Open the file. Find the `> 상태:` line. Replace its value. Update `> 마지막 수정일:` to today.
3. Append a new row to the file's `## 변경 / 논의 이력` table (or `## ... 변경 이력` heading variant) with `today / {state} / {inferred change type} / — / —`. If no such table exists, refuse with a Fail diagnostic — the doc lacks the required structure.
4. If new state is `Released`, refuse unless `> 관련 PR:` is a non-empty URL.
5. Diff preview, then `--apply` to write.

---

## 5. `error-code {sub} {CODE}`

`{CODE}` must match `^[A-Z][A-Z0-9_]+$`. The catalog file is `docs/bff-api/catalogs/error-codes.md`, table heading at §4 of that file with the 11-column layout from management-plan §4.4.3.

| Sub | Catalog effect | Discussion effect |
| --- | --- | --- |
| `add` | Append a row. All 11 cells must be non-empty by the end of the dry-run preview — interactively prompt the user for missing fields. `폐기 예정 여부` defaults to `아니오`. `추가일 / 변경일` defaults to today. | Create `discussions/{today}-error-codes-{code}-added.md` from TEMPLATE with `대상 Tag: error-codes`, `변경 유형: Added`, `변경 방향:` asked. |
| `change` | Edit specified cell(s). Bump the `/ 변경일` half of `추가일 / 변경일`. Quote the previous value into the discussion. | Create `…-{code}-changed.md`. |
| `guidance` | Edit `사용자 액션` and/or `운영자 확인 포인트` only. Bump `/ 변경일`. | Discussion optional; ask the user. Default: skip unless this is incident follow-up. |
| `deprecate` | Set `폐기 예정 여부` to `예 — 대체: NEW_CODE` or `예 — EOL: YYYY-MM-DD`. At least one of replacement/EOL must be supplied. | Create `…-{code}-deprecated.md`. |
| `remove` | Move the row to a `## 7. Removed codes` section in the catalog (create the section if absent), preserving the row contents. | Create `…-{code}-removed.md` with the BE release-note URL. |

Affected tag guides: for `add`/`deprecate`/`remove`, also list which tag guides need a `sync-error-refs` run after the catalog change. Don't auto-run it from inside `error-code` — the user runs it explicitly so they see the diff.

---

## 6. `sync-error-refs [--init] [{file}]`

Per §4.4.5. Operates on tag guides only.

### Without `--init`

For each tag guide (or just `{file}` if specified):

1. Find `<!-- BFF-API-DOCS:BEGIN error-code-table (managed by /bff-api-docs sync-error-refs) -->` and the matching `END` line. If absent, skip and emit `no managed block — run with --init first`.
2. Verify the region between BEGIN and END contains *only* a markdown table (and blank lines). If anything else is present, refuse with `human-edited content detected inside managed block`. No write, even with `--apply`.
3. Build the new table from the catalog: rows where this Tag (matched by guide slug → `관련 API Tag` value) appears. Columns: `코드`, `의미`, `발생 API`. `발생 API` is the catalog's `관련 API` value filtered to entries whose path is in this guide's inline YAML.
4. Replace the region. Diff-preview. `--apply` to write.

### With `--init`

For each tag guide where the sentinel block is missing:

1. Find a `## ... 관련 error code` heading. If found, insert an empty sentinel block immediately under it.
2. If no such heading exists, append `## 7. 관련 error code` plus an empty sentinel block at the end of the file (above the `## 변경 / 논의 이력` heading if present, else at EOF).
3. Diff-preview. `--apply` to write.

`--init` does not regenerate tables. Run a normal `sync-error-refs` after `--init --apply` to populate them.

---

## 7. `extract-tag {slug} <swagger-source>`

`<swagger-source>` is a path to an external swagger YAML/JSON.

1. Read the source. Find paths whose `tags[0]` (or any tag entry) equals the tag display name from `docs/bff-api/tag-guides/{slug}.md`'s `> API Tag:` value.
2. Compute the closure of `$ref` references reachable from those paths (transitive). Drop everything else.
3. Render a YAML block (sorted, deterministic) and replace the existing inline YAML in the tag guide's `## 2. BFF Swagger` section.
4. Also rebuild the `## 3. API 목록` table from the same `(method, path)` set.
5. Diff-preview. `--apply` to write.

`--check` mode (read-only): perform the extraction in memory and only report the diff — useful for periodic stale checks.

---

## 8. `index`

Pure read of the filesystem; rewrites the two index sections.

- `docs/bff-api/README.md` Tag table — one row per `tag-guides/*.md`, columns `API Tag` (from `> API Tag:`), `File` (relative link), `Status` (from `> 상태:`).
- `docs/bff-api/discussions/README.md` index table — one row per `discussions/*.md` excluding `README.md` and `TEMPLATE.md`, columns `Date` (from filename), `Title` (H1), `Tags` (from `> 대상 Tag:`), `Status` (from `> 상태:`), `File`.

`--apply` to write. `--force` to overwrite a region that has been hand-edited (default behavior is to refuse if the existing region's structure doesn't match the table shape).

---

## 9. Self-test on every run

Before any write command, run §1.1 + §1.2 (Metadata) on the files about to be touched. If they Fail, refuse the write. This guarantees we never produce invalid docs from this skill itself.

## 10. Out of scope

- Does not push, commit, or open PRs. The user does that with `/pr` or git.
- Does not parse Confluence directly. Confluence numbering lives only in `> Confluence:` metadata.
- Does not generate enum/state catalog content; that doc has not been bootstrapped yet.

When in doubt, read [docs/bff-api/management-plan.md](../../../docs/bff-api/management-plan.md). Update this skill only after the plan is updated.
