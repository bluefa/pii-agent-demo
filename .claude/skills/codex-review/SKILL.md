---
name: codex-review
description: Cross-review the current branch with OpenAI Codex CLI (gpt-5.5, reasoning=xhigh). Use for major-decision sign-off, pre-PR second opinion, or any case where Claude's implementation should be validated by an external model.
---

# Codex Review Skill

Run the current branch's changes through Codex CLI as an independent reviewer. Intended as a "sign-off" step — major decisions go through Codex so we catch blind spots and counter-opinions that a single-model loop would miss.

## Execution principles

1. **Full access**: always pass `--dangerously-bypass-approvals-and-sandbox`. This is an explicit user preference — Codex must be able to read the full repo (especially `.claude/skills/**` and untracked files) for skill-aware review and uncommitted-scope reviews. The tradeoff (Codex can also write) is accepted; the SKILL.md itself prohibits auto-applying Codex's suggestions (see "Prohibitions" below).
2. **Pinned model**: always pass `-c model="gpt-5.5" -c model_reasoning_effort="xhigh"` on the CLI. Do not rely on `~/.codex/config.toml` defaults — they can drift.
3. **Fresh base**: run `git fetch origin --quiet` before invoking Codex. Do NOT use `git fetch origin main` — that form only updates `FETCH_HEAD`, leaving `refs/remotes/origin/main` stale, which breaks the default `origin/main...HEAD` diff scope.
4. **Foreground Bash with `timeout: 600000`** (10 min) and `</dev/null` redirection — Codex otherwise blocks reading stdin even when a prompt arg is provided. Pipe stdout directly to the user **verbatim**, then prepend a 1–3 line Claude summary.

## Arg parsing

| Invocation | Behavior |
|---|---|
| `/codex-review` | Review `origin/main...HEAD` (default, three-dot — merge-base diff) |
| `/codex-review uncommitted` | Review staged + unstaged + untracked working tree |
| `/codex-review commit <sha>` | Review a single commit |
| `/codex-review base=<branch>` | Override the comparison base |
| `/codex-review "<free text>"` | Appended as extra reviewer instructions |

Combinable, e.g. `/codex-review uncommitted "focus on security"`.

## Command template

Use generic `codex exec` (not `codex exec review`). In codex-cli 0.124.0, `codex exec review` rejects a custom `[PROMPT]` argument when combined with `--base`, `--uncommitted`, or `--commit` (error: `the argument '--base <BRANCH>' cannot be used with '[PROMPT]'`), which makes skill-aware review impossible through that path. With full access, Codex can gather the diff itself via shell commands inside the prompt.

```bash
codex exec \
  --dangerously-bypass-approvals-and-sandbox \
  -c model="gpt-5.5" \
  -c model_reasoning_effort="xhigh" \
  "$(cat <<'PROMPT'
<REVIEW_PROMPT with DIFF_SCOPE variable filled in>
PROMPT
)"
```

Fill `DIFF_SCOPE` inside the prompt based on the invocation:

- default → `git diff origin/main...HEAD`
- `uncommitted` → `git diff HEAD`, plus for each path from `git ls-files --others --exclude-standard` Codex must `cat` the file to include its contents (otherwise untracked files are reviewed by name only)
- `commit <sha>` → `git show <sha>`
- `base=<branch>` → `git diff <branch>...HEAD` (three-dot — merge-base diff)

## Skill-aware review prompt

Pass this prompt to Codex **verbatim** (filling in `DIFF_SCOPE`). It instructs Codex to self-select the relevant skill files based on the diff.

```
You are an external reviewer for this repository. You are running as OpenAI Codex CLI, cross-validating changes implemented by Claude Code.

=== STEP 1. Gather context ===
1. Run: DIFF_SCOPE. If the scope is `uncommitted`, also `cat` every untracked file listed by `git ls-files --others --exclude-standard` — the diff alone only shows paths for untracked files, not contents.
2. Collect the list of changed file paths and a summary of changes.
3. Select relevant skill files based on paths/extensions/content. Read every selected file before reviewing.

Always read:
- .claude/skills/coding-standards/SKILL.md — project-wide coding rules
- .claude/skills/anti-patterns/SKILL.md — frontend anti-pattern catalog
- CLAUDE.md (root) — project constraints and hard rules

Conditionally read:
- React / Next.js component changes (`.tsx`, paths under `components/` or `app/`) → .claude/skills/vercel-react-best-practices/SKILL.md
- PR-scope review needed (5+ files changed or architectural change) → .claude/skills/pr-context-review/SKILL.md
- AGENTS.md if present at the root

Additional lens (no local file — apply from your own knowledge):
- /simplify lens: Is there a reusable existing util being duplicated? Unnecessary abstractions or premature optimization? Could 50 lines do what 200 lines do here?

=== STEP 2. Review ===
Apply the rules from the skill files to the diff. Classify findings:
- **Critical**: violation of CLAUDE.md hard rules (⛔ section), coding-standards violations, security issues, clear bugs
- **Major**: anti-pattern violations, React performance issues, architectural inconsistencies
- **Minor**: readability, naming, issues caught by the /simplify lens

=== STEP 3. Output format (strict) ===

## Skills referenced
- <path> — <one-line reason>
- ...

## Summary
- Findings: Critical N / Major N / Minor N
- Most important: <one line>

## Critical
(write "None" if empty)
### <file:line> — <title>
<evidence + quote>
<suggestion>

## Major
(same format)

## Minor
(same format)

## Verdict
- Mergeable: <Yes / Conditional / No>
- Conditions: <if any>

=== Constraints ===
- Do NOT modify code. Review only.
- No speculation. If unsure, mark as "needs verification".
- Write the output in English.
```

## Output handling

- Dump Codex stdout **verbatim** to the user — the external model's own wording is the value of the sign-off.
- Prepend a 1–3 line Claude summary: count of skills Codex actually referenced, Critical/Major totals, mergeable verdict. Users should be able to triage from the summary alone.
- If Codex concludes "no issues", still surface the full output — the agreement/disagreement signal itself is data.

## Failure handling

- `codex: command not found` → tell the user to install Codex CLI, stop.
- Non-zero exit → surface stderr verbatim, do not retry.
- Timeout on large diffs → report to user, suggest narrowing with `commit <sha>`.

## Prohibitions

- Do NOT use `--full-auto` (still sandboxed — skill file reads become unreliable).
- Do NOT edit Codex's output before surfacing it (bias injection).
- Do NOT auto-apply Codex's suggestions. Review only. Wait for explicit user instruction before any code change.
