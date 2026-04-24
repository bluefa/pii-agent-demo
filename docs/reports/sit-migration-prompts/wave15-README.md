# Wave 15 — Post-wave14 Audit Follow-up

Post-wave14 main @ `a1c42fa` 실측 기반 재계획. **IDC/SDU 관련 파일은 deprecated 로 제외**.

## Audit delta (post-wave14)

| 카테고리 | wave13 end | wave14 end | wave15 target |
|---------|-----------|-----------|--------------|
| F1 alert() | 30 | 0 | ✅ clean |
| A1 non-null (app/) | 4 | 0 | ✅ clean |
| A2 prod casts | 2 | 0 | ✅ clean |
| A5 any | 0 | 0 | ✅ clean |
| E1 array-index key | 4 | 3 | ✅ all necessary skeleton |
| E5 template className | 0 | 2 | 🟡 fix in wave15-B1a |
| B1 god-components (>300) | 10+ | **10** | 4 targets (non-IDC/SDU) |
| C1 useState (10+) | 3 | **3** | AWS/Azure/GCP 3-way |
| H1 inline SVG | 95 | 99 | foundation (code 변경 X) |

### B1 잔여 god-components (non-IDC/SDU)

| 파일 | LOC | Wave15 spec |
|------|-----|-------------|
| `admin/dashboard/page.tsx` | 359 | (wrapper, 우선순위 낮음) |
| `AdminDashboard.tsx` | 347 ⚠️ | **wave15-B1a** |
| `AzureProjectPage.tsx` | 339 | **wave15-C1** (훅 추출로 자연 축소) |
| `QueueBoard.tsx` | 331 | **wave15-B1b** |
| `SystemsTableFilters.tsx` | 322 | **wave15-B1c** |
| `AwsProjectPage.tsx` | 302 | **wave15-C1** |

제외 (deprecated):
- ~~`IdcResourceInputPanel.tsx` 388~~
- ~~`SduProcessStatusCard.tsx` 346~~
- ~~`AwsInstallationInline.tsx` 412 / `AzureInstallationInline.tsx` 342~~ (내부 rendering 복잡, wave16+)

## Specs (5 items)

| Key | Title | LOC Δ 예상 | Depends |
|-----|-------|-----------|---------|
| **wave15-C1** | AWS/Azure/GCP ProjectPage 공통 훅 2개 | +95 / -150 | — |
| **wave15-B1a** | AdminDashboard reducer/union/types 분리 | +80 / -90 | — |
| **wave15-B1b** | QueueBoard split | +100 / -120 | — |
| **wave15-B1c** | SystemsTableFilters split + 4 icon 추출 | +120 / -150 | — |
| **wave15-H1** | Icons migration foundation (docs only) | +250 / 0 | — |

## Parallel execution

**5-way parallel 가능** — 모든 spec 이 file-disjoint.

```
세션 1: /wave-task docs/reports/sit-migration-prompts/wave15-C1-project-page-hooks.md
세션 2: /wave-task docs/reports/sit-migration-prompts/wave15-B1a-admin-dashboard-slim.md
세션 3: /wave-task docs/reports/sit-migration-prompts/wave15-B1b-queue-board-split.md
세션 4: /wave-task docs/reports/sit-migration-prompts/wave15-B1c-systems-table-filters-split.md
세션 5: /wave-task docs/reports/sit-migration-prompts/wave15-H1-icons-foundation.md
```

## File-level non-overlap (verified)

| Spec | Files |
|------|-------|
| C1 | `_components/shared/useProjectPage*` (new), 3 provider ProjectPage |
| B1a | `features/AdminDashboard.tsx` + `admin-dashboard/**` (new) |
| B1b | `features/queue-board/**` |
| B1c | `features/dashboard/SystemsTableFilters.tsx` + `systems-table-filters/**` + `ui/icons/*` (4 신규) |
| H1 | `docs/reports/h1-*.md` only |

## Key insights

### ✅ 최초 clean 상태
- F1 alert, A1 non-null, A2 risky casts, A5 any 모두 0 — wave11-13 의 누적 효과

### 🔑 #342 효과로 3-way 동형 수렴
Post-#342 AWS/Azure/GCP ProjectPage 의 useState 구조가 거의 동일. Wave15-C1 이 가장 큰 ROI (C1 3건 + B1 3건 동시).

### ⚠️ Reducer boilerplate 역설
wave14-C1 에서 AdminDashboard 267 → 347 LOC 증가 (useState 11 → 4). state 개수는 줄었지만 reducer 타입 + action union + helpers 가 main 파일에 남아있어 B1 위반. wave15-B1a 가 이를 sibling 파일로 분리해 해결.

## Deferred to wave16+

| 항목 | 이유 |
|------|------|
| `AwsInstallationInline` 412, `AzureInstallationInline` 342 | Provider 특이 rendering, split 설계 복잡 |
| `admin/dashboard/page.tsx` 359 | 얇은 wrapper 이지만 layout 로직 포함, 분석 필요 |
| H1 실제 migration (wave15-H1a..e) | Foundation 이후 순차 |
| IDC/SDU 모든 작업 | Deprecated scope |

## Related

- Wave 11 README: `wave11-README.md`
- Wave 12 README: `wave12-README.md`
- Wave 13 README: `wave13-README.md`
- Wave 14 README: `wave14-README.md`
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md`
- Skill: `.claude/skills/anti-patterns/SKILL.md`
- Pipeline: `.claude/skills/wave-task/SKILL.md`
