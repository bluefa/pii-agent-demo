# Wave 15-H1 — Icons Migration Foundation (Inventory + Mapping)

## Context
Audit §H1 🔴 inline `<svg>`: **99 파일** (wave14 merge 후 증가). IDC/SDU 제외하고도 상당량 남음. 한번에 migration 불가 — **이 spec 은 inventory + mapping table 만** 작성. 실제 migration 은 wave15-H1a / H1b / ... 단계별 진행.

## Scope

이 PR 은 **코드 변경 없음**. 산출물:
1. `docs/reports/h1-svg-migration-inventory.md` — 99 파일 inventory
2. `docs/reports/h1-svg-migration-plan.md` — 단계별 migration wave 분할 계획

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
echo "Current inline <svg> files:"
grep -rln "<svg" app --include="*.tsx" 2>/dev/null | wc -l
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave15-h1-foundation --prefix docs
cd /Users/study/pii-agent-demo-wave15-h1-foundation
```

## Step 2: Inventory 작성

### 2-1. 파일별 SVG 카운트 + 분류

```bash
grep -rcn "<svg" app --include="*.tsx" 2>/dev/null | awk -F: '$2 > 0' | sort -t: -k2 -rn
```

각 파일마다:
- **경로**
- **SVG 개수**
- **분류**: icon (반복 사용 가능) / illustration (1회성) / chart (복잡)
- **IDC/SDU 여부** (사용자 요청: 제외 대상)

### 2-2. 기존 `app/components/ui/icons/` inventory

```bash
ls app/components/ui/icons/
```

이미 존재하는 icon 과 매핑. 새로 만들 icon 목록 구분.

### 2-3. 인벤토리 파일

`docs/reports/h1-svg-migration-inventory.md`:

```markdown
# H1 Inline SVG Inventory (as of <date>)

Total files with inline `<svg>`: **99**
IDC/SDU 제외 후: **<N>**

## Classification

### 카테고리별 파일 수
| Category | Files | SVG count | Notes |
|----------|-------|-----------|-------|
| Provider pages (AWS/Azure/GCP) | ... | ... | |
| Dashboard | ... | ... | |
| Queue board | ... | ... | |
| Process status (공통) | ... | ... | |
| UI primitives | ... | ... | |
| IDC/SDU | ... | ... | **제외 (deprecated)** |

### Per-file (non-deprecated only)
| File | Count | SVGs | Category | Reusable icon? |
|------|-------|------|----------|----------------|
| path:line | 1 | chevron-down | primitive | 기존 ChevronDownIcon 있음 |
| ... | | | | |

## Existing `app/components/ui/icons/` inventory

- Expand, Guide, StatusError, StatusInfo, StatusSuccess, StatusWarning, Copy, Delete, OpenExternal, (wave15-B1c 이후 추가 예상: Search, ChevronDown, Download, Filter)

## Duplicate / 유사 아이콘 후보

- (inventory 중에 동일 viewBox / path 발견되면 여기 기록)
```

## Step 3: Migration plan 작성

`docs/reports/h1-svg-migration-plan.md`:

```markdown
# H1 SVG Migration Plan

## 전략
1. IDC/SDU 는 제외 (deprecated)
2. 카테고리별로 wave 분할 — 각 wave 는 10–20 파일 목표
3. Wave 마다 /wave-task spec 1 개

## Wave 분할

| Wave | 대상 | 파일 수 | 신규 icon 필요 |
|------|------|---------|----------------|
| wave15-H1a | UI primitives (Modal, Badge 등) | ~10 | Close, Chevron* |
| wave15-H1b | Dashboard (SystemsTable, KpiCard) | ~8 | Download, ArrowUpDown |
| wave15-H1c | Provider pages AWS/Azure/GCP | ~15 | CloudProvider 아이콘 |
| wave15-H1d | Process status (공통) | ~12 | Step 관련 |
| wave15-H1e | Queue board | ~5 | ThumbsUp/Down |
| wave15-H1-cleanup | 잔여 | ~N | |

## 각 wave 진행 패턴
1. 대상 파일 set 정의
2. 각 inline SVG → icons module 내 컴포넌트와 매핑
3. 없는 icon 은 `icons/<Name>Icon.tsx` 신규 생성 (types.ts 시그니처 준수)
4. 파일 내 `<svg>...</svg>` → `<Icon .../>` 교체
5. 중복 icon 은 기존 재사용

## 이번 PR 은 코드 변경 없음

후속 wave 시작 전 이 inventory + plan 이 최신 상태인지 재검증 (audit drift 가능).
```

## Step 4: Do NOT touch
- 어떤 코드 파일도 수정 금지 (foundation spec)
- `app/components/ui/icons/` 실제 변경 없음
- 기존 다른 docs

## Step 5: Verify
```
# 코드 변경 없으므로 tsc/lint/build 생략 가능 (pre-commit hook 자동 skip)
wc -l docs/reports/h1-svg-migration-inventory.md
wc -l docs/reports/h1-svg-migration-plan.md
```

Inventory 가 99 전체 파일을 dealing 하는지 cross-check:
```bash
grep -rln "<svg" app --include="*.tsx" | wc -l
# → inventory 의 합계와 일치해야 함
```

## Step 6: Commit + push + PR
```
git add docs/reports/h1-svg-migration-inventory.md docs/reports/h1-svg-migration-plan.md
git commit -m "docs(h1): SVG migration inventory + wave plan (wave15-H1)

Audit §H1 (99 files) 체계적 migration 을 위한 foundation.

- Per-file inventory (category, svg count, reusable icon mapping)
- Wave 분할 계획 (H1a–H1e + cleanup)
- IDC/SDU 제외 (deprecated)
- 실제 code migration 은 후속 wave 에서"
git push -u origin docs/wave15-h1-foundation
```

PR body:
```
## Summary
Docs only. Inventory + migration plan for 99 inline-SVG files.

## Not in this PR
- No code changes
- Actual migrations happen in wave15-H1a..e

## Parallel coordination
- Fully docs-only → safe with all other wave15 specs
```

## ⛔ Do NOT auto-merge

## Return (under 150 words)
1. PR URL
2. 실제 IDC/SDU 제외 후 파일 수
3. 카테고리 분포 요약
4. 예상 신규 icon 수
5. Deviations with rationale
