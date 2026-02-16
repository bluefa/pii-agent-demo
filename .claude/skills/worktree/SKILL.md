---
name: worktree
description: Git worktree/브랜치 초기 세팅을 강제하는 워크플로우. 구현 시작 전 worktree 생성, 디렉터리 이동, 검증이 필요할 때 사용.
user_invocable: true
---

# /worktree - Set Up Feature Worktree

구현 작업 시작 전에 worktree를 준비합니다.

## Cost Optimization Strategy

**This skill uses Haiku subagent for all operations (~65% cost reduction).**

- Main session (Sonnet/Opus): User interaction only
- Haiku subagent: Bash setup operations

## Input

- `topic`: 기능 이름 (예: `adr006-approval-flow`)
- `prefix`: 브랜치 prefix (기본값: `feat`)

## How This Skill Works

**Manual workflow** (This skill is NOT auto-invoked):

1. Read this guide
2. **You call Task tool** with Haiku subagent to setup worktree
3. Haiku runs git/bash commands and reports final path + branch

**Why manual:** Worktree creation is a setup operation that must be explicit. Once created, you continue work in that worktree.

## When to Use This Skill

- Starting a new feature branch
- Before any code changes

## Usage Example

When you want to setup a worktree, **you** should call Task tool:

```typescript
Task({
  subagent_type: "Bash",
  model: "haiku",
  description: "Setup feature worktree (Haiku)",
  prompt: `
    Set up a new feature worktree:

    1. Navigate to canonical repo: /Users/study/pii-agent-demo
    2. Sync local main: git fetch origin main && git checkout main && git merge origin/main --ff-only
    3. Create worktree: bash scripts/create-worktree.sh --topic fix-haiku-skills --prefix fix
    4. Navigate to new worktree path (from script output)
    5. Verify setup:
       - bash scripts/guard-worktree.sh
       - git rev-parse --show-toplevel
       - git rev-parse --abbrev-ref HEAD
    6. Bootstrap dependencies: bash scripts/bootstrap-worktree.sh "$(pwd)"
    7. Report: worktree path and branch name

    If "next: command not found" occurs, bootstrap first then retry.
  `
})
```

## Rules

- NEVER start work on `main`/`master`
- NEVER create branch before syncing local main with origin/main
- ALL subsequent work must be in the newly created worktree
- Code changes ONLY after worktree is ready
