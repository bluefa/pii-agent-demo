# Queue Board (`/task_admin`) UI Design Spec

## Component Tree

```
app/task_admin/page.tsx              -- Route entry (server component, renders QueueBoard)
app/components/features/queue-board/
  QueueBoard.tsx                     -- Main client component: tabs + filter bar + state
  QueueBoardHeader.tsx               -- Page header: title + filter dropdown + search input
  QueueBoardTabs.tsx                 -- 3-tab pill navigation with count badges
  PendingTasksTable.tsx              -- Tab 1: pending approval requests
  ProcessingTasksTable.tsx           -- Tab 2: in-progress tasks (post-approval)
  CompletedTasksTable.tsx            -- Tab 3: completed/rejected history
  TaskRejectModal.tsx                -- Reject confirmation modal (reason input required)
  TaskDetailModal.tsx                -- Read-only detail view modal
  CloudInfoCell.tsx                  -- Provider-specific cloud info renderer
  index.ts                           -- Barrel export
```

## Design Decisions

### 1. Tab Style: Pill Tabs (not underline)
- Rounded pill shape (`rounded-lg`) with primary bg for active, gray-100 for inactive
- Each tab shows count badge (Badge component, `size="sm"`)
- Active: `primaryColors.bg` + white text
- Inactive: `bg-gray-100` + `textColors.secondary`

### 2. Filter Bar (inside QueueBoardHeader)
- Left: Page title "Queue Board" + subtitle count
- Right: Request type dropdown (`<select>`) + search input (service code/name)
- Uses `getInputClass()` for input styling, compact `text-sm` sizing

### 3. Table Design
- Reuse existing `<Table>` component (`app/components/ui/Table.tsx`)
- Column definitions per tab (see below)
- Provider column uses `CloudProviderIcon` + `providerColors` token for badge
- Cloud info column renders provider-specific data via `CloudInfoCell`
- Action column: Button group (approve/reject for pending, detail for completed)

### 4. Modals
- **TaskRejectModal**: Extends pattern from `ApprovalDetailModal` -- Modal + textarea (required) + danger Button
- **TaskDetailModal**: Read-only view, reuses Modal with resource table like ApprovalDetailModal

### 5. Pagination
- Simple prev/next + page number display at table bottom
- Managed as local state in QueueBoard (page, pageSize=20)

## Column Definitions

### Tab 1: Pending Tasks (승인 대기)
| Column | Width | Render |
|--------|-------|--------|
| 요청유형 | 100px | Badge (info variant) |
| 서비스코드 | 120px | mono text |
| 서비스명 | flex | text, truncate |
| Provider | 80px | CloudProviderIcon + providerColors badge |
| Cloud 정보 | 160px | CloudInfoCell (AWS=AccountID, Azure=Tenant, GCP=ProjectId, SDU/IDC=label) |
| 요청시간 | 140px | formatted datetime (ko-KR) |
| 요청자 | 100px | text |
| 액션 | 160px | Button(primary, sm, "승인") + Button(danger, sm, "반려") + ghost icon button(상세) |

### Tab 2: Processing (처리중)
| Column | Width | Render |
|--------|-------|--------|
| 요청유형 | 100px | Badge |
| 서비스코드 | 120px | mono text |
| 서비스명 | flex | text, truncate |
| Provider | 80px | CloudProviderIcon + badge |
| Cloud 정보 | 160px | CloudInfoCell |
| 승인시간 | 140px | formatted datetime |
| 승인자 | 100px | text |
| 진행상태 | 140px | Badge(warning, dot) -- "반영중" / "EOS 처리중" |

### Tab 3: Completed (완료 내역)
| Column | Width | Render |
|--------|-------|--------|
| 요청유형 | 100px | Badge |
| 서비스코드 | 120px | mono text |
| 서비스명 | flex | text, truncate |
| Provider | 80px | CloudProviderIcon + badge |
| Cloud 정보 | 160px | CloudInfoCell |
| 요청시간 | 120px | formatted datetime |
| 처리시간 | 120px | formatted datetime |
| 처리자 | 100px | text |
| 결과 | 80px | Badge(success, "승인") or Badge(error, "반려") |
| 액션 | 60px | ghost icon button(상세) |

## Theme Token Usage

| Element | Token |
|---------|-------|
| Page background | `bg-gray-50` (matches AdminDashboard) |
| Card container | `cardStyles.base` |
| Table | `tableStyles.*` via Table component |
| Active tab | `primaryColors.bg`, `textColors.inverse` |
| Inactive tab | `bgColors.muted`, `textColors.secondary` |
| Provider badge | `providerColors[provider]` |
| Status badges | `statusColors.success/error/warning/pending` via Badge |
| Input fields | `getInputClass()` |
| Primary buttons | `buttonStyles.variants.primary` via Button |
| Danger buttons | `buttonStyles.variants.danger` via Button |
| Ghost buttons | `buttonStyles.variants.ghost` |
| Section spacing | `spacing.sectionGap` (`gap-6`) |
| Card padding | `spacing.cardPadding` (`p-6`) |

## Layout (ASCII)

```
+------------------------------------------------------------------+
| [shield] PII Agent 관리자           Queue Board    [avatar] 관리자  |
+------------------------------------------------------------------+
|                                                                    |
|  Queue Board                          [요청유형 v] [검색: 서비스..] |
|                                                                    |
|  [  승인 대기 (3)  ] [ 처리중 (2) ] [ 완료 내역 (15) ]            |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  | 요청유형 | 서비스코드 | 서비스명 | Provider | Cloud | 요청.. | |
|  |----------|------------|----------|----------|-------|--------| |
|  | 연동확정 | SVC-001    | 금융서비스| AWS     | 1234..| 02-26  | |
|  | 연동확정 | SVC-002    | 보험서비스| Azure   | abc.. | 02-25  | |
|  | EOS      | SVC-003    | 데이터플랫| GCP     | proj..| 02-24  | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|                          < 1 2 3 ... 5 >                          |
+------------------------------------------------------------------+
```

## Reject Modal (ASCII)

```
+--------------------------------------------+
| 승인 요청 반려                          [X] |
|--------------------------------------------|
|                                            |
|  SVC-001 / 금융서비스                      |
|  요청자: 홍길동 | 요청시각: 2026-02-26     |
|                                            |
|  반려 사유 *                               |
|  +--------------------------------------+  |
|  | 반려 사유를 입력하세요...              |  |
|  |                                      |  |
|  +--------------------------------------+  |
|                                            |
|--------------------------------------------|
|                       [취소]  [반려하기]    |
+--------------------------------------------+
```
