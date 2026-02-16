---
name: pr-merge
description: Pull Request 머지 워크플로우. PR 상태 확인 후 merge/squash/squid 전략으로 머지하고 브랜치 정리가 필요할 때 사용.
user_invocable: true
---

# /pr-merge - Merge Pull Request

PR 머지 전 검증과 머지 전략을 일관되게 수행합니다.

## Cost Optimization Strategy

**This skill uses Haiku subagent for all operations (~70% cost reduction).**

- Main session (Sonnet/Opus): User interaction only
- Haiku subagent: Bash PR merge operations

## Input

- `pr`: PR 번호 또는 URL
- `strategy`: `merge` | `squash` | `squid` (기본값: `squid`)

## Implementation

Use Task tool to spawn a Haiku subagent:

```
Task({
  subagent_type: "Bash",
  model: "haiku",
  description: "Merge PR (Haiku)",
  prompt: `
    Merge pull request with validation:

    1. View PR info: gh pr view {pr} --json number,title,state,mergeable,headRefName,baseRefName
    2. Verify: state=OPEN and mergeable=MERGEABLE
    3. Check for worktree: git worktree list | grep {headRefName}
    4. If worktree exists: bash scripts/worktree-cleanup.sh --path <worktree-path> --force
    5. Merge with strategy {strategy}:
       - merge: gh pr merge {pr} --merge --delete-branch
       - squash/squid: gh pr merge {pr} --squash --delete-branch
    6. Verify merge: gh pr view {pr} --json state,mergedAt,mergeCommit
    7. Report: PR number, merge commit SHA

    CRITICAL: Remove worktree BEFORE merge (--delete-branch fails if worktree exists)
  `
})
```

## Strategy Mapping

- `merge` → `--merge`
- `squash` / `squid` → `--squash`

## Rules

- NEVER merge without explicit user request
- Default strategy: `squid` (squash)
- NEVER merge if state ≠ OPEN or conflicts exist
- ALWAYS remove worktree before merge
