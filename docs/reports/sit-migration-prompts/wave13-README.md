# Wave 13 — Clean Code Audit Follow-ups

Audit 재조사 (2026-04-23, post wave11/12 merge snapshot) 에서 drawn 우선순위 상위 항목의 spec 5개.

## Audit snapshot (main @ `2b4f641`)

| 심각도 | 항목 | 카운트 | 이 wave 대응 |
|--------|------|-------|-------------|
| 🔴 | F1 `alert()` | 30 | F1a + F1b |
| 🔴 | A1 non-null `!` (feature code) | 4 (35 mock 제외) | A1 |
| 🔴 | A2 `as unknown as` (prod) | 2 (test 2 제외) | A2 |
| 🟡 | E1 array-index key | 19 | E1 |
| 🟢 | E5 template className | 57 | E1 (bundled) |
| ✅ | A5 `any` | 0 | — |
| ✅ | G7 vague params | 0 | — |

## Specs

| Key | Title | Scope | Est. LOC Δ | Depends on |
|-----|-------|-------|-----------|------------|
| `wave13-F1a` | Toast component foundation | `app/components/ui/toast/` new + layout mount | +250 / 0 | — |
| `wave13-F1b` | alert() migration (30 sites + 2 hooks) | project pages + feature files + shared hooks | +60 / −60 | F1a merged |
| `wave13-A1` | 4 feature-code non-null assertions | 3 files | +10 / −10 | — |
| `wave13-A2` | 2 prod `as unknown as` → runtime validation | `lib/bff/http.ts`, `lib/api-client/mock/confirm.ts` | +40 / −4 | — |
| `wave13-E1` | Array index key (19) + template className (57) | ~40 files | +100 / −100 | F1b, A1 merged |

## Parallel execution strategy

```
Batch 1 (3-way parallel, no file overlap):
  ├── /wave-task docs/reports/sit-migration-prompts/wave13-F1a-toast-foundation.md
  ├── /wave-task docs/reports/sit-migration-prompts/wave13-A1-nonnull-features.md
  └── /wave-task docs/reports/sit-migration-prompts/wave13-A2-risky-casts.md

Batch 2 (after F1a merged):
  └── /wave-task docs/reports/sit-migration-prompts/wave13-F1b-alert-migration.md

Batch 3 (after F1b + A1 merged — avoids file overlap):
  └── /wave-task docs/reports/sit-migration-prompts/wave13-E1-grep-fixable.md
```

## File-level non-overlap (verified 2026-04-23)

| Spec | Files touched |
|------|---------------|
| F1a | `app/components/ui/toast/**` (new), `app/layout.tsx`, `lib/constants/timings.ts` |
| F1b | `app/hooks/{useApiMutation,useAsync}.ts`, 5 project pages, 5 feature files |
| A1 | `ResourceTransitionPanel.tsx`, `ProcessGuideStepCard.tsx`, `ResourceRow.tsx` |
| A2 | `lib/bff/http.ts`, `lib/api-client/mock/confirm.ts` |
| E1 | ~40 .tsx files with either array index key or template className |

**Conflict edges**:
- F1b ↔ E1: share project page files (IdcProjectPage, SduProjectPage, etc.) → F1b 먼저
- A1 ↔ E1: share `ProcessGuideStepCard.tsx` (A1: 2 non-null, E1: 7 index keys) → A1 먼저
- F1a ↔ E1: share `app/layout.tsx` (F1a 가 Provider 마운트, E1 이 className 교체 가능) → F1a 먼저

## Invocation

```
/wave-task docs/reports/sit-migration-prompts/wave13-F1a-toast-foundation.md
/wave-task docs/reports/sit-migration-prompts/wave13-F1b-alert-migration.md
/wave-task docs/reports/sit-migration-prompts/wave13-A1-nonnull-features.md
/wave-task docs/reports/sit-migration-prompts/wave13-A2-risky-casts.md
/wave-task docs/reports/sit-migration-prompts/wave13-E1-grep-fixable.md
```

파이프라인: worktree → implement → self-audit → PR → auto-fix → merge wait.

## Deferred to Wave 14+

| 항목 | 카운트 | 이유 |
|------|-------|------|
| **B1 God components** (SystemsTable 491, AzureProjectPage 451, IdcProcessStatusCard 405, 등 10 files) | 10 | 각각 ConnectionTestPanel 수준의 설계 spec 필요 — wave14 개별 spec 생성 |
| **C1 Scattered form state** (AzureProjectPage 16, AdminDashboard 12, GcpProjectPage 11) | 3 pages | wave11-B1 의 useReducer 패턴 재적용 — 각 page 별 spec |
| **H1 Inline `<svg>`** | 88 feature files | 대규모 migration — icons module 매핑 + per-file review 필요. Wave14+ 배치 |
| **F4 try/catch by hand** | 65 | ADR-008 위반 여부 분리 audit 선행 (boundary vs intentional) |
| **A1 mock non-null** | 35 | `lib/api-client/mock/**` 의 auth-narrowing convention — policy decision 필요 (convention 유지 vs type narrowing 강제) |

## Related

- Wave 11 README: `wave11-README.md`
- Wave 12 README: `wave12-README.md`
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md`
- Skill: `.claude/skills/anti-patterns/SKILL.md` (44 patterns)
- Pipeline: `.claude/skills/wave-task/SKILL.md`
