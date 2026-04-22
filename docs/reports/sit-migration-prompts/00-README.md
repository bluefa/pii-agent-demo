# SIT Migration — Session Prompts

Copy the full contents of any `.md` file in this directory and paste it into a fresh Claude Code session. The session is fully self-contained.

## Usage

```bash
# Copy one prompt to clipboard
cat docs/reports/sit-migration-prompts/wave5-B5.md | pbcopy    # macOS
xclip -selection clipboard < docs/reports/sit-migration-prompts/wave5-B5.md   # Linux

# Then paste into a new Claude Code session
```

Or open the file, select all, copy, and paste manually.

## Phase 1 status (as of 2026-04-23)

| Wave | Status | PRs |
|---|---|---|
| 1 — T1 theme tokens | ✅ merged | #272 |
| 2 — shared UI + layout + 6 features | ✅ merged | #274, #275, #276, #277, #278, #279, #280 |
| 2b — detail segment layout | ✅ merged | #281 |
| 3 — Admin shell restructure | ✅ merged | #282 |
| 4a — Admin InfraCard integration | ✅ merged | #283 |
| 4b — Detail shell 5-provider | ✅ merged | #284 |
| **5 — ProjectPageMeta + Scan headless** | 🟡 available | (B5 + B6, parallel) |
| **6 — Scan state UIs** | 🔵 blocked by B6 | (B7) |
| **7 — DbSelectionTable** | 🔵 blocked by B7 | (B8) |
| **8 — Cleanup** | 🔵 blocked by A4+B5+B8 | (T17) |

## Files

### Wave 2 — all require T1 merged (7 parallel)
- `wave2-T2.md` — shared UI primitives (Breadcrumb / PageHeader / PageMeta)
- `wave2-T3.md` — TopNav + admin segment layout
- `wave2-A1.md` — ServiceSidebar redesign (280px)
- `wave2-A3.md` — InfraCard component set (expand lazy fetch)
- `wave2-A6.md` — ProjectCreateModal 840px rewrite (7-chip staged list)
- `wave2-B1.md` — StepProgressBar 7-step expansion
- `wave2-B2.md` — GuideCard warm variant + content merge

### Wave 2b — requires T3 merged (routes.ts conflict)
- `wave2b-B3.md` — target-source detail segment layout

### Wave 5 — requires B4 merged (2 parallel)
- `wave5-B5.md` — ProjectPageMeta consolidation helper (+ static crumb hoist per PR #284 Vercel review)
- `wave5-B6.md` — ScanPanel headless (ScanController) + delete ScanHistoryList / CooldownTimer (I-05)

### Wave 6 — requires B6 merged
- `wave6-B7.md` — 3 scan state UIs (Empty / Running / Error) consuming ScanController

### Wave 7 — requires B7 merged
- `wave7-B8.md` — ResourceTable → DbSelectionTable 8-column reconfig (I-06 scan-history stub)

### Wave 8 — requires A4 + B5 + B8 merged
- `wave8-T17.md` — Phase 1 cleanup (delete orphan files, prune dead state, MEMORY refresh)

## Recommended execution

```
After PR #284 (B4) merges:

  terminal 1: wave5-B5.md   ─┐
  terminal 2: wave5-B6.md   ─┤     Wave 5 (parallel, 2 sessions)
                             ↓
                       B6 PR merges
                             ↓
                    terminal X: wave6-B7.md       Wave 6 (single)
                             ↓
                       B7 PR merges
                             ↓
                    terminal Y: wave7-B8.md       Wave 7 (single)
                             ↓
                       B8 PR merges
                             ↓
                    terminal Z: wave8-T17.md      Wave 8 (single, final)
```

## Design notes

- **Self-contained**: a fresh session with no prior context can complete the task end-to-end.
- **Precondition check**: bash snippet at the top verifies the prerequisite PRs are merged via `git log origin/main | grep`; aborts otherwise.
- **Parallel-safe**: each prompt lists which other Wave sessions may be running and which files are off-limits. Wave 5 is the last opportunity for parallel work in Phase 1.
- **Stop condition**: the session reports the PR URL and stops — it does not attempt to auto-merge.
- **Vercel rule alignment**: B5 resolves `rendering-hoist-jsx` P3 from PR #284 review; T17 resolves `bundle-conditional` P2 (orphan fetch pruning).

## Next waves

Phase 1 ends with T17. For Phase 2 and beyond (e.g. IDC creation path, permissions API retirement, real scanHistoryStatus wiring), add new files alongside these.
