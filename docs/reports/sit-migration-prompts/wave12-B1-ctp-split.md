# Wave 12-B1 — ConnectionTestPanel God-Component Split

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 12 follow-up to wave11-README deferred items. Splits the 667 LOC
`ConnectionTestPanel.tsx` into a main component + 7 co-located children.

Source: `app/components/features/process-status/ConnectionTestPanel.tsx`
- 667 LOC, 1 file
- 8 top-level components inside (1 exported main + 3 modals + 4 presentational)
- 3 modals imported synchronously even though each is conditionally rendered

Audit evidence (still valid on current main):
- `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §B (god-component threshold 400 LOC)
- `.claude/skills/anti-patterns/SKILL.md` §B1

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/features/process-status/ConnectionTestPanel.tsx ] || { echo "✗ CTP missing"; exit 1; }
wc -l app/components/features/process-status/ConnectionTestPanel.tsx | awk '{ if ($1 < 500) { print "✗ file shrank — rethink spec"; exit 1 } else print "✓" }'
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave12-b1-ctp-split --prefix refactor
cd /Users/study/pii-agent-demo-wave12-b1-ctp-split
```

## Step 2: Required reading
1. `app/components/features/process-status/ConnectionTestPanel.tsx` (all 667 LOC)
2. `.claude/skills/anti-patterns/SKILL.md` §B1, §B6, §D6
3. `/vercel-react-best-practices` §7 — `dynamic-imports-modals` 원칙
4. Existing consumer 2곳 (prop contract 확인):
   - `app/projects/[projectId]/idc/IdcProcessStatusCard.tsx` (lines 6, 326, 395)
   - `app/components/features/ProcessStatusCard.tsx` (lines 11, 289, 299)

## Step 3: Target structure

신규 폴더 `app/components/features/process-status/connection-test/`. **메인 파일은 그 폴더 밖에 유지**해 기존 import path 불변:

```
app/components/features/process-status/
├── ConnectionTestPanel.tsx           (main, target ≤ 250 LOC)
└── connection-test/
    ├── CredentialSetupModal.tsx      (≤ 180 LOC)
    ├── ResultDetailModal.tsx         (≤ 50 LOC)
    ├── TestConnectionHistoryModal.tsx (≤ 100 LOC)
    ├── HistoryJobCard.tsx            (≤ 50 LOC)
    ├── ProgressBar.tsx               (≤ 30 LOC)
    ├── ResourceResultRow.tsx         (≤ 40 LOC)
    ├── ResultSummary.tsx             (≤ 50 LOC)
    └── index.ts                       (re-exports)
```

### 3-1. 분할 매핑

현재 `ConnectionTestPanel.tsx` top-level declarations (확인 완료):

| 현 위치 (line) | 이동처 | 비고 |
|--------------|--------|------|
| L15 `TEXT_LINK_CLASS` | `ConnectionTestPanel.tsx` 유지 | 공용 string, 메인에서만 사용 |
| L28 `CredentialSetupModal` | `connection-test/CredentialSetupModal.tsx` | |
| L201 `ResultDetailModal` | `connection-test/ResultDetailModal.tsx` | |
| L246 `TestConnectionHistoryModal` | `connection-test/TestConnectionHistoryModal.tsx` | |
| L337 `HistoryJobCard` | `connection-test/HistoryJobCard.tsx` | |
| L382 `ProgressBar` | `connection-test/ProgressBar.tsx` | |
| L412 `ResourceResultRow` | `connection-test/ResourceResultRow.tsx` | |
| L450 `ResultSummary` | `connection-test/ResultSummary.tsx` | |
| L491 `export const ConnectionTestPanel` | `ConnectionTestPanel.tsx` 유지 | 외부 import path 불변 |

각 파일은:
- `'use client'` 지시자 포함
- 의존하는 타입 `import type` 로만 가져옴
- props는 `interface XxxProps` 로 파일 내부에 정의
- React memo 불필요 (추가하지 말 것 — 측정 없이 최적화 금지)

### 3-2. 3 modal dynamic import 화

메인 파일에서 3 modal 을 `next/dynamic` 으로 교체. 참고: `ProcessStatusCard.tsx` 이미 같은 패턴 사용 중.

```ts
import dynamic from 'next/dynamic';

const CredentialSetupModal = dynamic(
  () => import('./connection-test/CredentialSetupModal').then(m => ({ default: m.CredentialSetupModal })),
);
const ResultDetailModal = dynamic(
  () => import('./connection-test/ResultDetailModal').then(m => ({ default: m.ResultDetailModal })),
);
const TestConnectionHistoryModal = dynamic(
  () => import('./connection-test/TestConnectionHistoryModal').then(m => ({ default: m.TestConnectionHistoryModal })),
);
```

4 presentational children (`HistoryJobCard`, `ProgressBar`, `ResourceResultRow`, `ResultSummary`)은 일반 import 유지.

### 3-3. Magic timing `500` 교체 판단

L515 의 `setTimeout(() => setIsShaking(false), 500)` 은 A1 merged constants 에 대응 key 없음(`SHAKE_ANIMATION_MS` 단일 사용이라 제외됨). **교체 금지** — 단일 사용이므로 현행 유지, 이유 인라인 주석 불필요.

### 3-4. index.ts 생성

`connection-test/index.ts` — 모든 하위 컴포넌트 named re-export. 외부에서 하위 컴포넌트를 직접 import할 계기는 없지만, 향후 테스트에서의 접근성 확보.

### 3-5. 기존 export 유지

`app/components/features/process-status/index.ts` 의 `export { ConnectionTestPanel } from './ConnectionTestPanel'` 불변. 소비처 수정 불필요.

## Step 4: Do NOT touch
- 메인 `ConnectionTestPanel` 의 `Props` 인터페이스 (외부 계약)
- 2곳 consumer 파일 (`IdcProcessStatusCard.tsx`, `ProcessStatusCard.tsx`)
- Hook (`useTestConnectionPolling`) 계약
- API layer (`@/app/lib/api`)
- 하위 컴포넌트의 JSX/styling — **분할만** 하고 내용 재작성 금지
- 다른 process-status 파일 (aws/azure/gcp 하위, ApprovalRequestModal 등)

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/process-status/ConnectionTestPanel.tsx app/components/features/process-status/connection-test/
npm run build
```

모두 통과해야 함. Lint warning 개수는 불변 (분할만, 위반 도입 금지).

수동 검증:
- 메인 ConnectionTestPanel 렌더 → trigger 버튼 클릭 → 3 modal 중 하나가 열리는 시점까지 동작
- dynamic import 로 modal chunk 가 network 탭에 별도로 뜨는지 확인
- 이력 모달, 결과 상세 모달, credential 설정 모달 모두 open/close 동작

## Step 6: Commit + push + PR
```
git add app/components/features/process-status/ConnectionTestPanel.tsx \
        app/components/features/process-status/connection-test/
git commit -m "refactor(ctp): split ConnectionTestPanel into 7 children (wave12-B1)

Addresses audit §B (god-component >400 LOC).

- ConnectionTestPanel.tsx: 667 → ≤250 LOC (main only)
- New connection-test/ subfolder with 7 named children
- 3 modals → dynamic import (CredentialSetup, ResultDetail, History)
- 4 presentational children → regular import
- No prop contract change, no consumer modification, no logic change"
git push -u origin refactor/wave12-b1-ctp-split
```

PR body (write to `/tmp/pr-wave12-b1-body.md`):
```
## Summary

Splits `ConnectionTestPanel.tsx` (667 LOC god-component) into a lean
main + 7 co-located children under `connection-test/`. 3 modals become
dynamic imports, reducing main bundle.

## Why
- Audit §B threshold: 400 LOC → 현재 667
- 3 modals 는 conditionally rendered 이나 static import — bundle cost
- Top-level 8개 컴포넌트가 한 파일에 → scope 확인 부담

## Changes
- `ConnectionTestPanel.tsx` 667 → ≤250 LOC
- `connection-test/{CredentialSetupModal,ResultDetailModal,TestConnectionHistoryModal,HistoryJobCard,ProgressBar,ResourceResultRow,ResultSummary,index}.tsx` (new)
- Main 파일 내 3 modal → next/dynamic

## Deliberately excluded
- Prop contract, consumer 파일
- JSX/styling, 로직 재작성
- Hook 계약 (`useTestConnectionPolling`)
- `setTimeout(..., 500)` shake 타이머 (단일 사용, constant key 부재)

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Manual: trigger → 3 modal open/close
- [x] Dev tools network: modal chunk lazy-loaded

## Ref
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §B
- Skill: `.claude/skills/anti-patterns/SKILL.md` §B1, §B6
- Parallel: wave11-B1 (IdcResourceInputPanel), wave12-B3 (InstallationInline unify) — 파일 overlap 없음
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` / `build` results
3. Main file LOC before/after + 각 children LOC
4. 3 modal이 실제로 dynamic import 됐는지 확인
5. 분할 중 발견한 parent↔child 의존성 (의외라면 명시)
6. Deviations from spec with rationale

## Parallel coordination
- 파일 overlap **없음** 으로 아래와 병렬 안전:
  - `wave11-B1` (`app/components/features/idc/*`)
  - `wave12-B3` (`process-status/{aws,azure,gcp}/*InstallationInline.tsx`)
