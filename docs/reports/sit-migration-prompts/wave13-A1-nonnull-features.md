# Wave 13-A1 — Feature-Code Non-Null Assertion Removal

## Context
Project: pii-agent-demo.
Audit §A1 🔴 (`!` non-null assertion). Total codebase: **39 sites** — **35 in `lib/api-client/mock/**`** (convention: auth middleware 이후 non-null 보장, 유지) vs **4 in feature code** (실제 런타임 리스크, 수정 대상).

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
# 4 사이트가 아직 존재하는지 확인
expected=4
actual=$(grep -rnE "[a-zA-Z0-9_)\]]\!\." app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "\!=" | wc -l | tr -d ' ')
[ "$actual" = "$expected" ] || { echo "✗ app/ non-null count drifted: expected $expected, got $actual"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave13-a1-nonnull --prefix refactor
cd /Users/study/pii-agent-demo-wave13-a1-nonnull
```

## Step 2: Required reading
1. `.claude/skills/anti-patterns/SKILL.md` §A1 (`!` 는 type system 을 속이는 약속)
2. 4 target 파일의 prop/type 정의 (runtime 에서 undefined 가능한지 판단)

## Step 3: Sites + replacement rationale

### Site 1: `app/components/features/process-status/ResourceTransitionPanel.tsx:85`
```tsx
기존 연동 리소스 ({oldResources!.length}개)
```
**컨텍스트**: prop 타입 검사 → `oldResources?: Resource[]` 인지 확인 필요.
**교체**: JSX 에서 이미 `{oldResources && oldResources.length > 0 && (...)}` 가드 안이면 `oldResources.length` 로 충분. 가드가 바깥이 아니면 `oldResources?.length ?? 0` 로.

### Site 2, 3: `app/components/features/process-status/ProcessGuideStepCard.tsx:170, 192`
```tsx
{step.prerequisiteGuides!.map((guide, idx) => (...))}
{step.prerequisites!.map((item, idx) => (...))}
```
**컨텍스트**: `step.prerequisiteGuides?: Guide[]`, `step.prerequisites?: string[]` 둘 다 optional 필드로 추정.
**교체**: 바깥 블록에 `{step.prerequisiteGuides && step.prerequisiteGuides.length > 0 && (...)}` 조건이 이미 있다면 `step.prerequisiteGuides.map(...)` (non-null narrow 된다면). 없으면 `step.prerequisiteGuides?.map(...)` 로 optional chain, `step.prerequisites?.map(...)` 도 동일.

### Site 4: `app/components/features/resource-table/ResourceRow.tsx:83`
```tsx
? resource.vmDatabaseConfig!.databaseType
```
**컨텍스트**: 삼항 조건부의 true 분기. 조건이 `resource.vmDatabaseConfig` 존재를 이미 보장하는지 확인.
**교체**: `resource.vmDatabaseConfig?.databaseType` (optional chain) + 삼항 조건 단순화. 만약 TS narrowing 이 이미 작동한다면 그냥 `!` 제거.

## Step 4: 결정 트리 (각 사이트별로 적용)

```
1. 해당 라인 주변 ±20 LOC 읽어 narrowing 조건 있는지 확인
   ├─ YES → `!` 제거 (TS 가 narrow 함)
   └─ NO → optional chain `?.` + fallback (`?? 0`, `?? []`, early return)

2. 만약 타입이 optional 인데 실제로는 항상 존재하는 invariant 라면
   → 타입 정의를 required 로 변경 (upstream 호출부 확인 후)
```

## Step 5: Do NOT touch
- `lib/api-client/mock/**` 의 35 사이트 (mock 경로의 auth narrowing, convention 허용)
- 테스트 파일의 의도적 `!` (있다면)
- JSX/styling/logic
- 4 파일 외의 파일

## Step 6: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/process-status/ResourceTransitionPanel.tsx \
                app/components/features/process-status/ProcessGuideStepCard.tsx \
                app/components/features/resource-table/ResourceRow.tsx
npm run build
```

### 최종 확인
```
grep -rnE "[a-zA-Z0-9_)\]]\!\." app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "\!=" | wc -l
# → 0 이어야 함
```

수동 검증:
- ProcessGuideStepCard: prerequisiteGuides/prerequisites 없는 step 에서 crash 없이 렌더
- ResourceTransitionPanel: oldResources undefined 일 때 정상 렌더
- ResourceRow: vmDatabaseConfig 없는 resource 행 정상 표시

## Step 7: Commit + push + PR

```
git add app/components/features/process-status/ResourceTransitionPanel.tsx \
        app/components/features/process-status/ProcessGuideStepCard.tsx \
        app/components/features/resource-table/ResourceRow.tsx
git commit -m "refactor(features): remove 4 non-null assertions (wave13-A1)

Audit §A1 🔴. mock/auth 경로의 35 사이트는 convention 허용으로 유지.

- ResourceTransitionPanel.tsx:85  oldResources! → ?.length ?? 0
- ProcessGuideStepCard.tsx:170   step.prerequisiteGuides! → ?. map
- ProcessGuideStepCard.tsx:192   step.prerequisites! → ?. map
- ResourceRow.tsx:83             vmDatabaseConfig! → ?.databaseType

No behavior change — optional values now gracefully degrade instead of
crashing when upstream delivers undefined."
git push -u origin refactor/wave13-a1-nonnull
```

PR body (`/tmp/pr-wave13-a1-body.md`):
```
## Summary
Remove 4 non-null assertions in feature components per audit §A1 🔴. 35 sites in `lib/api-client/mock/**` preserved (auth-narrowed convention).

## Sites fixed
- ResourceTransitionPanel.tsx:85
- ProcessGuideStepCard.tsx:170, 192
- ResourceRow.tsx:83

Each replaced with optional chaining + appropriate fallback (`?? 0`, `?? []`, or removed `!` where TS narrowing suffices).

## Verify
- [x] tsc, lint, build
- [x] `grep -rnE "[a-zA-Z0-9_)\]]\!\." app` → 0
- [x] Manual: undefined upstream scenarios don't crash

## Parallel coordination
- Safe in parallel with F1a/F1b/A2/E1 (no file overlap)
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. 각 사이트별 적용한 교체 패턴 (narrow vs optional-chain vs type 변경)
4. 타입 정의를 바꾼 경우 upstream 호출부 영향 요약
5. Deviations with rationale

## Parallel coordination
- 파일 overlap **없음**, F1a/F1b/A2/E1 과 병렬 안전
- 대상 파일이 E1 (array index key) 과 겹칠 가능성 있음:
  - `ProcessGuideStepCard.tsx` — E1 이 key={idx} 4곳 수정 대상
  - 동시에 돌리면 conflict 발생 → **순차 권장** (A1 먼저 merge 후 E1)
