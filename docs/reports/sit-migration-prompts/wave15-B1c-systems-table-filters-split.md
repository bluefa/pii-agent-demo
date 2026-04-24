# Wave 15-B1c — SystemsTableFilters Split + Icons Extraction

## Context
wave14-B1a (#345) 의 SystemsTable split 결과로 추출된 `SystemsTableFilters.tsx` 자체가 **322 LOC** 의 god-component. 내부에 inline SVG 4개 (SearchIcon, ChevronDownIcon, DownloadIcon, FilterIcon) + 다수 filter 하위 블록 포함.

## Audit baseline
- `app/components/features/dashboard/SystemsTableFilters.tsx`: 322 LOC
- Inline SVG: 4개 (L20–45 근처)
- Filter 블록: integration / status / svc_installed / 검색 / export

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
target="app/components/features/dashboard/SystemsTableFilters.tsx"
loc=$(wc -l < "$target")
svg=$(grep -c "<svg" "$target")
echo "LOC=$loc SVG=$svg (baselines 322/4+)"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave15-b1c-filters --prefix refactor
cd /Users/study/pii-agent-demo-wave15-b1c-filters
```

## Step 2: Required reading
1. `SystemsTableFilters.tsx` 전체
2. 소비처: `SystemsTable.tsx` 및 dashboard page
3. `app/components/ui/icons/` 기존 (SearchIcon / DownloadIcon 신규 후보)
4. `.claude/skills/anti-patterns/SKILL.md` §B1, §H1 (inline SVG)

## Step 3: Split + icons extraction

### 3-1. Icons → `app/components/ui/icons/`

4 개 inline SVG 를 icons module 로 이관:
```
app/components/ui/icons/SearchIcon.tsx
app/components/ui/icons/ChevronDownIcon.tsx      (이미 있으면 재사용)
app/components/ui/icons/DownloadIcon.tsx
app/components/ui/icons/FilterIcon.tsx
```

기존 icons module 규칙 준수 (props / size / className 시그니처).
`app/components/ui/icons/index.ts` 에 re-export 추가.

⚠️ 기존 동일 이름 컴포넌트 있을 수 있음 → grep 먼저 확인, 중복 안 되게.

### 3-2. Filters 하위 component 추출

```
app/components/features/dashboard/
├── SystemsTableFilters.tsx         (main, ≤ 150 LOC)
└── systems-table-filters/
    ├── constants.ts                (INTEGRATION_OPTIONS, STATUS_OPTIONS, SVC_INSTALLED_OPTIONS, DEFAULT_FILTERS)
    ├── IntegrationFilter.tsx       (integration dropdown)
    ├── StatusFilter.tsx
    ├── SvcInstalledFilter.tsx
    ├── SearchField.tsx             (search input + SearchIcon)
    ├── ExportButton.tsx            (+ DownloadIcon)
    └── index.ts
```

각 sub-filter 는 props 로 `value` + `onChange` 를 받는 controlled component.

### 3-3. Main LOC 목표

```
wc -l app/components/features/dashboard/SystemsTableFilters.tsx
# ≤ 150 (상단 import + props + 5 sub-filter 조립)
```

### 3-4. 기존 icons module 충돌 체크

```bash
ls app/components/ui/icons/
```

예: SearchIcon 이 이미 있으면 새로 만들지 말고 기존 재사용.

## Step 4: Do NOT touch
- `SystemsTable.tsx` 내부 (wave14-B1a 에서 수정 완료)
- Filter 로직 (onChange callback 흐름)
- 소비처 (대시보드 page)
- 다른 dashboard 파일

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/dashboard/
npm run build

wc -l app/components/features/dashboard/SystemsTableFilters.tsx  # ≤ 150
grep -c "<svg" app/components/features/dashboard/SystemsTableFilters.tsx  # 0
```

수동:
- 대시보드 페이지 filter bar 전체 동작 (integration / status / svc_installed / search / export)
- 아이콘 시각 회귀 없음 (SVG → icons module)

## Step 6: Commit + push + PR
```
git add app/components/features/dashboard/ app/components/ui/icons/
git commit -m "refactor(dashboard): split SystemsTableFilters + extract 4 icons (wave15-B1c)

Audit §B1 + §H1 동시 해결.

- 322 → ≤ 150 LOC main
- 5 sub-filter components (Integration/Status/SvcInstalled/Search/Export)
- 4 inline SVG → icons module (Search/ChevronDown/Download/Filter)
- constants.ts 공유 옵션
- No prop contract change"
git push -u origin refactor/wave15-b1c-filters
```

PR body (`/tmp/pr-wave15-b1c-body.md`):
```
## Summary
SystemsTableFilters (322 LOC) split + 4 inline SVG → icons module.

## Changes
- `systems-table-filters/` new (5 components + constants + index)
- `icons/{Search,ChevronDown,Download,Filter}Icon.tsx` (중복 안 되게)
- Main 322 → ≤ 150

## Deliberately excluded
- Filter callback logic
- SystemsTable.tsx (wave14-B1a 범위)
- Other dashboard files

## Parallel coordination
- Safe with C1 / B1a (AdminDashboard) / B1b (QueueBoard) / H1
```

## ⛔ Do NOT auto-merge
Stop at PR create.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. Main LOC before/after
4. 신규 icon 4개 vs 기존 재사용 내역
5. Sub-filter 간 공통 인터페이스 / 차이
6. Deviations with rationale
