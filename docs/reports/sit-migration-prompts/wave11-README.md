# Wave 11 — Clean Code Refactor Series

Spec-driven refactor sequence derived from `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` (merged in PR #295, commit `475dce7`).

Each spec is a self-contained input to `/wave-task`. Run them individually or in the batches defined below.

## Specs

| Key | Title | Scope | Est. LOC Δ | Depends on |
|-----|-------|-------|-----------|------------|
| `wave11-A1` | Constants foundation | `lib/constants/` new module | +150 / -0 | — |
| `wave11-A2` | Icons module foundation | `app/components/ui/icons/` new module + GuideCard migration | +220 / -20 | — |
| `wave11-B1` | IdcResourceInputPanel → useReducer | one feature component + local validators file | +120 / -180 | `A1` (for timings) |
| `wave11-B2` | QueueBoard modal state → discriminated union | one feature component | +40 / -60 | — |
| `wave11-B3` | Polling hooks consolidation | `app/hooks/useScanPolling.ts`, `useTestConnectionPolling.ts`, new `usePollingBase.ts` | +80 / -240 | — |

## Parallel execution strategy

Three batches, each internally parallel. Within a batch, every spec modifies a disjoint set of files.

```
Batch 1 (parallel, 3 agents):
  ├── /wave-task wave11-A1
  ├── /wave-task wave11-B2
  └── /wave-task wave11-B3

Batch 2 (parallel, 1 agent — depends on A1):
  └── /wave-task wave11-A2     (*could also run in Batch 1 — no A1 dep; see note)

Batch 3 (serial — depends on A1 merge):
  └── /wave-task wave11-B1
```

**Note on A2**: technically `wave11-A2` (icons) has no dependency on `wave11-A1` (constants). It can run in Batch 1 as a fourth agent. Listed in Batch 2 only to keep Batch 1 concurrency ≤ 3 for reviewer bandwidth.

## File-level non-overlap (verified)

| Spec | Files it modifies (new or existing) |
|------|--------------------------------------|
| A1 | `lib/constants/*.ts` (all new), `lib/constants/README.md` (new) |
| A2 | `app/components/ui/icons/**` (all new), `app/components/features/process-status/GuideCard.tsx` (migration) |
| B1 | `app/components/features/idc/IdcResourceInputPanel.tsx`, `app/components/features/idc/validation.ts` (new) |
| B2 | `app/components/features/queue-board/QueueBoard.tsx` |
| B3 | `app/hooks/useScanPolling.ts`, `app/hooks/useTestConnectionPolling.ts`, `app/hooks/usePollingBase.ts` (new) |

No two specs touch the same file. Running them concurrently will not produce merge conflicts.

## Invocation

```
/wave-task docs/reports/sit-migration-prompts/wave11-A1.md
/wave-task docs/reports/sit-migration-prompts/wave11-A2.md
/wave-task docs/reports/sit-migration-prompts/wave11-B1.md
/wave-task docs/reports/sit-migration-prompts/wave11-B2.md
/wave-task docs/reports/sit-migration-prompts/wave11-B3.md
```

The pipeline covers worktree → implement → self-audit → PR → auto-fix loop → merge wait. Phase 8 waits for your explicit merge instruction on each PR.

## Deferred to later waves

From the audit's Wave 1–8 plan, these are **not** included in Wave 11 (too large or out-of-scope for a single spec):

- ESLint rule additions (A1/A2/A4/A5/F1/E1 + `no-restricted-imports`) — needs repo-wide violation survey first
- B1 (B-category): ConnectionTestPanel god-component split (667 LOC, 4 inner modals) — needs its own detailed spec
- B3 (B-category): provider InstallationInline unification (AWS/GCP/Azure) — needs config-diff mapping spec
- C2: server state → React Query migration — architectural change, needs separate design
- Icon module consumption migration (82 remaining `<svg>` sites) — should follow A2 in waves 12+
- A1 (A-category): `!` non-null assertion replacement (15 sites) — grep-replace + guard pattern, needs its own spec
- F1: `alert()` removal (12 sites) — needs shared toast component decision first

The five specs here are the ones with the **clearest scope, smallest blast radius, and highest maintenance ROI** — good candidates to prove the /wave-task flow works on refactor specs (vs. the feature specs it's been used for to date).

## Related

- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md`
- Skill: `.claude/skills/anti-patterns/SKILL.md`
- API boundary ref: `docs/api/boundaries.md`
- Pipeline skill: `.claude/skills/wave-task/SKILL.md`
