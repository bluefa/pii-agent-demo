# H1 Inline SVG Inventory (as of 2026-04-24)

Total files with inline `<svg>`: **99**
Total `<svg>` occurrences: **207**

After exclusions (icons module + IDC/SDU + brand catalogs):

| Bucket | Files | SVGs | Note |
|--------|-------|------|------|
| `app/components/ui/icons/*` | 9 | 9 | **Destination** — these are the icon module itself |
| IDC/SDU 경로 | 14 | 35 | **Excluded (deprecated)** |
| Brand-asset catalogs (DB/Provider 로고) | 5 | 21 | **Defer** — see §Brand catalogs |
| **Real migration targets** | **71** | **142** | Subject of wave15-H1a..g |

## Classification

### 카테고리별 파일 수 (real targets only)

| Category | Files | SVGs | Wave |
|----------|-------|-----:|------|
| UI primitives (`app/components/ui/*`, non-brand) | 7 | 7 | H1a |
| Layout + Dashboard | 9 | 24 | H1b |
| Admin + Queue board | 11 | 26 | H1c |
| Process status — common + scan + `_components/common` | 17 | 29 | H1d |
| Process status — providers (AWS/Azure/GCP/connection-test) | 15 | 28 | H1e |
| Resource table + Project create + misc | 12 | 28 | H1f |
| **Sum** | **71** | **142** | |

### Existing `app/components/ui/icons/` inventory

```
CopyIcon, DeleteIcon, ExpandIcon, GuideIcon, OpenExternalIcon,
StatusErrorIcon, StatusInfoIcon, StatusSuccessIcon, StatusWarningIcon
```

`types.ts`: `IconProps = { className?: string; 'aria-label'?: string }`
Existing pattern: `aria-hidden={!rest['aria-label']}`, `stroke="currentColor"`, `fill="none"` for outline icons.

### 신규 icon 후보 (sample — full mapping deferred to each wave spec)

Recurring across many files; H1a–H1g 동안 점진 추가:

| Icon name | 사용 위치 (sample) | 비고 |
|-----------|-------------------|------|
| `ChevronDownIcon` | SystemsTableFilters, Pagination, CollapsibleSection 등 | rotate-180 으로 Up 겸용 |
| `ChevronRightIcon` | StepGuide, ProcessGuideStepCard 등 | rotate-90 으로 Down 겸용 |
| `SearchIcon` | SystemsTableFilters | |
| `DownloadIcon` | SystemsTableFilters | |
| `FilterIcon` / `SortIcon` | SystemsTableFilters, systems-table/SortIcon | dashboard/systems-table/SortIcon.tsx 자체가 components/ui/icons 로 승격 candidate |
| `CheckSmallIcon` | SystemsTableFilters checkbox indicator | StatusSuccessIcon 과 viewBox 다름 |
| `MenuIcon` (햄버거) | TopNav | |
| `LockIcon` | TopNav | |
| `BellIcon` | TopNav | |
| `ShieldIcon` | TopNav | |
| `ClipboardCheckIcon` | ProcessGuideStepCard ("사전 조치") | |
| `WarningIcon` | ProcessGuideStepCard, 다수 — **StatusWarningIcon 과 중복 검토** | viewBox 동일 시 alias |
| `InfoIcon` | ProcessGuideStepCard, 다수 — **StatusInfoIcon 과 중복 검토** | viewBox 동일 시 alias |
| `ThumbsUpIcon` / `ThumbsDownIcon` | QueueBoardSummaryCards | |
| `SpinnerIcon` | LoadingSpinner, ScanRunningState | `animate-spin` wrap |
| `XCloseIcon` | Modal close 등 | |

> 각 wave spec 에서 해당 wave 가 다루는 파일들을 grep 해서 신규 icon 목록을 확정한 뒤 `icons/<Name>Icon.tsx` 생성.

## Per-file (real targets, 71)

> `count` = `<svg` occurrences in the file. `wave` = 권장 처리 wave.

### H1a — UI primitives (7 files)

| File | Count | Notes |
|------|------:|-------|
| `app/components/ui/Modal.tsx` | 1 | Close X |
| `app/components/ui/Tooltip.tsx` | 1 | arrow polygon |
| `app/components/ui/Table.tsx` | 1 | sort indicator |
| `app/components/ui/toast/Toast.tsx` | 1 | status (재사용 검토: StatusSuccess/Error/Info) |
| `app/components/ui/LoadingSpinner.tsx` | 1 | spinner |
| `app/components/ui/HistoryTable/HistoryTable.tsx` | 1 | empty/sort |
| `app/components/ui/CollapsibleSection.tsx` | 1 | chevron |

### H1b — Layout + Dashboard (9 files)

| File | Count | Notes |
|------|------:|-------|
| `app/components/layout/TopNav.tsx` | 4 | Menu, Lock, Bell, Shield |
| `app/integration/admin/dashboard/page.tsx` | 2 | header decorations |
| `app/components/features/AdminDashboard.tsx` | 2 | header decorations |
| `app/components/features/dashboard/SystemsTable.tsx` | 1 | sort/empty |
| `app/components/features/dashboard/SystemsTableFilters.tsx` | 5 | Search, ChevronDown, Download, Filter, Check |
| `app/components/features/dashboard/KpiCardGrid.tsx` | 3 | metric icons |
| `app/components/features/dashboard/DashboardHeader.tsx` | 3 | header icons |
| `app/components/features/dashboard/systems-table/SortIcon.tsx` | 2 | up/down — **승격 후보** (icons/SortIcon) |
| `app/components/features/dashboard/systems-table/Pagination.tsx` | 2 | chevron L/R |

### H1c — Admin + Queue board (11 files)

| File | Count | Notes |
|------|------:|-------|
| `app/components/features/admin/AdminHeader.tsx` | 2 | |
| `app/components/features/admin/ServiceSidebar.tsx` | 5 | nav icons |
| `app/components/features/admin/infrastructure/InfraCardHeader.tsx` | 3 | |
| `app/components/features/admin/infrastructure/ManagementSplitButton.tsx` | 2 | chevron + ellipsis |
| `app/components/features/admin/infrastructure/InfrastructureEmptyState.tsx` | 1 | empty illustration |
| `app/components/features/queue-board/QueueBoard.tsx` | 1 | |
| `app/components/features/queue-board/QueueBoardHeader.tsx` | 4 | |
| `app/components/features/queue-board/QueueBoardSummaryCards.tsx` | 5 | thumbs up/down + status |
| `app/components/features/queue-board/PendingTasksTable.tsx` | 1 | |
| `app/components/features/queue-board/ProcessingTasksTable.tsx` | 1 | |
| `app/components/features/queue-board/CompletedTasksTable.tsx` | 1 | |

### H1d — Process status (common) + Scan + t-s common (17 files)

| File | Count | Notes |
|------|------:|-------|
| `app/components/features/process-status/ProcessGuideStepCard.tsx` | 9 | **largest** — 사전조치/수행절차/주의/참고 — 다수 재사용 |
| `app/components/features/process-status/ProcessGuideTimeline.tsx` | 1 | |
| `app/components/features/process-status/StepGuide.tsx` | 3 | |
| `app/components/features/process-status/StepProgressBar.tsx` | 1 | |
| `app/components/features/process-status/MissingCredentialsTab.tsx` | 1 | |
| `app/components/features/process-status/ResourceTransitionPanel.tsx` | 1 | |
| `app/components/features/process-status/ApprovalWaitingCard.tsx` | 1 | |
| `app/components/features/process-status/ApprovalApplyingBanner.tsx` | 1 | |
| `app/components/features/process-status/ApprovalRequestDetailModal.tsx` | 1 | |
| `app/components/features/process-status/CancelApprovalModal.tsx` | 1 | |
| `app/components/features/scan/ScanEmptyState.tsx` | 1 | |
| `app/components/features/scan/ScanErrorState.tsx` | 2 | |
| `app/components/features/scan/ScanRunningState.tsx` | 1 | spinner |
| `app/components/features/scan/ScanResultSummary.tsx` | 1 | |
| `app/components/features/scan/DbSelectionCard.tsx` | 2 | |
| `app/integration/target-sources/[targetSourceId]/_components/common/RejectionAlert.tsx` | 1 | |
| `app/integration/target-sources/[targetSourceId]/_components/common/ErrorState.tsx` | 1 | |

### H1e — Process status providers (AWS/Azure/GCP/connection-test) (15 files)

| File | Count | Notes |
|------|------:|-------|
| `app/components/features/process-status/aws/AwsInstallModeCard.tsx` | 1 | |
| `app/components/features/process-status/aws/AwsInstallationModeSelector.tsx` | 1 | |
| `app/components/features/process-status/aws/AwsInstallationInline.tsx` | 2 | |
| `app/components/features/process-status/aws/TfRoleGuideModal.tsx` | 4 | |
| `app/components/features/process-status/aws/TfScriptGuideModal.tsx` | 3 | |
| `app/components/features/process-status/azure/AzureInstallationInline.tsx` | 2 | |
| `app/components/features/process-status/azure/AzurePeApprovalGuide.tsx` | 2 | |
| `app/components/features/process-status/azure/AzureSubnetGuide.tsx` | 2 | |
| `app/components/features/process-status/gcp/GcpInstallationInline.tsx` | 1 | |
| `app/components/features/process-status/gcp/GcpStepSummaryCard.tsx` | 2 | |
| `app/components/features/process-status/gcp/GcpResourceStatusTable.tsx` | 2 | |
| `app/components/features/process-status/connection-test/CredentialSetupModal.tsx` | 2 | |
| `app/components/features/process-status/connection-test/ResultDetailModal.tsx` | 2 | |
| `app/components/features/process-status/connection-test/TestConnectionHistoryModal.tsx` | 1 | |
| `app/components/features/process-status/connection-test/HistoryJobCard.tsx` | 1 | |

### H1f — Resource table + Project create + misc (12 files)

| File | Count | Notes |
|------|------:|-------|
| `app/components/features/resource-table/StatusIcon.tsx` | 5 | **승격 후보** — 자체가 icon catalog |
| `app/components/features/resource-table/ResourceRow.tsx` | 1 | |
| `app/components/features/resource-table/EmptyState.tsx` | 1 | |
| `app/components/features/resource-table/VnetIntegrationGuideModal.tsx` | 2 | |
| `app/components/features/resource-table/VmDatabaseConfigPanel.tsx` | 2 | |
| `app/components/features/ProjectCreateModal.tsx` | 1 | |
| `app/components/features/project-create/StagedInfraTable.tsx` | 1 | |
| `app/components/features/StepIndicator.tsx` | 1 | |
| `app/components/features/ConnectionDetailModal.tsx` | 6 | |
| `app/components/features/TerraformStatusModal.tsx` | 5 | |
| `app/components/features/CredentialListTab.tsx` | 2 | |
| `app/components/features/ConnectionHistoryTab.tsx` | 1 | |

## Excluded — IDC/SDU (14 files, 35 SVGs) — deprecated

```
app/integration/target-sources/[targetSourceId]/_components/sdu/SduProcessStatusCard.tsx (6)
app/components/features/idc/IdcResourceInputPanel.tsx (5)
app/components/features/idc/IdcResourceTable.tsx (1)
app/components/features/idc/IdcPendingResourceList.tsx (1)
app/components/features/sdu/IamUserManageModal.tsx (4)
app/components/features/sdu/SduInstallationProgress.tsx (3)
app/components/features/sdu/SourceIpManageModal.tsx (2)
app/components/features/sdu/SduSetupGuideModal.tsx (2)
app/components/features/sdu/SduAthenaTableList.tsx (1)
app/integration/target-sources/[targetSourceId]/_components/idc/IdcProjectPage.tsx (2)
app/integration/target-sources/[targetSourceId]/_components/idc/idc-process-status/FirewallGuide.tsx (3)
app/integration/target-sources/[targetSourceId]/_components/idc/idc-process-status/IdcStepGuide.tsx (2)
app/integration/target-sources/[targetSourceId]/_components/idc/idc-process-status/IdcInstallationStatusDisplay.tsx (2)
app/integration/target-sources/[targetSourceId]/_components/idc/idc-process-status/IdcStepProgressBar.tsx (1)
```

## Brand catalogs — defer (5 files, 21 SVGs)

이 파일들은 단일 `<Icon>` 컴포넌트가 아니라 **brand-asset 카탈로그** (prop 으로 종류 분기). UI icon 모듈로 합치기보다 별도 `brand-icons/` 디렉토리 검토 권장 — H1 scope 외.

```
app/components/ui/DatabaseIcon.tsx (6)        — MySQL/Postgres/Oracle 등 DB 로고
app/components/ui/AwsServiceIcon.tsx (6)      — AWS 서비스 로고 카탈로그
app/components/ui/CloudProviderIcon.tsx (5)   — AWS/Azure/GCP/IDC/SDU 로고
app/components/ui/GcpServiceIcon.tsx (3)      — GCP 서비스 로고
app/components/ui/AzureServiceIcon.tsx (1)    — Azure 서비스 로고
```

## Duplicate / 유사 아이콘 후보

- **Warning triangle** (`d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3..."`) — ProcessGuideStepCard 안에서 2회, 그리고 다른 가이드 컴포넌트 다수 → 새 `WarningIcon` 으로 통일하고 기존 `StatusWarningIcon` (filled circle 변형) 와 alias 여부 검토.
- **Info circle** (`d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0..."`) — 동일하게 다수. `InfoIcon` 으로 통일 + `StatusInfoIcon` alias 검토.
- **Clipboard** (사전 조치) — ProcessGuideStepCard 에서만 같은 path 2회 (조건부 렌더 분기) → DRY 시 1회로.
- **`dashboard/systems-table/SortIcon.tsx`** & **`resource-table/StatusIcon.tsx`** — 자체가 mini icon catalog. `app/components/ui/icons/` 로 승격 candidate; H1b/H1f 진행 시 결정.

## Cross-check

```bash
grep -rln "<svg" app --include="*.tsx" | wc -l
# → 99 (총합)
# 99 = 9 (icons) + 14 (IDC/SDU) + 5 (brand) + 71 (real targets)
```

다음 wave 시작 전 위 식이 그대로 성립하는지 **재실행** 필요 (다른 wave 가 새 `<svg>` 추가했을 가능성).
