# Task B1 — StepProgressBar 7-step

## Context
Wave 2 parallel task. You expand `StepProgressBar` from 6 steps to 7. `ProcessStatus` enum is NOT changed (I-04).

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
grep -q 'export const navStyles' lib/theme.ts || { echo "✗ T1 missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-b1-stepper --prefix feat
cd /Users/study/pii-agent-demo-sit-b1-stepper
```

## Step 2: Required reading
1. `docs/reports/sit-migration-todo-phase1.md` §B1
2. `docs/reports/sit-prototype-migration-plan.md` §3-5-c
3. `design/SIT Prototype.html` L1004-1030
4. `app/components/features/process-status/StepProgressBar.tsx` (current 6-step)
5. `lib/process.ts` `getProjectCurrentStep`

## Step 3: 7-step mapping

| # | Label | ProcessStatus |
|---|---|---|
| 01 | 연동 대상 DB 선택 | `WAITING_TARGET_CONFIRMATION` |
| 02 | 연동 대상 승인 대기 | `WAITING_APPROVAL` |
| 03 | 연동 대상 반영중 | `APPLYING_APPROVED` |
| 04 | Agent 설치 | `INSTALLING` |
| 05 | 연결 테스트 (N-IRP 연동) | `WAITING_CONNECTION_TEST` |
| 06 | 관리자 승인 대기 | `CONNECTION_VERIFIED` |
| 07 | 완료 | `INSTALLATION_COMPLETE` |

## Step 4: Visual changes
- Step circle: `w-8 h-8` → `w-10 h-10`
- Current step halo: `box-shadow: 0 0 0 4px rgba(0,100,255,0.15)`
- Numbers: zero-padded "01" … "07"
- Connector line: `h-0.5` → `h-[2px]`
- Clickable step: hover → `border-primary` + `text-primary`
- Keep `onGuideClick` prop

## Step 5: Constraints
- Do NOT modify `ProcessStatus` enum anywhere
- No raw hex — use `statusColors`, `primaryColors`
- Do NOT change the component's public signature (`currentStep`, `customSteps`, `onGuideClick`)
- Keep Korean labels as-is

## Step 6: Verification
```
npm run type-check
npm run lint
```
Manual: traverse all 7 `ProcessStatus` values via a mock `Project` and confirm the stepper renders correctly at each position. Verify callers (`ProcessStatusCard`, `StepGuide`) still work.

## Step 7: Commit, push, PR
```
git add app/components/features/process-status/StepProgressBar.tsx
git fetch origin main && git rebase origin/main
git commit -m "feat(process): StepProgressBar 7-step expansion (B1)

Per I-04, the ProcessStatus enum stays unchanged. Step 06 ('관리자 승인 대기')
is a label-only addition mapped to CONNECTION_VERIFIED.

- Circle 32 → 40px with current-step halo
- Zero-padded 01…07
- Connector 0.5 → 2px
- Clickable step hover states

Spec: docs/reports/sit-migration-todo-phase1.md §B1"
git push -u origin feat/sit-b1-stepper
gh pr create --title "feat(process): StepProgressBar 7-step (B1)" --body "$(cat <<'EOF'
## Summary
Wave 2 — 6 → 7 steps. Enum-stable per I-04 (label-only addition).

## Visual
- Circle 40px + halo
- Zero-padded numbers
- Connector 2px

## Test plan
- [x] All 7 ProcessStatus values render correctly
- [x] ProcessStatusCard and StepGuide callers intact

## Ref
- docs/reports/sit-migration-todo-phase1.md §B1
EOF
)"
```

## Step 8: Stop. Report URL.

## Parallel coordination
Single-file change; no collision.
