---
name: pre-commit-check
description: Commit 전 품질 검증을 Haiku로 수행. lint/tsc/test/build를 빠르고 저렴하게 실행.
user_invocable: true
---

# /pre-commit-check - Pre-Commit Validation

Commit 전에 코드 품질 검증을 수행합니다.

## Cost Optimization Strategy

**This skill uses Haiku subagent for all validations (~70% cost reduction).**

- Main session (Sonnet/Opus): Development work
- Haiku subagent: Mechanical validation (lint, tsc, test, build)

## When to Use

**개발 중 검증 워크플로우:**

1. Opus/Sonnet으로 개발 완료
2. `/pre-commit-check`로 Haiku 검증 실행
3. 통과 시 commit
4. 실패 시 수정 후 재시도

**vs. Git Hook:**
- Git hook: Commit 시점에 동기 실행 (1-2초, 이미 최적화됨)
- This skill: 개발 중 언제든 비동기 검증 (Haiku로 비용 절감)

## How This Skill Works

**Manual workflow** (This skill is NOT auto-invoked):

1. Read this guide
2. **You call Task tool** with Haiku subagent to run pre-commit checks
3. Haiku runs lint, tsc, test, build and contract validations
4. Haiku reports pass/fail results

**Why manual:** Pre-commit checks are optional validations you can run anytime before committing. Git hook handles automatic checks at commit time.

## When to Use This Skill

- Before committing code
- To validate changes without committing
- To check contract alignment (API changes)

## Usage Example

When you want to check code quality before committing, **you** should call Task tool:

```typescript
Task({
  subagent_type: "Bash",
  model: "haiku",
  description: "Run pre-commit checks (Haiku)",
  prompt: `
    Run quality checks before commit:

    1. Check for staged changes: git diff --cached --name-only
       - If no changes: report and stop
    2. Run lint: npm run lint
    3. Run type-check: npx tsc --noEmit
    4. Run tests: npm run test:run
    5. Run build: npm run build
    6. Run contract check (API/Swagger 작업은 필수):
       - bash scripts/contract-check.sh --mode staged
       - Follow: .claude/skills/shared/CONTRACT_VALIDATION.md
    7. Report results:
       - All passed: "✅ Ready to commit"
       - Any failed: "❌ Fix issues before commit" + error summary

    Output format:
    ✓ Lint: passed
    ✓ Type-check: passed
    ✓ Tests: passed (X passed)
    ✓ Build: passed
    ✓ Contract-check: passed (or skipped when out of scope)

    IMPORTANT: Run all checks even if one fails (don't stop early)
  `
})
```

## Output Example

**Success:**
```
✅ Pre-commit checks passed

✓ Lint: no issues
✓ Type-check: no errors
✓ Tests: 42 passed
✓ Build: completed in 8.2s
✓ Contract-check: passed

Ready to commit!
```

**Failure:**
```
❌ Pre-commit checks failed

✓ Lint: no issues
✗ Type-check: 3 errors
  - src/components/Foo.tsx:12 - Type 'string' not assignable to 'number'
  - src/lib/bar.ts:45 - Property 'baz' missing
✓ Tests: 42 passed
✓ Build: completed (with warnings)
✗ Contract-check: API/runtime changed without Swagger update

Fix type errors before commit.
```

## Rules

- Run all checks regardless of individual failures (for complete report)
- Report concise error summary (not full output)
- If no staged changes, notify user
- API 계약 불일치는 lint/test/build가 통과해도 실패로 처리
- DO NOT auto-commit on success (user decides when to commit)

## Benefits vs. Git Hook

| Aspect | Git Hook | /pre-commit-check |
|--------|----------|-------------------|
| Timing | Commit 시점 (동기) | 개발 중 언제든 |
| Speed | 1-2초 (native) | 3-5초 (API 왕복) |
| Cost | 무료 | Haiku (~30% Opus) |
| Flexibility | 자동 실행만 | 수동 호출 가능 |
| Use case | 최종 검증 | 개발 중 중간 체크 |

**Recommendation:**
- 개발 중: `/pre-commit-check` (Haiku)
- Commit 시: Git hook (native, 이미 최적화됨)
