# Wave 15-B1b — QueueBoard Split

## Context
`QueueBoard.tsx` = **331 LOC**. wave11-B2 (#302) 가 modal state 를 discriminated union 으로 압축했지만 main 파일 자체는 split 안 함. audit §B1 🔴.

## Audit baseline
- `app/components/features/queue-board/QueueBoard.tsx`: 331 LOC
- 이미 sibling files 존재: `QueueBoardHeader`, `CompletedTasksTable`, `QueueBoardSummaryCards` 등

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
target="app/components/features/queue-board/QueueBoard.tsx"
loc=$(wc -l < "$target")
echo "LOC=$loc (baseline 331)"
ls app/components/features/queue-board/
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave15-b1b-queue-board --prefix refactor
cd /Users/study/pii-agent-demo-wave15-b1b-queue-board
```

## Step 2: Required reading
1. `QueueBoard.tsx` 전체 331 LOC
2. Sibling files in `queue-board/` (이미 있는 것 파악)
3. wave11-B2 spec (#302) — discriminated union 구조
4. wave12-B1 (ConnectionTestPanel split) 패턴

## Step 3: 분석 + split 전략

### 3-1. 파일 구조 파악

먼저 읽어서 분석 (agent 가 수행):

```bash
cat app/components/features/queue-board/QueueBoard.tsx
ls app/components/features/queue-board/
```

예상 구조 (확인 필요):
- 상단: type/constants (TabKey, TAB_STATUS_MAP, PAGE_SIZE, ModalState, MODAL_CLOSED)
- 중단: handler 로직 (tab switch, modal open/close, action dispatch)
- 하단: JSX rendering (tabs + active-tab content + modals)

### 3-2. 분할 타겟

`queue-board/` 하위에 sub-components 추출:

```
app/components/features/queue-board/
├── QueueBoard.tsx                    (main, target ≤ 180 LOC)
├── constants.ts                       (TAB_STATUS_MAP, PAGE_SIZE — 공유 되지 않으면 main 유지)
├── QueueBoardTabs.tsx                 (tab strip + switch logic)
├── QueueBoardModals.tsx               (modal routing: ApproveModal / RejectModal / CompleteModal)
├── useQueueBoardData.ts               (페이지네이션 + filter 데이터 fetch 훅, 만약 해당 로직 있으면)
├── ... (기존 sibling 유지)
└── index.ts (기존 유지 / 업데이트)
```

실제 구조는 파일 읽은 후 확정. **설계 판단**:
- 3 tab (pending / processing / completed) 마다 render path 가 다르면 각 tab 을 component 로
- Modal dispatch 가 복잡하면 `QueueBoardModals` 로 routing 책임 이관

### 3-3. 훅 추출 판단

Fetch / polling 이 있으면 `useQueueBoardData` 로 추출. 없거나 간단하면 유지.

### 3-4. 공통 패턴 준수

- 새 파일마다 `'use client'` (client component)
- `import type` 로 타입만 가져올 것
- `cn()` 헬퍼 사용
- Provider modal 3 개가 conditional 이면 `next/dynamic` 고려 (but 이미 항상 mount 되는 간단 modal 이면 유지)

## Step 4: Do NOT touch
- QueueBoard 의 prop 계약
- 소비처 `app/integration/admin/queue/page.tsx` (추정, 확인)
- 승인/반려 API 로직
- 기존 sibling 파일 내부 로직 (필요 시 rename 만)
- 다른 admin 파일

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/queue-board/
npm run build

wc -l app/components/features/queue-board/QueueBoard.tsx  # ≤ 180
```

수동:
- Queue board 페이지 로드 → 3 tab 전환
- Approve / reject / complete modal full loop
- Pagination 동작
- 시각 회귀 없음

## Step 6: Commit + push + PR
```
git add app/components/features/queue-board/
git commit -m "refactor(queue-board): split QueueBoard into tabs + modals (wave15-B1b)

Audit §B1 — 331 LOC → ≤ 180 LOC main + new sub-components.

- QueueBoardTabs: tab strip + active content routing
- QueueBoardModals: approve/reject/complete modal dispatch
- (훅 추출이 가치 있으면 useQueueBoardData 도)
- No prop contract change"
git push -u origin refactor/wave15-b1b-queue-board
```

PR body (`/tmp/pr-wave15-b1b-body.md`):
```
## Summary
QueueBoard 331 LOC god-component split. wave12-B1 (ConnectionTestPanel) 패턴 재사용.

## Changes
- `queue-board/QueueBoardTabs.tsx`, `QueueBoardModals.tsx` (new)
- Main 331 → ≤ 180
- [훅 추출 여부는 PR body 에 명시]

## Deliberately excluded
- Prop contract, consumer
- Approve/reject/complete API logic
- Existing sibling components' internals

## Parallel coordination
- Safe with all other wave15 specs
```

## ⛔ Do NOT auto-merge
Stop at PR create.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. Main LOC + 새 파일 LOC
4. 훅 추출 여부 + 근거
5. Modal dynamic import 여부
6. Deviations with rationale
