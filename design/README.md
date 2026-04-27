# PII Agent Design System

A design system distilled from **bluefa/pii-agent-demo** — a Next.js 16 admin dashboard for managing **PII Agent** integrations across Cloud Providers (AWS, Azure, GCP, IDC, SDU).

## What this product is

PII Agent is a Korean-language, desktop-only, internal admin console that lets operators:

- **Register a system** and choose a Cloud Provider (AWS / Azure / GCP / IDC / SDU).
- **Discover target sources** — scanning databases across the provider (EC2, RDS, Redshift, DynamoDB, Azure SQL / PostgreSQL / MySQL / Cosmos / MariaDB / Synapse / VM, GCP resources).
- **Go through an installation workflow** — confirming connection targets, waiting for approval, applying configuration, running a connection test, and installing the PII scanning agent.
- **Monitor the connection health** of all integrated databases (연동 현황 대시보드).
- **Audit history** — who approved what, when, and which projects changed state.

All UI is in **Korean**. Dashboards are tabular and dense; modals drive the multi-step flows.

## Sources

- **Repository:** https://github.com/bluefa/pii-agent-demo (`main`)
- **Design tokens:** `lib/theme.ts` — Tailwind-class tokens (ground truth).
- **Global CSS:** `app/globals.css` — CSS variables.
- **Framework:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · React 19.
- **Font:** `next/font/google` → **Geist** (Sans + Mono).
- **Icons:** local SVGs under `public/icons/` for cloud providers + cloud services; inline SVGs in components for interface icons. No icon library.

No Figma, no slides, no brand book were attached — everything below is derived from the codebase.

---

## Content Fundamentals

**Language.** Korean UI. English is reserved for: product names (PII Agent), Cloud Provider names (AWS, Azure, GCP, IDC, SDU), database engine names (PostgreSQL, RDS, EC2), technical labels in tables (e.g. `region`, `instance_type`), and occasional capitalized labels (“Admin Tasks”, “Try it out”). Mixed-language sentences are normal and idiomatic for Korean enterprise SaaS — do not over-translate.

**Tone.** Professional, factual, terse. Think “operator console,” not “consumer app.” No marketing language, no exclamation points, no cheerleading. Sentences state what is true or what to do — nothing more.

**Voice.** Impersonal / third-person observational:
- "전체 시스템의 PII Agent 연동 상태를 모니터링합니다" ("Monitors the PII Agent integration state of all systems.")
- "검색 결과가 없습니다" ("No search results.")
- "다른 검색어를 입력해 주세요" ("Please try a different search term.") — polite imperative with `-해 주세요`, not casual.

No "you" / 당신. No "we" / 우리. Occasional polite-imperative endings (`-합니다`, `-해 주세요`). Never informal 반말.

**Typical copy pairs.**
| Pattern | Example |
| --- | --- |
| Page title | 연동 현황 대시보드 · PII Agent 관리자 · 서비스 관리 |
| Page subtitle | 전체 시스템의 PII Agent 연동 상태를 모니터링합니다 |
| Section label | SERVICE CODE · 연동 대상 확정 대기 · 설치 진행 중 |
| Status phrase | 연동 중 · 끊어진 서비스 · 승인 대기 · 설치 완료 |
| Empty state | 검색 결과가 없습니다 / 다른 검색어를 입력해 주세요 |
| Timestamp | 마지막 확인: 04.22 13:45 (MM.DD HH:MM) |
| Counts | 총 24개 서비스 · 끊김 3 · 연동중 142 |
| Button labels | 새로고침 · 새 프로젝트 · 확인 · 취소 · 닫기 · 승인 · 반려 |

**Casing.** Section labels on cards are UPPERCASED English (`SERVICE CODE`) or Korean with `font-semibold`. Buttons are Title/Sentence case. Body copy is sentence case.

**Numbers & units.** Korean locale separators (`toLocaleString('ko-KR')`). Units trail the number in a dimmer gray: `142 시스템`, `3 개`, `12.5%`.

**Iconography in copy.** No emoji anywhere. No unicode ornament characters. Status is conveyed with colored dots + words, never emoji.

**Error & empty states.** Always a short sentence + a quieter follow-up line telling the user the next step. Never humorous.

---

## Visual Foundations

### Overall vibe
A **clean, bright, white-on-white admin console** in the **Toss-blue** design lineage (#0064FF primary). High whitespace, soft shadows, rounded corners, zero chrome. Dense data tables; compact cards. Cool, neutral palette accented with the one blue. No illustrations, no photography, no gradients in layout — the **only** gradient is the brand accent on the dashboard hero (`linear-gradient(135deg, #0064FF → #6366f1)`) and on a pair of KPI icon tiles.

### Color
- **Primary:** `#0064FF`. Hover `#0050D6`. Tint `#E8F1FF`.
- **Status dots:** success `#45CB85`, error `red-500`, warning `orange-500` (also used for AWS brand), pending `gray-400`, info `blue-500`.
- **Provider left-borders** (a distinctive motif): AWS `#FF9900`, Azure `#0078D4`, GCP `#4285F4`, IDC gray-700, SDU purple-600. Each with a matching `@5% bg tint`. Use this pattern for provider-scoped cards; **do not** invent rainbow gradients.
- Neutrals are Tailwind `gray-50…900`.
- Backgrounds are **flat white** on **gray-50 page**. No patterns, textures, or photography.

### Typography
- **Sans:** Geist (next/font). Weights 400/500/600/700.
- **Mono:** Geist Mono — used for code/IDs (rare).
- **Display:** 28px / 700 / `-0.02em`.
- **KPI big number:** 28px / 700. Percentages 22px / 700 in primary blue.
- **Body:** 15px / 400 in gray-700. Secondary 14px.
- **Card titles:** 14px / 600, `uppercase`, `tracking-wide`, **gray-500** (this is the distinctive "small muted uppercase" label style — see `Card.tsx`).
- **Labels:** 12px in gray-400/500; 10–11px micro for KPI units and pill chips.

### Spacing
Tailwind 4px base. Canonical values: `p-6` (24px) for card padding, `gap-5/6` between sections, `px-6 py-4` for card headers, `px-6 py-3` for table headers, `px-6 py-4` for table cells.

### Corners & borders
- `rounded-lg` (8px) for **buttons, inputs, pills inside cards**.
- `rounded-xl` (12px) for **cards, modals**.
- `rounded-2xl` (16px) for **KPI hero cards**.
- `rounded-full` for **badges, dots, refresh chip, avatars**.
- Borders: `1px solid gray-100` inside cards (dividers), `gray-200` for input/card outlines, `gray-300` for stronger outlines (secondary buttons).

### Shadows
Two tiers only:
- `shadow-sm` — default card elevation. `0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)`.
- `shadow-xl` — modals. `0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)`.
- KPI cards lift to `0 4px 12px -2px rgb(0 0 0 / 0.10)` on hover + `translateY(-2px)`.

No inner shadows. No colored glows.

### Animation & motion
- `transition-all duration-150` on buttons / tabs / links.
- `transition-colors` on table rows, nav items.
- KPI hover: 200ms ease — lift 2px + shadow step up.
- Modal: appears with backdrop `bg-black/50`; no bespoke animation.
- A single custom keyframe `@keyframes shake` (0.5s) used for form validation feedback in `globals.css`.
- **No bounces, no parallax, no scroll-triggered animation.** Everything is snappy, ≤250ms.

### Hover / press states
- **Hover:** primary → darker primary; secondary → `gray-50` bg + border bump to gray-400; ghost → `gray-100`; table rows → `gray-50`.
- **Press:** (no custom active scale). Buttons rely on standard browser active states.
- **Focus:** 2px primary-blue `outline-offset: 2px` ring (global `:focus-visible`). Accessible by default.
- **Disabled:** `opacity-50` + `cursor-not-allowed`.

### Selected states
- Sidebar list item: **left 4px blue border** + `bg-blue-50` + darker text. This pattern is specific to the product and should be reused.
- Tabs: 3px bottom border + primary text color.

### Layout rules
- Desktop-only. Min-width 1280px assumed.
- **Three-pane admin layout:** top `AdminHeader` (56px) + left `ServiceSidebar` (256px) + right content area.
- Cards live in a white surface on a `gray-50` page background with ~24–32px gutters.
- Tables go edge-to-edge inside their parent `Card` using `padding="none"`.

### Transparency & blur
Sparingly used:
- Modal overlay: `bg-black/50` (no blur).
- Provider brand tint: `bg-[#FF9900]/5` etc. — very faint solid tints, never gradients.
- Success/error/info bg tints: `bg-[#45CB85]/10`, `bg-red-100`, `bg-blue-50`.
- **No backdrop-filter** anywhere.

### Cards
Default recipe: `bg-white rounded-xl shadow-sm` — optionally `padding p-6`. With a title, the header gets `px-6 py-4 border-b border-gray-100` and a UPPERCASE gray-500 small label. The table variant uses `padding="none"` to let the `<table>` span edge-to-edge.

### Imagery
None. The product has no brand illustrations, no hero photography, no mascots. Visual interest comes from typography, color, and data density.

---

## Iconography

**Sources, in priority order:**

1. **Cloud provider + service SVGs** in `assets/icons/` — copied from `public/icons/` in the repo. These are the official-ish brand marks (AWS square, Azure cube, GCP multi-dot, plus per-service AWS EC2/RDS/DynamoDB/Redshift and Azure Cosmos/MariaDB/MySQL/PostgreSQL/SQL/Synapse/VM). Full-color, flat, no outline. Use as-is.
2. **Inline SVG line icons** drawn per component (`DashboardHeader` refresh/clock glyphs, `KpiCardGrid` server/sync/database glyphs, `Modal` close X, `AdminHeader` shield, `Table` empty-state database). These are **custom 1.5–1.8px stroked line icons** with `strokeLinecap="round" strokeLinejoin="round"`, typically 14–24px. Matches nothing — neither Lucide nor Heroicons perfectly — but closest to **Lucide's stroke-width 1.5 style** at small sizes. **Recommended substitute when you need an icon not in the repo: Lucide (CDN) at stroke-width 1.5–1.8**. Flag substitutions.
3. **No emoji, no unicode pseudo-icons.** Never use 📊 or ▲.
4. **No sprite sheet, no icon font.** Every icon is either an `<img src>` (from `/icons/*.svg`) or inline `<svg>` JSX.
5. **Logos:** the only product logo is the **blue rounded-square + white shield-check** in `AdminHeader.tsx` (the check-shield path is drawn in SVG). There is no PII Agent wordmark file.

See `iconography/icons.html` for the full gallery.

⚠️ **Font substitution note:** The repo uses `next/font/google` → Geist. I have loaded Geist from Google Fonts via `@import`; this matches the product. If you want exact `next/font` optimized weights, re-export Geist Sans + Mono WOFF2 from the repo build.

---

## Index

| Path | Purpose |
| --- | --- |
| `colors_and_type.css` | CSS variables, semantic tokens, utility classes |
| `assets/icons/` | Cloud provider & service SVG icons |
| `assets/generic/` | Generic SVGs (file, globe, window) |
| `preview/` | Design system cards rendered to the Design System tab |
| `ui_kits/admin/` | React UI kit replicating the PII Agent admin console |
| `SKILL.md` | Agent-skill entrypoint for Claude Code / other agents |

### UI Kits

- **admin** (`ui_kits/admin/index.html`) — Admin console replication: header + sidebar + dashboard + projects table + installation step flow + modal.

