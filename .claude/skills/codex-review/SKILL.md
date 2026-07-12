---
name: codex-review
description: Cross-review the current branch with OpenAI Codex CLI using two Codex 5.6 models (gpt-5.6-terra + gpt-5.6-sol, reasoning=xhigh). Use for major-decision sign-off, pre-PR second opinion, or any case where Claude's implementation should be validated by an external model.
---

# Codex Review Skill

Run the current branch's changes through Codex CLI as an independent reviewer. Intended as a "sign-off" step — major decisions go through Codex so we catch blind spots and counter-opinions that a single-model loop would miss.

The review runs the identical prompt through **two Codex 5.6 models** — `gpt-5.6-terra` and `gpt-5.6-sol`. Two independent 5.6 opinions catch more than one, and where they agree vs. disagree is itself signal.

## Execution principles

0. **Fast mode**: enable Claude Code fast mode (`/fast`) before invoking Codex. Codex reviews can take up to 10 minutes — fast mode keeps Claude responsive during the wait. Keep this on for the duration of the skill.
1. **Full access**: always pass `--dangerously-bypass-approvals-and-sandbox`. This is an explicit user preference — Codex must be able to read the full repo (especially `.claude/skills/**` and untracked files) for skill-aware review and uncommitted-scope reviews. The tradeoff (Codex can also write) is accepted; the SKILL.md itself prohibits auto-applying Codex's suggestions (see "Prohibitions" below).
2. **Pinned models**: run the review twice, once with `-c model="gpt-5.6-terra"` and once with `-c model="gpt-5.6-sol"`, both with `-c model_reasoning_effort="xhigh"`. Do not rely on `~/.codex/config.toml` defaults — they can drift (the config default is currently `gpt-5.6-luna`, which is NOT what this skill uses).
3. **Fresh base**: run `git fetch origin --quiet` before invoking Codex. Do NOT use `git fetch origin main` — that form only updates `FETCH_HEAD`, leaving `refs/remotes/origin/main` stale, which breaks the default `origin/main...HEAD` diff scope.
4. **Foreground Bash with `timeout: 600000`** (10 min) and `</dev/null` redirection — Codex otherwise blocks reading stdin even when a prompt arg is provided. Run both models in a single Bash call (sequentially, or backgrounded and waited) so one 10-min timeout covers the pair; pipe each model's stdout to the user **verbatim** under its own heading, then prepend a 1–3 line Claude summary comparing them.

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

Run the same prompt through both 5.6 models. Build the prompt once, then invoke each model:

```bash
PROMPT="$(cat <<'PROMPT'
<REVIEW_PROMPT with DIFF_SCOPE variable filled in>
PROMPT
)"

for MODEL in gpt-5.6-terra gpt-5.6-sol; do
  echo "===== CODEX REVIEW: $MODEL ====="
  codex exec \
    --dangerously-bypass-approvals-and-sandbox \
    -c model="$MODEL" \
    -c model_reasoning_effort="xhigh" \
    "$PROMPT" </dev/null
done
```

Both models run inside one Bash call (`timeout: 600000`). If wall-clock is tight, background each `codex exec` and `wait`, but keep each model's output clearly labeled by its heading.

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
- Mockup-based UI lens: For diffs implementing UI from a design mockup (HTML/Figma/screenshot), check:
  - Required text, badges, and status copy from the mockup are not silently dropped
  - UI patterns (pill vs underline tab, segmented control, progress bar variants) are not swapped for a similar-looking but different component
  - New routes have an entry path (TopNav etc.) and existing active matchers do not false-match the new route
  - Light surfaces (cards / panels / editors / modals) declare explicit bg + text tokens — no implicit dark-mode CSS variable inheritance
  - Editor / contenteditable behaviors are verified against a real user flow (dirty detection, link-click navigation, inline URL visibility)

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

- Dump **both** models' stdout **verbatim** to the user, each under its own `gpt-5.6-terra` / `gpt-5.6-sol` heading — the external models' own wording is the value of the sign-off.
- Prepend a 1–3 line Claude summary comparing the two: where terra and sol **agree** (highest-confidence findings), where they **diverge**, and the combined mergeable verdict (take the stricter of the two verdicts as the gate). Users should be able to triage from the summary alone.
- If either model concludes "no issues", still surface its full output — agreement and disagreement between the two models are both data.

## Failure handling

- `codex: command not found` → tell the user to install Codex CLI, stop.
- Non-zero exit → surface stderr verbatim, do not retry. If only one of the two models fails, still surface the other model's review and note which model failed — a single 5.6 opinion beats none.
- Timeout on large diffs → report to user, suggest narrowing with `commit <sha>`.

## Prohibitions

- Do NOT use `--full-auto` (still sandboxed — skill file reads become unreliable).
- Do NOT edit Codex's output before surfacing it (bias injection).
- Do NOT auto-apply Codex's suggestions. Review only. Wait for explicit user instruction before any code change.
