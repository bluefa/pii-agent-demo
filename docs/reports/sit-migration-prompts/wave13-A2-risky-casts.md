# Wave 13-A2 — Replace Risky `as unknown as` Casts with Runtime Validation

## Context
Project: pii-agent-demo.
Audit §A2 🔴 (`as unknown as X` = type system 우회). Total **4 sites**, 2 in tests (허용), **2 in production** (수정 대상).

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
prod=$(grep -rn "as unknown as" app lib --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "__tests__\|\.test\." | wc -l | tr -d ' ')
[ "$prod" = "2" ] || { echo "✗ prod cast count drifted: $prod (expected 2)"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave13-a2-casts --prefix refactor
cd /Users/study/pii-agent-demo-wave13-a2-casts
```

## Step 2: Required reading
1. `.claude/skills/anti-patterns/SKILL.md` §A2 — `as unknown as` 는 runtime 일치 보증이 0
2. `docs/adr/008-error-handling-strategy.md` — boundary validation 원칙
3. 2 target 파일의 주변 로직:
   - `lib/bff/http.ts:62` — BFF 응답 → CurrentUser
   - `lib/api-client/mock/confirm.ts:313` — normalizer 이후 cast
4. 기존 zod 스키마 존재 여부: `grep -rln "from 'zod'" lib app` (이미 있으면 재사용)

## Step 3: Site-by-site fix

### Site 1: `lib/bff/http.ts:62` — CurrentUser cast
```ts
// 현재
return data.user as unknown as CurrentUser;
```
**리스크**: BFF 가 스키마를 바꾸면 런타임 crash. 타입은 조용히 깨짐.

**교체**: runtime 검증 + 명확한 에러.

옵션 A — zod schema (권장, 이미 zod 의존 있다면):
```ts
import { z } from 'zod';

const CurrentUserSchema = z.object({
  id: z.string(),
  role: z.enum(['ADMIN', 'USER', ...]),
  // CurrentUser 타입 필드 그대로 매핑
});

const parsed = CurrentUserSchema.safeParse(data.user);
if (!parsed.success) {
  throw new AppError('Invalid CurrentUser shape', { cause: parsed.error });
}
return parsed.data;
```

옵션 B — 수동 type guard (zod 의존 없을 시):
```ts
function isCurrentUser(value: unknown): value is CurrentUser {
  return (
    typeof value === 'object' && value !== null &&
    'id' in value && typeof (value as any).id === 'string' &&
    // ... 필드별 check
  );
}
if (!isCurrentUser(data.user)) {
  throw new AppError('Invalid CurrentUser shape');
}
return data.user;
```

**판단**: repo 에서 `grep -rln "from 'zod'"` 결과 확인 후 선택. zod 있으면 A, 없으면 B.

### Site 2: `lib/api-client/mock/confirm.ts:313`
```ts
// 현재
normalizeIssue222ApprovalRequestBody(body) as unknown as ApprovalRequestCreateBody;
```

**컨텍스트**: normalizer 함수의 반환 타입이 `ApprovalRequestCreateBody` 와 일치하지 않아 cast. 근본 원인은 normalizer signature.

**교체 1 (권장)**: normalizer 의 return type 을 `ApprovalRequestCreateBody` 로 명시. 내부 로직이 실제로 맞는지 TS 가 검사하게 함.
```ts
function normalizeIssue222ApprovalRequestBody(body: unknown): ApprovalRequestCreateBody {
  // 기존 로직 + 마지막 return 문이 type 맞게
}
```
이후 cast 제거:
```ts
normalizeIssue222ApprovalRequestBody(body);
```

**교체 2 (fallback)**: Site 1 과 동일한 runtime 검증 패턴 적용 (zod/guard).

**우선 순위**: 교체 1 시도 → TS error 나면 normalizer 구현 확인 → 필요하면 교체 2.

## Step 4: Do NOT touch
- 테스트 파일의 2 사이트 (`as unknown as Project`) — fixture setup 허용
- 다른 cast (`as X` 단순 cast) — 이 spec 범위 아님
- 스키마가 BFF 전체와 맞는지 grand audit — out of scope
- Mock 의 다른 normalizer — 이 사이트만

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- lib/bff/http.ts lib/api-client/mock/confirm.ts
npm run build
```

최종 확인:
```
grep -rn "as unknown as" app lib --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "__tests__\|\.test\."
# → 0 결과
```

수동 검증:
- `/me` 호출해 CurrentUser 정상 흐름
- 유효 CurrentUser 구조: 현재와 동일 동작
- 의도적으로 깨진 응답 (devtools 에서 response mock) → `AppError` throw 확인
- `normalizeIssue222ApprovalRequestBody` 의 호출자에서 TS 타입이 유지되는지

## Step 6: Commit + push + PR

```
git add lib/bff/http.ts lib/api-client/mock/confirm.ts
# zod schema 추가 시 함께 add
git commit -m "refactor(safety): replace 2 \`as unknown as\` with runtime validation (wave13-A2)

Audit §A2 🔴. 테스트 fixture 2건 (허용) 제외한 production 2 사이트.

- lib/bff/http.ts:62     → zod schema parse + AppError on mismatch
- lib/api-client/mock/confirm.ts:313 → normalizer return type 명시, cast 제거

런타임 불일치 시 silent type lie 대신 명시적 throw."
git push -u origin refactor/wave13-a2-casts
```

PR body (`/tmp/pr-wave13-a2-body.md`):
```
## Summary
Remove 2 production `as unknown as` casts per audit §A2 🔴. Test fixtures (2 sites) preserved.

## Sites
- `lib/bff/http.ts:62` — CurrentUser runtime validation
- `lib/api-client/mock/confirm.ts:313` — normalizer return type tightened

## Approach
zod schema (if already in deps) OR manual type guard. On mismatch: `AppError` throw so observability catches BFF shape drift instead of silent crash downstream.

## Verify
- [x] tsc, lint, build
- [x] `grep "as unknown as" app lib | grep -v test` → 0
- [x] Manual: valid+invalid paths

## Parallel coordination
- Safe with F1a/F1b/A1/E1 (isolated files)
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. 선택한 방식 (zod vs 수동 guard) + 선택 근거
4. CurrentUser 스키마 실제 필드 수
5. normalizer return type 변경이 upstream 에 요구한 수정 있었는지
6. Deviations with rationale

## Parallel coordination
- 파일 overlap **없음**:
  - F1a/F1b — 다른 파일
  - A1 — 다른 파일
  - E1 — `.ts` 파일 대상이 다름 (E1 은 .tsx 의 className)
- 전 병렬 안전
