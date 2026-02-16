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

## How This Skill Works

**Automated workflow** (Scripts + Haiku):

1. **You call Task tool** with Haiku subagent
2. Haiku validates, creates PR, and optionally merges
3. Haiku reports PR URL

**Why automated:** PR flow script handles validation, PR creation, and merge as a single pipeline.

## When to Use This Skill

- Complete feature implementation
- Ready for code review and automatic merge approval

## Usage Example

**Script-Based (Recommended)** — **You call Task tool**:

When you're ready to create PR (with optional merge), **you** should call Task tool:

```typescript
Task({
  subagent_type: "Bash",
  model: "haiku",
  description: "Run PR flow script (Haiku)",
  prompt: `
    Execute PR flow automation script:

    1. Verify worktree: bash scripts/guard-worktree.sh
    2. Rebase: git fetch origin main && git rebase origin/main
    3. Re-run tests: npm run test:run
    4. Run contract validation:
       - bash scripts/contract-check.sh --mode diff --base origin/main --head HEAD
       - Follow: .claude/skills/shared/CONTRACT_VALIDATION.md
    5. Execute flow: bash scripts/pr-flow.sh --strategy squid
       - Only add --merge-approved if user explicitly requested merge
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

**Manual Steps** — If script unavailable, follow `/pr` skill workflow with Task tool for Haiku delegation.

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
