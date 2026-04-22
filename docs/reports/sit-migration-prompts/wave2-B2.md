# Task B2 — GuideCard warm variant

## Context
Wave 2 parallel task. You create `GuideCard` (amber warm variant) and merge 7-step content into `process-guides.ts`. Existing guide components (`ProcessGuideStepCard`, `StepGuide`) are NOT removed — they coexist until B4.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
grep -q 'warmVariant' lib/theme.ts || { echo "✗ T1 warmVariant missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-b2-guide-card --prefix feat
cd /Users/study/pii-agent-demo-sit-b2-guide-card
```

## Step 2: Required reading
1. `docs/reports/sit-migration-todo-phase1.md` §B2
2. `docs/reports/sit-prototype-migration-plan.md` §3-5-d
3. `design/SIT Prototype.html` L576-640 (warm variant CSS), **L1453-1518 (7-step content HTML)**
4. `lib/constants/process-guides.ts` (current)
5. `lib/theme.ts` `cardStyles.warmVariant` (from T1)
6. `app/components/features/process-status/ProcessGuideStepCard.tsx`, `StepGuide.tsx` (reference)

## Step 3: Files

### New: `app/components/features/process-status/GuideCard.tsx`
```tsx
interface GuideCardProps {
  currentStep: ProcessStatus;
  provider: CloudProvider;
  installationMode?: 'AUTO' | 'MANUAL';  // AWS only
}
```
- Card container: `cardStyles.warmVariant.container`
- Header: `cardStyles.warmVariant.header` + small lightbulb icon + `가이드` title (`cardStyles.warmVariant.titleText`)
- Body typography: h4 `text-sm font-bold`, p `text-[13px]`, `<ul>` marker `text-primary`
- Fetch content via `getProcessGuide(provider, installationMode === 'AUTO' ? 'auto' : 'manual')` keyed by `currentStep`

### Modify: `lib/constants/process-guides.ts`
- Merge 7-step content from prototype L1453-1518 into the existing guide structure
- Add step 06 `관리자 승인 대기` entries (mapped to `CONNECTION_VERIFIED`)
- Dedupe overlapping content

## Step 4: Constraints
- Do NOT delete `ProcessGuideStepCard` or `StepGuide`
- Do NOT embed raw HTML strings from the prototype; restructure as JSX
- Preserve Korean labels

## Step 5: Verification
```
npm run type-check
npm run lint
```
Manual: render `GuideCard` with each of 7 `ProcessStatus` values; for AWS, also test `installationMode === 'AUTO'` and `'MANUAL'`.

## Step 6: Commit, push, PR
```
git add app/components/features/process-status/GuideCard.tsx lib/constants/process-guides.ts
git fetch origin main && git rebase origin/main
git commit -m "feat(process): GuideCard warm variant + 7-step content (B2)

New amber-toned guide card (prototype L576-640) to be adopted in B4.
7-step guide content (prototype L1453-1518) merged into process-guides.ts.
Existing ProcessGuideStepCard/StepGuide remain in place until B4.

Spec: docs/reports/sit-migration-todo-phase1.md §B2"
git push -u origin feat/sit-b2-guide-card
gh pr create --title "feat(process): GuideCard warm variant (B2)" --body "$(cat <<'EOF'
## Summary
Wave 2 — amber warm-variant GuideCard + 7-step content merge.

## New
- `GuideCard.tsx`
- `process-guides.ts` 7-step merge

## Test plan
- [x] 7 step renders
- [x] AWS AUTO/MANUAL branches

## Ref
- docs/reports/sit-migration-todo-phase1.md §B2
EOF
)"
```

## Step 7: Stop. Report URL.

## Parallel coordination
No collision.
