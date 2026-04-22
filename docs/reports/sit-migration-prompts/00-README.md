# SIT Migration — Session Prompts

Copy the full contents of any `.md` file in this directory and paste it into a fresh Claude Code session. The session is fully self-contained.

## Usage

```bash
# Copy one prompt to clipboard
cat docs/reports/sit-migration-prompts/wave2-T2.md | pbcopy    # macOS
xclip -selection clipboard < docs/reports/sit-migration-prompts/wave2-T2.md   # Linux

# Then paste into a new Claude Code session
```

Or open the file, select all, copy, and paste manually.

## Files

### Wave 2 — 7 parallel sessions, all require T1 merged
- `wave2-T2.md` — shared UI primitives (Breadcrumb / PageHeader / PageMeta)
- `wave2-T3.md` — TopNav + admin segment layout
- `wave2-A1.md` — ServiceSidebar redesign (280px)
- `wave2-A3.md` — InfraCard component set (expand lazy fetch)
- `wave2-A6.md` — ProjectCreateModal 840px rewrite (7-chip staged list)
- `wave2-B1.md` — StepProgressBar 7-step expansion
- `wave2-B2.md` — GuideCard warm variant + content merge

### Wave 2b — requires T3 merged (routes.ts conflict)
- `wave2b-B3.md` — target-source detail segment layout

## Recommended execution

```
terminal 1: wave2-T2.md
terminal 2: wave2-T3.md   ──┐
terminal 3: wave2-A1.md      │ (after T3 PR is merged)
terminal 4: wave2-A3.md      ▼
terminal 5: wave2-A6.md    terminal X: wave2b-B3.md
terminal 6: wave2-B1.md
terminal 7: wave2-B2.md
```

## Design notes

- **Self-contained**: a fresh session with no prior context can complete the task end-to-end.
- **Precondition check**: bash snippet at the top verifies the prerequisite PRs are merged; aborts otherwise.
- **Parallel-safe**: each prompt lists which other Wave 2 sessions may be running and which files are off-limits.
- **Stop condition**: the session reports the PR URL and stops — it does not attempt to auto-merge.

## Next waves

Once Wave 2/2b is fully merged, see the Wave 3+ prompts in `docs/reports/sit-migration-session-prompts.md` §2 and convert to this file format as needed.
