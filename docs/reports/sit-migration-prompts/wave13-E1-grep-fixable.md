# Wave 13-E1 — Array Index Keys + Template className Bulk Cleanup

## Context
Project: pii-agent-demo.
Audit §E1 🟡 array index as key (**19 sites**) + §E5 🟢 template-literal `className` (**57 sites**). Two grep-fixable/reviewable bulk cleanups bundled into one PR.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
e1=$(grep -rnE "key=\{(index|i|idx)\}" app --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
e5=$(grep -rnE 'className=\{`[^`]*\$\{' app --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "E1=$e1 E5=$e5 (baselines 19/57)"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave13-e1-grep-fixable --prefix refactor
cd /Users/study/pii-agent-demo-wave13-e1-grep-fixable
```

## Step 2: Required reading
1. `.claude/skills/anti-patterns/SKILL.md` §E1 (index-as-key breaks reconciliation when list reorders/filters), §E5 (template className defeats `cn()` type safety)
2. `lib/theme.ts` — `cn()` helper signature
3. React 문서 key 섹션 — "Which key should I use?"

## Step 3: Two sub-scopes in one PR

### 3-1. E1 — Array index keys (19 sites)

**Per-site review required** (not pure grep-fix). Split into:

**(a) Stable list / skeleton (OK to keep index — 2 sites)**:
| 파일 | 근거 |
|------|------|
| `SystemsTable.tsx:399` `<SkeletonRow key={i} />` | 고정 개수 skeleton, reorder 없음 |
| `KpiCardGrid.tsx:60` `<SkeletonCard key={i} />` | 동일 |

이 2 건은 코멘트 추가(`// static skeleton — index key OK`) 후 유지.

**(b) Stable id 있음 — 교체 (예상 ~10 sites)**:
| 파일:line | 제안 key |
|-----------|---------|
| `IdcProcessStatusCard.tsx:251` `<tr key={idx}>` | row 의 고유 id 확인 |
| `ConnectionDetailModal.tsx:102` `<tr key={index}>` | row 데이터의 id/resourceId |
| `IdcPendingResourceList.tsx:39` `<tr key={index}>` | resourceId |
| `IdcResourceInputPanel.tsx:209` `<div key={index}>` | IP row — wave11-B1 의 ip row action 과 연관, stable id 도입 검토 |
| `ProcessGuideStepCard.tsx:54,75,92,172,193,210,227,244` | guide item 의 content hash 또는 `${step.id}-${idx}` 조합 (static content 면 index 유지도 가능, 판단) |
| `GuideCard.tsx:21,24,30,75` | inline part rendering — content-based key or keep if static |

판단 매트릭스:
```
해당 list 가 사용자 조작으로 reorder/filter/delete 가능?
├─ YES → stable id 필수 (db id, resourceId 등)
└─ NO  → index 유지 가능 (+ 주석으로 명시)
```

**(c) Insertable/deletable rows (예상 ~4-7 sites)**:
위 리스트 중 IdcResourceInputPanel 의 IP list (handleAddIp/handleRemoveIp 가능) — **필수 stable id**. `crypto.randomUUID()` 를 IP entry 생성 시 부여, state 에 `{ id, value }` 저장. 단, wave11-B1 의 FormState 구조와 연결되므로 **이 spec 은 key 만 바꾸지 않고 state 변경이 필요함을 명시하고 해당 site 는 Deferred** 로 분리.

### 3-2. E5 — Template literal `className` (57 sites)

순수 패턴 교체. 단, 변수 interpolation 이 없는 간단한 template 은 그대로 문자열로 바꿈.

패턴 A (변수 없음 — 문자열화):
```tsx
// Before
className={`rounded-lg p-4 bg-white`}
// After
className="rounded-lg p-4 bg-white"
```

패턴 B (변수 1개 + 조건 — `cn()` 교체):
```tsx
// Before
className={`min-h-screen ${bgColors.muted}`}
// After
className={cn('min-h-screen', bgColors.muted)}
```

패턴 C (조건부 클래스 — `cn()` + 조건 표현식):
```tsx
// Before
className={`rounded border bg-white ${selected ? 'font-semibold' : ''}`}
// After
className={cn('rounded border bg-white', selected && 'font-semibold')}
```

**Bulk workflow**:
1. `grep -rnE 'className=\{\`[^\`]*\$\{' app --include="*.tsx"` 로 전체 리스트 생성
2. 파일별로 열어 각 케이스 분류 (A/B/C)
3. `cn` 이 import 안 돼 있으면 `import { cn } from '@/lib/theme';` 추가
4. 교체 후 시각적 회귀 없음 확인

### 3-3. 파일 목록 예상 중복

- `AdminDashboard.tsx` — E5 가능성 높음, F1b 와 충돌 가능
- `IdcProjectPage.tsx` / `SduProjectPage.tsx` — F1b 에서 alert 제거와 충돌 가능

→ 이 spec 은 **F1b merge 후 실행** (순차)

## Step 4: Do NOT touch
- JSX 구조, Tailwind 클래스 값 자체 (오타 수정 제외)
- key replacement 시 data fetching / state structure 변경 (위 IdcResourceInputPanel IP list 같은 state 변경 필요 케이스는 Deferred)
- 테스트 파일
- Non-`.tsx` 파일 (className 은 tsx 만)

## Step 5: Verify
```
npx tsc --noEmit
npm run lint   # full lint — E5 교체가 문법 오류 없는지
npm run build
```

최종 확인:
```
grep -rnE "key=\{(index|i|idx)\}" app --include="*.tsx" 2>/dev/null | wc -l
# → 2 (skeleton 만 남음)
grep -rnE 'className=\{`[^`]*\$\{' app --include="*.tsx" 2>/dev/null | wc -l
# → 0 (전체 교체)
```

수동 회귀:
- 3-4 개 대표 화면에서 시각 회귀 없음 확인 (Idc/Sdu/Gcp/Admin 대시보드)
- ProcessGuideStepCard 가이드 표시 정상

## Step 6: Commit + push + PR

```
git add app/
git commit -m "refactor(style): array index keys + template className cleanup (wave13-E1)

Audit §E1 (17/19 stable-id 교체, 2/19 skeleton 유지) + §E5 (57 template
className → cn() helper / 문자열 상수).

- E1 교체: ~17 사이트 (stable id 또는 content-based key)
- E1 유지: SystemsTable:399, KpiCardGrid:60 (fixed skeleton, 주석 추가)
- E1 Deferred: IdcResourceInputPanel:209 (state 구조 변경 필요 → wave13-E1b)
- E5 교체: 57 사이트 — cn() 또는 리터럴 문자열

No visual regression. Import cn where needed."
git push -u origin refactor/wave13-e1-grep-fixable
```

PR body (`/tmp/pr-wave13-e1-body.md`):
```
## Summary

Audit §E1 (array index key) + §E5 (template className) bulk cleanup.

## Changes
- **E1**: 19 sites → 17 replaced with stable id, 2 retained (skeleton lists)
- **E5**: 57 sites → `cn()` helper or plain string literal
- **Deferred**: IdcResourceInputPanel IP row (requires state-shape change with stable row id — separate spec wave13-E1b if pursued)

## Key decision matrix
- Reorderable/filterable list → stable domain id (resourceId, historyId, 등)
- Fixed-size skeleton → retain index + explanatory comment
- State-driven insertion/deletion → **spec deferred** (scope 초과)

## Verify
- [x] tsc, lint, build
- [x] grep counts match (2 index keys, 0 template className)
- [x] 4 대표 화면 시각 회귀 없음

## Dependencies
- Run AFTER wave13-F1b (project page 파일 충돌 회피)
- Run AFTER wave13-A1 (ProcessGuideStepCard 파일 충돌 회피)
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. 실제 교체 건수 (E1: 17+2 retained+1 deferred, E5: 57 전부)
4. Deferred sites 의 후속 spec 필요 여부
5. `cn()` import 추가 파일 수
6. 시각 회귀 확인한 화면 목록
7. Deviations with rationale

## Parallel coordination
- **Depends on (merge 순서)**:
  - wave13-F1b merged (project page 충돌 회피)
  - wave13-A1 merged (ProcessGuideStepCard 충돌 회피)
- **Safe parallel**: wave13-A2 (다른 파일군)
- **권장 위치**: Wave 13 batch 3 (마지막)
