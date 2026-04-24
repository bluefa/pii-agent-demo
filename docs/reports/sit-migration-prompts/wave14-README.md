# Wave 14 — God-Component Splits + useReducer + E1 Closer

Re-audit (main @ `c2da15f`, post wave13 머지) 기준 deferred 항목 중 **5-way parallel-safe** 스펙 모음.

## Baseline (2026-04-24)

| Target | LOC | useState | Audit pattern | Spec |
|--------|-----|----------|---------------|------|
| `dashboard/SystemsTable.tsx` | 491 | — | §B1 🔴 | `wave14-B1a` |
| `_components/idc/IdcProcessStatusCard.tsx` | 405 | — | §B1 🔴 | `wave14-B1b` |
| `_components/azure/AzureProjectPage.tsx` | 405 | 15 | §B1 🔴 + §C1 🔴 | `wave14-B1c` |
| `features/AdminDashboard.tsx` | 267 | 12 | §C1 🔴 | `wave14-C1` |
| `features/idc/IdcResourceInputPanel.tsx` L210 | — | — | §E1 🟡 (wave13 deferred) | `wave14-E1b` |

## Specs

| Key | Title | Est. LOC Δ |
|-----|-------|-----------|
| `wave14-B1a` | SystemsTable split (6 children) | +150 / -270 |
| `wave14-B1b` | IdcProcessStatusCard split (4 children) | +100 / -225 |
| `wave14-B1c` | AzureProjectPage data/form hooks | +140 / -185 |
| `wave14-C1` | AdminDashboard useReducer + modal union | +80 / -60 |
| `wave14-E1b` | IdcResourceInputPanel IP row stable id | +40 / -25 |

## Parallel execution strategy

**5-way parallel 가능** — 모든 spec 이 disjoint file set:

```
세션 1:  /wave-task docs/reports/sit-migration-prompts/wave14-B1a-systems-table-split.md
세션 2:  /wave-task docs/reports/sit-migration-prompts/wave14-B1b-idc-process-status-split.md
세션 3:  /wave-task docs/reports/sit-migration-prompts/wave14-B1c-azure-project-page-split.md
세션 4:  /wave-task docs/reports/sit-migration-prompts/wave14-C1-admin-dashboard-reducer.md
세션 5:  /wave-task docs/reports/sit-migration-prompts/wave14-E1b-ip-row-stable-id.md
```

## File-level non-overlap (verified)

| Spec | Files touched |
|------|---------------|
| B1a | `app/components/features/dashboard/SystemsTable.tsx` + `systems-table/**` (new) |
| B1b | `app/integration/target-sources/[targetSourceId]/_components/idc/IdcProcessStatusCard.tsx` + `idc-process-status/**` (new) |
| B1c | `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx` + `useAzureProjectData.ts`, `useVmConfigForm.ts` (new) |
| C1 | `app/components/features/AdminDashboard.tsx` |
| E1b | `app/components/features/idc/IdcResourceInputPanel.tsx` + `validation.ts` |

모든 파일 disjoint. Rebase conflict 없음.

## Pattern references

각 spec 은 이전 wave 의 검증된 패턴 재적용:

| Spec | 재사용 패턴 |
|------|-----------|
| B1a/B1b | wave12-B1 (ConnectionTestPanel split, PR #310) |
| B1c | wave11-B1 useReducer + wave11-B2 discriminated union + wave12-B3 useInstallationStatus 훅 |
| C1 | wave11-B1 (reducer) + wave11-B2 (modal union) |
| E1b | wave11-B1 continuation (filtered-index skew 해소 포함) |

## Invocation

```
/wave-task docs/reports/sit-migration-prompts/wave14-B1a-systems-table-split.md
/wave-task docs/reports/sit-migration-prompts/wave14-B1b-idc-process-status-split.md
/wave-task docs/reports/sit-migration-prompts/wave14-B1c-azure-project-page-split.md
/wave-task docs/reports/sit-migration-prompts/wave14-C1-admin-dashboard-reducer.md
/wave-task docs/reports/sit-migration-prompts/wave14-E1b-ip-row-stable-id.md
```

각 파이프라인: worktree → implement → self-audit → PR → auto-fix → merge wait. Phase 8 에서 사용자 지시 대기.

## Deferred to Wave 15+

| 항목 | 카운트 | 이유 |
|------|-------|------|
| **H1 Inline `<svg>` migration** | 88 feature files | 파일별 icon 매핑 테이블 선작성 필요, cloud provider 별 분할 |
| **B1 잔여 god-component** | `IdcProjectPage.tsx` 378, `admin/dashboard/page.tsx` 359, `gcp/GcpProjectPage.tsx` 314, `ProcessStatusCard.tsx` 349, `sdu/SduProcessStatusCard.tsx` 346 | wave14 이후 재평가 |
| **C1 GcpProjectPage** | 10 useState | wave14 이후 남으면 spec 작성 |
| **F4 try/catch 분류 audit** | 65 | ADR-008 boundary 위반 여부 분리 선행 |
| **A1 mock non-null** | 35 | convention policy 결정 선행 |

## Related

- Wave 11 README: `wave11-README.md`
- Wave 12 README: `wave12-README.md`
- Wave 13 README: `wave13-README.md`
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md`
- Skill: `.claude/skills/anti-patterns/SKILL.md`
- Pipeline: `.claude/skills/wave-task/SKILL.md`
