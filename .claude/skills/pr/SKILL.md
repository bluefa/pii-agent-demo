---
name: pr
description: Canonical Pull Request creation workflow. Runs quiet validation, rebases on latest main, pushes, creates a reviewable PR description, and reports only the useful result.
user_invocable: true
---

# /pr - Create Pull Request

Create a Pull Request after implementation is complete. This is the canonical PR creation skill.

## Responsibility Split

- `/pr`: validates, rebases on latest `origin/main`, pushes, and creates the PR.
- `/pr-merge`: merges only when the user explicitly requests merge in the current thread.
- `/worktree-cleanup`: cleans up the local worktree/branch after merge.
- `/pr-flow`: legacy alias. New PR creation requests should follow this skill.

## Token Policy

- Do not paste full successful validation logs into the main session.
- On success, report only the PR URL, commit count, and validation PASS summary.
- On failure, inspect only the failed step and the script-provided tail log.
- The PR description must include the template sections below. Never submit a one-line body.

## Script And Hook Behavior

- Canonical PR creation uses `bash scripts/pr-flow.sh --strategy squid`.
- `scripts/pr-flow.sh` calls `scripts/pr-check.sh`, then pushes and creates or finds the PR.
- `scripts/pr-check.sh` runs validation with logs redirected to a temp directory.
- `scripts/pr-check.sh` also runs the lightweight policy grep that used to live directly in the PR hook.
- Direct `gh pr create` is guarded by `.claude/hooks/pre-bash-pr-create.sh`.
- The hook calls `scripts/pr-check.sh --base main --quiet` only when the current `HEAD` has not already passed the PR gate.
- Hook success must produce no output. Hook failure should print only the failed step and the tail log emitted by `scripts/pr-check.sh`.

## Procedure

1. Verify that the current directory is a feature worktree/branch.

```bash
bash scripts/guard-worktree.sh
```

2. If there are uncommitted changes, commit only the files intended for this PR.
3. Run the mechanical PR pipeline with one quiet script.

```bash
bash scripts/pr-flow.sh --strategy squid
```

The script performs:

- `origin/main` fetch and rebase
- Lightweight policy grep for project rules
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run test:run`
- `npm run build`
- `bash scripts/contract-check.sh --mode diff --base origin/main --head HEAD`
- `git push --force-with-lease`
- PR description generation through `scripts/build-pr-body.sh`
- `gh pr create`, or lookup of an existing open PR for the branch

4. If the script succeeds, report only the PR URL and validation summary.
5. If the script fails, report the failed step and the relevant tail log. Do not summarize unrelated successful logs.

## Required PR Description Template

The PR body must include all sections below.

```md
## Summary
- What changed and why

## What Changed
- Main files/modules touched
- Behavior changes

## Validation
- Commands/checks executed and their results

## Contract Validation
- Use `No API/Swagger changes detected` when applicable
- For API/Swagger changes, include `contract-check` PASS/FAIL and follow-up actions

## Risks
- Potential impact areas
- Rollback plan

## Notes For Reviewer
- Specific reviewer focus areas
```

## Main Session Context Budget

Only read small context when the PR body needs human refinement.

```bash
git log origin/main..HEAD --format="%h %s"
git diff origin/main...HEAD --stat
```

## Rules

- Never push directly to `main`.
- The branch must originate from local `main` synced to latest `origin/main`.
- Do not split one change across multiple branches.
- Do not create a PR when validation fails.
- Do not omit the PR description or submit a one-line body.
- Never use `--merge-approved` in this skill. Use `/pr-merge` for merge.
