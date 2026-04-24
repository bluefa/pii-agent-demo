# H1 SVG Migration Plan

Inventory: [`h1-svg-migration-inventory.md`](./h1-svg-migration-inventory.md) (생성: 2026-04-24, target file 99 → real 71)

## 전략

1. **IDC/SDU 제외** — deprecated, 코드 제거 예정.
2. **Brand-asset catalogs 제외** (DatabaseIcon, AwsServiceIcon, CloudProviderIcon, GcpServiceIcon, AzureServiceIcon) — UI icon 카테고리와 다른 결의 자산. 별도 wave 에서 `brand-icons/` 분리 검토.
3. **Wave 분할** — 카테고리 별로 7~17 파일, 단일 PR 로 review 가능 크기.
4. 각 wave 는 독립 PR (parallelism 가능, 단 같은 파일 touch 시 충돌 주의 — 현재 wave 분할은 path-disjoint).
5. **`app/components/ui/icons/` 시그니처 일관성** — `IconProps = { className?, 'aria-label'? }`, `stroke="currentColor"` + `fill="none"` 외곽선 기본, viewBox 24×24 표준 (예외 시 spec 에 명시).
6. **재사용 우선** — wave 시작 시 신규 icon 후보 grep → 이미 `icons/` 에 있으면 재사용, 없으면 신설.

## Wave 분할

| Wave | 대상 | 파일 수 | SVG 수 | 신규 icon 후보 (대략) |
|------|------|--------:|-------:|----------------------|
| **wave15-H1a** | UI primitives (`app/components/ui/*`, non-brand) | 7 | 7 | XClose, ChevronDown, SortArrow, Spinner, Tooltip arrow |
| **wave15-H1b** | Layout (TopNav) + Dashboard (SystemsTable*, KpiCardGrid, headers, Pagination, SortIcon 승격) | 9 | 24 | Menu, Lock, Bell, Shield, Search, Download, Filter, CheckSmall, ChevronL/R |
| **wave15-H1c** | Admin (header, sidebar, infra) + Queue board (board, header, summary, 3 task tables) | 11 | 26 | ThumbsUp/Down, nav icons, ellipsis |
| **wave15-H1d** | Process status common + scan + `_components/common` (RejectionAlert, ErrorState) | 17 | 29 | Warning, Info, Clipboard*, ChevronRight, Spinner 재사용 |
| **wave15-H1e** | Process status 제공자 (AWS 5 + Azure 3 + GCP 3 + connection-test 4) | 15 | 28 | Provider 별 step indicator, History clock 등 |
| **wave15-H1f** | Resource table + Project create + 잡 (StepIndicator, ConnectionDetailModal, TerraformStatusModal, CredentialListTab, ConnectionHistoryTab) | 12 | 28 | StatusIcon 승격 + Database connector chevron 등 |
| **Sum** | | **71** | **142** | |
| **wave15-H1-cleanup** | drift / 잔여 + brand-icon 분리 결정 | TBD | TBD | — |

## 각 wave 진행 패턴

1. **Precondition**: `grep -rln "<svg" <대상 set>` 으로 inventory 와 일치 확인 (drift 검출).
2. **신규 icon 식별**: 대상 파일 안의 `<svg>` 패턴 추출 → `app/components/ui/icons/` 와 비교.
3. **신규 icon 생성**: `app/components/ui/icons/<Name>Icon.tsx` (types.ts 시그니처 준수) + `index.ts` 재정렬 export.
4. **치환**: 파일 내 `<svg>...</svg>` → `<Icon className="..." />`.
   - 색상은 부모 `text-*` 토큰 또는 prop 으로 전달 (`stroke="currentColor"` 활용).
   - 크기는 `className` 의 `w-* h-*` 로.
5. **중복 제거**: 같은 path 가 한 파일 내 N회 등장하면 컴포넌트 추출 1회 + N회 사용.
6. **검증**: `tsc --noEmit`, `lint`, dev server 시각 확인 (icon 모양/색/크기 회귀 확인).

## Parallel coordination

- H1a ↔ H1b: 둘 다 `components/ui/icons/index.ts` touch (export 추가) → 머지 충돌 가능. 한 wave 머지 후 다른 wave rebase 권장.
- H1d ↔ H1e: process-status 같은 디렉토리지만 file-disjoint → 안전.
- H1c queue-board ↔ wave15-B1b queue-board split: **충돌 위험** — B1b 머지 완료 확인 후 H1c 착수.
- H1b dashboard ↔ wave15-B1a dashboard slim / B1c filters split: **충돌 위험** — B1a/B1c 머지 후 H1b.

## 성공 기준 (전체 H1 종료 시)

```bash
grep -rln "<svg" app --include="*.tsx" | grep -v "components/ui/icons" | grep -viE '(idc|sdu)' | wc -l
# → 5 (brand catalogs 만 남음) — 이때 H1 본체 종료, brand 분리는 별 wave
```

## 이번 PR 에 포함되지 않는 것

- 어떤 코드 변경도 없음 — inventory + plan 만.
- 신규 icon 컴포넌트 작성 없음.
- `icons/index.ts` 변경 없음.

## 후속 wave 시작 전 재검증

이 plan 은 2026-04-24 시점 audit 기반. 후속 wave 시작 전:

```bash
# 1) 총 파일 수 확인
grep -rln "<svg" app --include="*.tsx" | wc -l

# 2) 카테고리 분포 재확인 — drift 있으면 inventory 보강
```

drift 시 해당 wave 의 spec 에 "actual baseline" 섹션 추가하고 진행.
