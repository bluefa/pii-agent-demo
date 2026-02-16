---
name: pr-flow
description: Pull Request 생성 자동화 워크플로우. 기본은 PR 생성까지만 수행하고, 사용자의 명시적 merge 요청이 있을 때만 머지를 수행해야 할 때 사용.
user_invocable: true
---

# /pr-flow - Create PR (Merge Gated)

PR 생성을 자동 처리하고, merge는 명시적 승인 옵션이 있을 때만 수행합니다.

## Cost Optimization Strategy

**Hybrid delegation (~50% cost reduction):**

- **Haiku subagent**: Bash script execution
- **Main session (Sonnet/Opus)**: PR description review and enhancement

## Input

- `strategy`: `merge` | `squash` | `squid` (기본값: `squid`)
- `merge_approved`: 사용자 명시 요청 시에만 `true`

## Implementation

### Option 1: Script-Based (Recommended)

Use Task tool to spawn a Haiku subagent:

```
Task({
  subagent_type: "Bash",
  model: "haiku",
  description: "Run PR flow script (Haiku)",
  prompt: `
    Execute PR flow automation script:

    1. Verify worktree: bash scripts/guard-worktree.sh
    2. Rebase: git fetch origin main && git rebase origin/main
    3. Re-run tests: npm run test:run
    4. If API/Swagger files changed, run contract validation:
       - request/response required fields vs Swagger
       - enum values vs Swagger
       - legacy alias reintroduction check
       - domain-specific banned dependency checks for changed paths
       - canonical source fields are consistently used in request construction
    5. Execute flow: bash scripts/pr-flow.sh --strategy {strategy} {merge_flag}
       - merge_flag: --merge-approved (only if user explicitly requested merge)
    6. Report: PR URL and status

    The script handles:
    - PR description generation (scripts/build-pr-body.sh)
    - PR creation
    - Optional merge (if --merge-approved)

    CRITICAL:
    - NEVER use --merge-approved without explicit user request
    - Stop on dirty working tree, test failures, or contract validation failures
  `
})
```

### Option 2: Manual Steps

If script unavailable, follow `/pr` skill workflow with Haiku delegation for bash operations.

## PR Description

- Auto-generated via `scripts/build-pr-body.sh`
- Includes: Summary / What Changed / Validation / Risks / Notes For Reviewer
- API 변경 PR은 Contract Validation 섹션을 추가한다.

## Rules

- NEVER skip rebase before PR creation
- NEVER use `--merge-approved` without explicit user request
- NEVER proceed when contract validation fails
- Default behavior: PR creation only (NO merge)
- Merge only if: user requested AND mergeable state
- After merge: use `/worktree-cleanup` to clean up
