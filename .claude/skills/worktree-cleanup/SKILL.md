---
name: worktree-cleanup
description: PR merge 후 완료된 작업 worktree를 정리하는 워크플로우. merged 브랜치의 worktree 제거와 로컬 브랜치 삭제가 필요할 때 사용.
user_invocable: true
---

# /worktree-cleanup - Cleanup Merged Worktree

PR merge가 끝난 worktree를 안전하게 정리합니다.

## Cost Optimization Strategy

**This skill uses Haiku subagent for all operations (~70% cost reduction).**

- Main session (Sonnet/Opus): User interaction only
- Haiku subagent: Bash cleanup operations

## How This Skill Works

**Manual workflow** (This skill is NOT auto-invoked):

1. Read this guide
2. **You call Task tool** with Haiku subagent to cleanup worktree
3. Haiku runs cleanup script and reports result

**Why manual:** Worktree cleanup is destructive and must be explicitly requested.

## When to Use This Skill

- After PR is merged
- To clean up completed feature branches

## Usage Example

When you want to cleanup a merged worktree, **you** should call Task tool:

```typescript
Task({
  subagent_type: "Bash",
  model: "haiku",
  description: "Cleanup merged worktree (Haiku)",
  prompt: `
    Clean up merged worktree using the cleanup script:

    1. Verify worktree path: /Users/study/pii-agent-demo-fix-haiku-skills
    2. Execute: bash scripts/worktree-cleanup.sh --path /Users/study/pii-agent-demo-fix-haiku-skills
    3. Report: removed worktree path and branch name

    The script will:
    - Verify path is an active worktree
    - Check branch is merged to origin/main
    - Remove worktree
    - Remove local branch
    - Run git worktree prune

    SAFETY: Never remove canonical repo or main/master/HEAD branches
  `
})
```

## Rules

- Canonical repo (`/Users/study/pii-agent-demo`) is never removed
- `main`/`master`/`HEAD` branches are protected
- Always run from outside the target worktree
