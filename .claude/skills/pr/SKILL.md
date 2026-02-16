---
name: pr
description: 기능 완료 후 Pull Request 생성 워크플로우. 동일 브랜치 검증, 빌드/타입 체크, 사람 리뷰어가 이해 가능한 상세 PR description 작성, URL 보고가 필요할 때 사용.
user_invocable: true
---

# /pr - Create Pull Request

기능 완료 후 PR을 생성합니다.

## Cost Optimization Strategy

**Hybrid delegation (~50% cost reduction):**

- **Haiku subagent**: Bash operations (rebase, lint, build, test, push)
- **Main session (Sonnet/Opus)**: PR description generation (requires context understanding)

## How This Skill Works

**Two-phase hybrid workflow** (Skills+Task collaboration):

**Phase 1: Haiku validation & push** — **You call Task tool**:
- Haiku rebases, validates, pushes branch
- Returns success/failure

**Phase 2: Main session PR creation** — **You read commit context and create PR**:
- You analyze changes
- You write PR description
- You create PR via `gh pr create`

**Why hybrid:** Bash operations (rebase, lint, build) are mechanical → Haiku. PR description needs human insight → Main session.

## When to Use This Skill

- After code implementation complete
- Ready to create PR for code review

## Usage Example

**Phase 1: Call Task tool for validation**

When you're ready to validate and push, **you** should call Task tool:

```typescript
Task({
  subagent_type: "Bash",
  model: "haiku",
  description: "Validate and push PR (Haiku)",
  prompt: `
    Prepare PR by validating and pushing:

    1. Verify feature branch: git rev-parse --abbrev-ref HEAD
    2. Rebase on latest main: git fetch origin main && git rebase origin/main
       - If conflicts: report to user and stop
    3. Run validation:
       - bash scripts/guard-worktree.sh
       - npm run lint
       - npx tsc --noEmit
       - npm run test:run
       - npm run build
    4. Run contract validation:
       - bash scripts/contract-check.sh --mode diff --base origin/main --head HEAD
       - Follow: .claude/skills/shared/CONTRACT_VALIDATION.md
    5. Check for commits: git log origin/main..HEAD --oneline
       - If empty: report and stop
    6. Push branch: git push origin HEAD --force-with-lease
    7. Report: branch name, commit count, validation results

    CRITICAL: Stop immediately on any failure
  `
})
```

### Phase 2: PR Creation (Main Session)

After Haiku validation succeeds:

1. **Read commit history** for context:
```bash
git log origin/main..HEAD --format="%h %s"
git diff origin/main..HEAD --stat
```

2. **Generate PR description** using main session (requires high-level understanding):
   - Analyze changes and commits
   - Draft comprehensive description with template sections
   - Or use: `bash scripts/build-pr-body.sh --base main`

3. **Create PR**:
```bash
gh pr create --base main --head <branch> --title "<title>" --body "<description>"
```

## PR Description Template (Required)

```md
## Summary
- 무엇을 왜 바꿨는지 핵심 요약

## What Changed
- 주요 변경 파일/모듈
- 동작 변경 포인트

## Validation
- 실행한 검증 명령과 결과

## Contract Validation (API 변경 시 필수)
- 실행 명령
- PASS/FAIL 결과
- 실패/예외 시 TODO 및 제거 계획

## Risks
- 잠재 영향 범위
- 롤백 방법

## Notes For Reviewer
- 리뷰어가 집중해서 볼 체크포인트
```

## Rules

- NEVER push to `main` directly
- NEVER skip rebase before PR
- NEVER create PR with validation failures
- NEVER create PR when contract validation fails
- NEVER submit PR with empty or single-line description
