---
name: pr-flow
description: Legacy alias for /pr. Prefer /pr for Pull Request creation and /pr-merge for merging.
user_invocable: true
---

# /pr-flow - Legacy PR Alias

This skill exists for backward compatibility with older `/pr-flow` requests.

## Canonical Flow

- Use `/pr` for PR creation and validation.
- Use `/pr-merge` only when the user explicitly requests merge in the current thread.
- Use `/worktree-cleanup` after merge for local worktree/branch cleanup.

## Default Behavior

If the user invokes `/pr-flow` without explicitly requesting merge, treat it exactly like `/pr`.

```bash
bash scripts/pr-flow.sh --strategy squid
```

The script prints only the useful PR result on success. It prints the failed step and tail log only on failure.

## Merge

- Do not use `--merge-approved` by default.
- If the user explicitly requests merge, prefer `/pr-merge`.
- `bash scripts/pr-flow.sh --merge-approved` remains only for legacy compatibility.

## Rules

- New routing and documentation should use `/pr` as the canonical PR creation skill.
- Do not merge unless the user explicitly requests merge in the current thread.
- Do not paste successful validation logs into the main session.
