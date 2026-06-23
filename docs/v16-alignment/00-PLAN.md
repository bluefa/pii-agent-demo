# v16 Alignment — Plan & Process

Align the target-source **detail page** (NOT admin) to `design/SIT Prototype Athena v16.html`,
byte-exact per **Cloud × Step**. Branch `feat/target-source-v15` (worktree
`/Users/study/pii-agent-demo-target-source-v15`).

## Operating principle (locked by user)

1. **Token-first.** Finish the design-token + interaction analysis and get **unanimous**
   reviewer sign-off (opus panel + Codex) **before** implementing a screen. No implementation
   on a cell whose tokens/scenarios aren't converged.
2. **ADR adapter boundary is mandatory.** Every screen consumes the **domain** model
   (camelCase) only. When the **API/wire response changes, the UI must NOT move** — the
   change is absorbed in the input/output **adapter** (`app/lib/api/**`), not in components.
   Wire (snake_case) never leaks into JSX. (See ADR-019 / casing-boundary.)
3. **Budget is not a constraint.** Iterate (analysis → review → fix) until reviewers are
   unanimous. Run many subagents in parallel; reviews go through Codex + opus.

## Workflow

```
Phase A  Per-cell analysis (parallel subagents)
         ├─ design tokens   : every px / weight / color / radius / spacing → theme.ts token
         ├─ layout          : columns, order, widths, alignment (text=left / number=right)
         └─ interaction map : button → (modal opens? where to? state change?) fully mapped
                ↓
Phase B  Review to UNANIMOUS  (opus reviewers + Codex CLI)
         loop: reviewers find a gap → fix the analysis → re-review → … until all agree
                ↓
Phase C  Docs frozen         01-design-tokens.md · 02-interaction-scenarios.md (+ per-cell)
                ↓
Phase D  Implementation      per cell, ADR adapter boundary, verify (tsc+vitest+screenshot)
         loop: Codex+opus review the diff → fix → re-review → unanimous → commit
```

**Convergence criterion:** a cell is "done" only when the opus review panel AND Codex both
report no remaining correctness/fidelity gaps for that cell.

## Cell matrix (provider × step → targetSourceId)

| step | azure | gcp | aws | idc |
|------|-------|-----|-----|-----|
| 1 연동대상 선택 | 1005 | 1002 | 1006 | 1020 |
| 2 승인 대기 | 2002 | 2007 | 1007 | 1021 |
| 3 반영중 | 2003 | 2008 | 2001 | 1022 |
| 4 설치 | 1004 | 2009 | 1008 | 1023 |
| 5 연결 테스트 | 2004 | 2010 | 1010 | 1024 |
| 6 운영(검증대기) | 2005 | 2011 | 1011 | 1025 |
| 7 운영 | 2006 | 2012 | 1012 | 1026 |

Render: `bash scripts/v16shot.sh <prov> <step> /tmp/v16_x.png` (authority) ·
`bash scripts/implshot.sh <id> /tmp/impl_x.png` (running impl, dev server on :3000).
Dev server: `npx next dev --webpack` (NOT turbopack). Seeds load at boot → restart after
seed/mock edits; code hot-reloads.

## Known v15 → v16 deltas (verify + extend in Phase A)

- **step5 「완료 승인 요청」 now opens a confirmation MODAL** (`openReqApproval` cloud /
  `openIdcReqApproval` idc) showing a summary table → `요청하기` → step6. Was a direct
  `setStep(6)` in v15.
- **step5 table + DB Credential column** (cloud + idc); **IDC step5 + 논리 DB 관리 column**.
- 연동 대상 column width **220 → 168px**.
- IDC step1 db-list-table col 5/6 padding tweak.
- Net +799 lines v15→v16 — Phase A must confirm there are no other changes (CSS, copy, modal).

## Provider branching (intended differences — do NOT force identical)

- azure / gcp / aws: cloud-common columns; **AWS adds Athena**; install-status header differs
  (`Private Link 상태` / `서비스 리소스 상태` / `VPC Endpoint 상태`); AWS step4 has 자동/수동 toggle.
- idc: manual target (IP/Domain · Source IP · credential dropdown); identifier = IP List/Domain
  (not ResourceId); no cloud scan; meta label = Datacenter.
- Same-role components (credential picker, logical-DB modal, pagination) share ONE design.

## Foundation fixes (from Codex review of step3 + DatabaseType — must clear before Phase D)

- **C1** `needsCredential` (lib/resource-catalog.ts) compares uppercase literals → breaks on
  lowercase-canonical db type. Make all db-type comparisons case-insensitive.
- **C2** raw color classes in WaitingApprovalTable (`bg-[#F9FAFB]`, `border-[#EBEEF2]`) → tokens.
- **C3** Korean comments in new code → English.
- **M1** step3 row mapping shows VM endpoint engine wrong: derive display db type from
  `endpoint_config.db_type` before falling back to `resource_type`.

## Deliverables

- `00-PLAN.md` (this) — process + matrix + ADR rule.
- `01-design-tokens.md` — v16 token spec (global + per-component), each mapped to `lib/theme.ts`.
- `02-interaction-scenarios.md` — per Cloud × Step: every actionable element → behavior
  (button → modal/navigation/state, gating preconditions, PENDING→RUNNING→SUCCESS/FAIL).
- Per-cell notes as needed.

## Status

Phase A in progress (subagents: spec-step5 + per-provider audits). step3 + DatabaseType
committed (foundation fixes pending). Implementation gated on Phase B unanimity.
