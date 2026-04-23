# Wave 12 — Follow-up Refactor Series

Wave 11 (PR #299, #301–#305) 에서 deferred 로 분류한 항목 중 우선순위 높은 2건의 spec.

## Specs

| Key | Title | Scope | Est. LOC Δ | Depends on |
|-----|-------|-------|-----------|------------|
| `wave11-B1` | IdcResourceInputPanel → useReducer | one feature component | +120 / -180 | wave11-A1 merged (✅ #305) |
| `wave12-B1` | ConnectionTestPanel god-component split | 1 main + 7 children + dynamic import | +400 / -350 | — |
| `wave12-B3` | InstallationInline hook extraction | 1 new hook + 3 component migrations | +55 / -72 | **wave11-A1-consumer (#306)** merged |

wave11-B1 은 `wave11-*` 시리즈 잔여 — 새 번호 부여하지 않음.

## Parallel execution strategy

```
Batch 1 (wave11-A1-consumer #306 merge 후):
  ├── /wave-task docs/reports/sit-migration-prompts/wave11-B1.md
  ├── /wave-task docs/reports/sit-migration-prompts/wave12-B1-ctp-split.md
  └── /wave-task docs/reports/sit-migration-prompts/wave12-B3-inst-unify.md
```

3건 모두 파일 overlap 없음. #306 merge 후 동시 실행 가능.

## File-level non-overlap (verified)

| Spec | Files it modifies |
|------|--------------------|
| wave11-B1 | `app/components/features/idc/IdcResourceInputPanel.tsx`, `app/components/features/idc/validation.ts` (new) |
| wave12-B1 | `app/components/features/process-status/ConnectionTestPanel.tsx`, `app/components/features/process-status/connection-test/**` (new) |
| wave12-B3 | `app/hooks/useInstallationStatus.ts` (new), `app/components/features/process-status/{aws,azure,gcp}/*InstallationInline.tsx` |

## Deferred (여전히 spec 미작성)

Wave 11 README 에서 deferred 로 분류 + 현 시점에도 spec 없는 항목:

| 항목 | 현재 실측 | 선행 조건 |
|------|-----------|-----------|
| `alert()` 제거 | 30 sites | 공용 Toast 컴포넌트 설계 결정 |
| `!` non-null 39 사이트 교체 | 39 sites (audit 15 → 증가) | grep-replace + guard 패턴 명세 |
| raw `<svg>` → icons module | 92 파일 | 파일별 대체 매핑, wave13+ 적합 |
| server state → React Query (C2) | — | Architectural design 선행 |
| ESLint rule 추가 | — | Repo-wide violation survey 선행 |

## Invocation

```
/wave-task docs/reports/sit-migration-prompts/wave11-B1.md
/wave-task docs/reports/sit-migration-prompts/wave12-B1-ctp-split.md
/wave-task docs/reports/sit-migration-prompts/wave12-B3-inst-unify.md
```

파이프라인: worktree → implement → self-audit → PR → auto-fix → merge wait.

## Related

- Wave 11 README: `wave11-README.md`
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md`
- Skill: `.claude/skills/anti-patterns/SKILL.md`
- Pipeline: `.claude/skills/wave-task/SKILL.md`
