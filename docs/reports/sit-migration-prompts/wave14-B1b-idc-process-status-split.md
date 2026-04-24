# Wave 14-B1b — IdcProcessStatusCard God-Component Split

## Context
Audit §B1 🔴. `app/integration/target-sources/[targetSourceId]/_components/idc/IdcProcessStatusCard.tsx` = **405 LOC**. 이미 파일 내부에 5 개 명명된 subcomponent 가 있어 split 난이도 낮음.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
target="app/integration/target-sources/[targetSourceId]/_components/idc/IdcProcessStatusCard.tsx"
[ -f "$target" ] || { echo "✗ $target not found"; exit 1; }
expected=405
actual=$(wc -l < "$target")
[ "$actual" = "$expected" ] || echo "⚠️ LOC drift: $actual (expected $expected)"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave14-b1b-idc-process-split --prefix refactor
cd /Users/study/pii-agent-demo-wave14-b1b-idc-process-split
```

## Step 2: Required reading
1. 전체 405 LOC 읽기
2. 소비처: `grep -rln "IdcProcessStatusCard" app --include="*.tsx"` — prop 계약 확인 (recent projid-w3 이후 소비처 경로 변경됐을 수 있음)
3. wave12-B1 결과 (`connection-test/` 폴더 패턴)
4. `.claude/skills/anti-patterns/SKILL.md` §B1

## Step 3: Target structure

```
app/integration/target-sources/[targetSourceId]/_components/idc/
├── IdcProcessStatusCard.tsx         (main, target ≤ 180 LOC)
└── process-status/
    ├── IdcStepProgressBar.tsx        (L17–82, ~66 LOC)
    ├── IdcStepGuide.tsx              (L83–136, ~54 LOC)
    ├── FirewallGuide.tsx             (L176–265, ~90 LOC, + extractFirewallRules helper)
    ├── IdcInstallationStatusDisplay.tsx (L266–335, ~70 LOC)
    ├── constants.ts                   (idcSteps, BDC_SERVER_IP, FirewallRule type)
    └── index.ts                       (re-exports)
```

### 3-1. 분할 매핑

| 현 위치 (line) | 이동처 | 비고 |
|---------------|--------|------|
| L10–16 `idcSteps` | `process-status/constants.ts` | 공유 |
| L17–82 `IdcStepProgressBar` | `process-status/IdcStepProgressBar.tsx` | |
| L83–136 `IdcStepGuide` | `process-status/IdcStepGuide.tsx` | |
| L137 `BDC_SERVER_IP` | `process-status/constants.ts` | FirewallGuide 에서만 사용 → 해당 파일 내부로 옮겨도 OK |
| L140–145 `FirewallRule` interface | `process-status/constants.ts` 또는 FirewallGuide 내부 | 판단 |
| L146–175 `extractFirewallRules` | `process-status/FirewallGuide.tsx` 내부 helper | 파일 외 사용 없으면 |
| L176–265 `FirewallGuide` | `process-status/FirewallGuide.tsx` | |
| L266–335 `IdcInstallationStatusDisplay` | `process-status/IdcInstallationStatusDisplay.tsx` | |
| L336–347 `IdcProcessStatusCardProps` | `IdcProcessStatusCard.tsx` 유지 | main 전용 |
| L348–end `IdcProcessStatusCard` export | `IdcProcessStatusCard.tsx` 유지 | main |

### 3-2. 폴더명 충돌 주의

**주의**: `app/components/features/process-status/` 이미 존재 (상위 프로세스 상태 공용 컴포넌트). 이번 신규 폴더는 `_components/idc/process-status/` 로 경로가 중첩되지만 물리 경로가 달라 import 충돌 없음. 단 `@/` 절대경로로 쓸 때 혼동 최소화를 위해 **`idc-process-status/` 로 rename 권장**:

```
idc/
├── IdcProcessStatusCard.tsx
└── idc-process-status/
    ├── IdcStepProgressBar.tsx
    ...
```

판단: `@/app/integration/target-sources/[targetSourceId]/_components/idc/idc-process-status/IdcStepProgressBar` 가 명확. 본 spec 에서는 `idc-process-status/` 사용.

### 3-3. `setCopied` 2000ms (L200)

main 에 남는 `setTimeout(() => setCopied(false), 2000)` 는 wave11-A1 의 `TIMINGS.TOAST_HIDE_MS` 와 값 일치. 교체:
```ts
import { TIMINGS } from '@/lib/constants/timings';
setTimeout(() => setCopied(false), TIMINGS.TOAST_HIDE_MS);
```

(spec scope 확장이지만 grep-fixable 1-line, 합쳐도 무관)

### 3-4. index.ts

```ts
export { IdcStepProgressBar } from './IdcStepProgressBar';
export { IdcStepGuide } from './IdcStepGuide';
export { FirewallGuide } from './FirewallGuide';
export { IdcInstallationStatusDisplay } from './IdcInstallationStatusDisplay';
export { idcSteps, BDC_SERVER_IP } from './constants';
export type { FirewallRule } from './constants';
```

## Step 4: Do NOT touch
- main `IdcProcessStatusCard` 의 prop 계약
- 소비처 파일
- JSX/styling 내부 변경
- API layer
- 다른 `_components/idc/` 파일

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/integration/target-sources/[targetSourceId]/_components/idc/
npm run build
```

수동 검증:
- IDC 프로세스 상태 카드 모든 단계 렌더 확인 (progress bar, guide, firewall, installation status)
- 복사 버튼 동작 (2000ms 후 해제)
- Firewall rules 테이블 정상 표시

## Step 6: Commit + push + PR

```
git add app/integration/target-sources/[targetSourceId]/_components/idc/
git commit -m "refactor(idc): split IdcProcessStatusCard into 4 children (wave14-B1b)

Audit §B1 — 405 LOC god-component 분할.

- IdcProcessStatusCard.tsx: 405 → ≤ 180 LOC
- idc-process-status/{IdcStepProgressBar,IdcStepGuide,FirewallGuide,IdcInstallationStatusDisplay,constants,index}.tsx
- setTimeout 2000ms → TIMINGS.TOAST_HIDE_MS (drive-by 1-line)
- No prop contract change, no consumer modification"
git push -u origin refactor/wave14-b1b-idc-process-split
```

PR body (`/tmp/pr-wave14-b1b-body.md`):
```
## Summary
Splits `IdcProcessStatusCard.tsx` (405 LOC) into main + 4 children under `idc-process-status/`. Pattern follows wave12-B1 (ConnectionTestPanel).

## Changes
- main 405 → ≤ 180 LOC
- idc-process-status/ new with 4 components + constants + index
- Drive-by: copy-feedback 2000ms → TIMINGS.TOAST_HIDE_MS

## Deliberately excluded
- Prop contract, consumer files
- JSX/rendering logic
- API layer

## Verify
- [x] tsc, lint, build
- [x] Manual: all step rendering, copy button, firewall rules

## Parallel coordination
- Safe with B1a, B1c, C1, E1b
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. LOC before/after main + 각 children LOC
4. 폴더명 선택 (idc-process-status vs process-status) 근거
5. Drive-by TIMINGS 교체 확인
6. Deviations with rationale

## Parallel coordination
- **파일 overlap 없음** 으로 wave14-B1a/B1c/C1/E1b 와 병렬 안전
