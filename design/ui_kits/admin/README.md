# PII Agent — Admin UI Kit

Hi-fi replica of the PII Agent admin console in plain React + Babel (no build step). Open `index.html` in a browser to click through.

## Components

| File | What it is |
| --- | --- |
| `AdminHeader.jsx` | Top bar with logo + nav tabs + user |
| `ServiceSidebar.jsx` | Left pane with searchable service-code list (4-px left-border selected pattern) |
| `Dashboard.jsx` | Accent bar + gradient logo tile + 2-up KPI cards + systems table |
| `ProjectDetail.jsx` | Breadcrumb + 6-step installation indicator + info cards + resource table |
| `Modal.jsx` | New-project modal with provider picker |
| `kit.css` | All styles — consumes vars from `../../colors_and_type.css` |

## Interaction

- Click a row in the systems table → opens project detail for that system.
- Click **다음 단계 진행** → advances the installation stepper (1→6).
- Click **+ 새 프로젝트** → opens modal with provider picker.
- Sidebar search filters services live.
- Nav tabs + sidebar items are click-responsive.

## Fidelity notes

Visuals are lifted from the repo (`lib/theme.ts`, `app/globals.css`, `DashboardHeader.tsx`, `KpiCardGrid.tsx`, `StepIndicator.tsx`, `AdminHeader.tsx`, `ServiceSidebar.tsx`, `Modal.tsx`, `Card.tsx`, `Table.tsx`, `Badge.tsx`, `Button.tsx`). Component implementations are simplified — this is a cosmetic recreation, not production code.
