# projectId 폐기 — Migration Plan

**Goal.** `projectId` legacy 개념을 코드베이스에서 **완전히 제거**하고 `targetSourceId`로 단일화한다. 이관 완료 후 코드베이스는 **단순**해야 한다 (abstractions 제거, double-lookup 제거, 1:1 mapping 제거).

**Baseline.** origin/main HEAD `2b4f641` (2026-04-23). PR #309/#310/#311 머지 이후 재검증 완료 — 모두 projectId 직접 영향 없음. 이 계획의 주요 전제는 여전히 유효.

**Scope.** Frontend(Next.js 14 App Router) + BFF proxy layer + mock 전체. Cloud Provider native의 `projectId`(GCP Project ID 같은 외부 개념)는 **보존**한다.

---

## 배경

- `projectId`는 과거 mock 내부 식별자 (`"aws-project-1"` 같은 string). 현재는 `targetSourceId` (외부 계약, `number`)가 단일 진입점.
- BFF 업스트림은 이미 `/target-sources/{id}` 패턴으로 통일되어 있음 (`lib/bff/client.ts` 깨끗함).
- **혼재 표면**: URL 세그먼트명만 `[projectId]`, mock store 키가 `projectId`, `lib/api-client/types.ts` 파라미터명이 `projectId`, 타입 3개에 `projectId` 필드 잔존.
- 이를 잇는 **"glue" 레이어**가 `app/api/_lib/target-source.ts::resolveProjectId()` — **59개 BFF route에서 `targetSourceId → projectId` 역조회를 매번 수행**. 이 어댑터가 legacy 개념을 살려놓는 유일한 기둥.

## 핵심 발견

| 영역 | 현황 | 조치 |
|---|---|---|
| BFF 업스트림 계약 | 이미 `/target-sources/{id}` 통일 | 유지 |
| `lib/bff/client.ts` | projectId 참조 0건 | 유지 |
| URL route segment | `[projectId]` 1개 라우트 (실제 값은 targetSourceId) | **rename** (W1) |
| Mock provider stores | `{[projectId: string]: ...}` key 사용 | **pivot to targetSourceId** (W2) |
| `resolveProjectId()` helper | 59 route에서 호출 | **삭제** (W2) |
| 타입 필드 `projectId: string` | `ScanJob`, `ScanHistory`, `ProjectHistory` 3개 | **rename to `targetSourceId: number`** (W2) |
| `ConfirmResourceMetadata.projectId` | **GCP native 개념** (외부) | **유지** — 혼동 금지 |
| `app/projects/[projectId]/` 폴더 | 라우트 아닌 컴포넌트 저장소 (21 파일) | **dissolve** → route 폴더 내부로 이동 (W3) |
| `lib/api-client/types.ts` | 50+ 메서드가 `(projectId: string)` 파라미터 사용 | **param rename** (W4) |
| `integrationRoutes.project()` | 4 call site 모두 targetSourceId 전달 | **함수명 rename** (W4) |
| Swagger | `user.yaml` 이미 migrated 마킹, `confirm.yaml` GCP native 유지 | **touch 최소** (W5) |
| ADR / reports | 역사 기록 | **수정 금지** |

**Measured impact (code only, verified against origin/main HEAD `2b4f641` on 2026-04-23):**
- 723 `projectId` occurrences across ~114 files
- **59** BFF route 파일이 `resolveProjectId` 호출
- **10** mock 파일 + 3 test 파일 업데이트 (mock-test-connection.ts 포함, 11건)
- 4 `integrationRoutes.project()` call sites
- **21** 파일 이동 (`app/projects/` 해체, `ProjectIdentityCard`/`DeleteInfrastructureButton` 포함)
- `lib/api-client/types.ts` 의 55 `projectId: string` 파라미터

## Simplify 관점 — 이 이관이 제거하는 복잡도

단순한 rename 이관이 아니라 **구조적 단순화**다. 제거되는 요소:

1. **이중 조회 제거**. 현재 모든 BFF route가 `parseTargetSourceId → resolveProjectId → mockFn(projectId)` 3단계. `resolveProjectId` 삭제 후 `parseTargetSourceId → mockFn(targetSourceId)` 2단계.
   - 삭제 LOC: 59 routes × 3-4 lines ≈ **~200 LOC**
   - 파생 삭제: `getProjectIdByTargetSourceId`, `getTargetSourceIdByProjectId`, `resolveProject` helper — mock-data.ts, target-source.ts

2. **이중 식별자 삭제**. `Project.id`(projectId)와 `Project.targetSourceId`가 공존하던 store에서 `id` 역할 축소 (`projectCode`는 별개, 유지). store 인덱싱이 `targetSourceId` 단일.

3. **URL/데이터 라벨 일치**. `[projectId]` 세그먼트에 실제로 `targetSourceId`가 들어가는 misleading naming 해소.

4. **API client 계층 파라미터 이름 의미 일치**. `confirm.getResources(projectId: string)`에 실제로 `String(targetSourceId)`을 전달하던 관행 제거.

5. **폴더 구조 정합**. `app/projects/`(라우트 아님) + `app/integration/projects/`(실제 라우트) 이중 구조 → `app/integration/projects/[targetSourceId]/` 단일.

**Non-goal** (이 이관에서 건드리지 않음):
- `Project` interface 자체의 의미적 정리 (도메인 명칭 "과제"로서의 Project UI 명은 유지)
- `ProjectDetail`, `ProjectPageMeta`, `ProjectInfoCard` 등 컴포넌트 **파일명** rename (`Project*` → `TargetSource*` 은 별도 wave에서 판단, 이번엔 touch 안 함)
- ADR 문서 수정 (역사 기록)
- 이미 targetSourceId로 일관된 BFF client (`lib/bff/client.ts`)

---

## Wave 구성

| Key | Title | Scope | Est. LOC Δ | Depends on |
|---|---|---|---|---|
| `wave1-route-segment` | URL 세그먼트 rename | `[projectId]` → `[targetSourceId]` folder + `lib/routes.ts` param name | +10 / −15 | — |
| `wave2-mock-pivot` | Mock store pivot + resolver 제거 | 10 mock 파일 + 59 routes + `lib/types.ts` 3 필드 + `target-source.ts` | +40 / −250 | — |
| `wave3-component-relocate` | `app/projects/` 폴더 해체 | 21 파일 이동 + 4 import 경로 | ±0 (이동 위주) | W1 |
| `wave4-api-contract-rename` | API client 파라미터 + `integrationRoutes` rename | `lib/api-client/types.ts` param names + routes.ts + 4 call sites | +10 / −10 | — |
| `wave5-docs-sync` | Swagger + docs/api 동기화 | `docs/api/**`, `docs/swagger/*.yaml` | ±50 | W1-W4 완료 |

## 병렬 실행 전략

```
Batch 1 (parallel, 3 agents — disjoint files):
  ├── /wave-task wave1-route-segment
  ├── /wave-task wave2-mock-pivot
  └── /wave-task wave4-api-contract-rename

Batch 2 (serial — W1 merge 필요):
  └── /wave-task wave3-component-relocate

Batch 3 (serial — 모든 코드 이관 merge 필요):
  └── /wave-task wave5-docs-sync
```

### File-level non-overlap (verified)

| Spec | Files it modifies |
|---|---|
| W1 | `app/integration/projects/[projectId]/**` (rename), `app/projects/[projectId]/**` (rename), `lib/routes.ts` (param name only) |
| W2 | `lib/types.ts` (3 interfaces), `lib/mock-*.ts` (10 files — mock-test-connection 포함), `app/api/_lib/target-source.ts`, `lib/mock-data.ts` (2 helpers 삭제), `app/integration/api/v1/**/route.ts` (59 files), `lib/__tests__/*.test.ts` (3 files) |
| W3 | `app/projects/**` (삭제), `app/integration/projects/[targetSourceId]/_components/**` (생성), 4 import call sites |
| W4 | `lib/api-client/types.ts`, `lib/routes.ts` (function name), 4 `integrationRoutes.project()` call sites, `lib/api-client/mock/**` (signature match) |
| W5 | `docs/api/**/*.md`, `docs/swagger/user.yaml`, `docs/swagger/confirm.yaml`, `docs/detail-page.md` (if exists) |

**W1과 W4 모두 `lib/routes.ts`를 만짐** — W1은 파라미터명만, W4는 함수명. 같은 파일이라 직렬 권장. 아래 배치에서 조정:

```
Batch 1 (parallel, 2 agents):
  ├── /wave-task wave1-route-segment     (lib/routes.ts param)
  └── /wave-task wave2-mock-pivot

Batch 2 (parallel, 2 agents — both need W1 merged):
  ├── /wave-task wave3-component-relocate
  └── /wave-task wave4-api-contract-rename   (lib/routes.ts function — W1과 직렬)

Batch 3: wave5-docs-sync
```

## Invocation

```
/wave-task docs/reports/projectid-removal/wave1-route-segment.md
/wave-task docs/reports/projectid-removal/wave2-mock-pivot.md
/wave-task docs/reports/projectid-removal/wave3-component-relocate.md
/wave-task docs/reports/projectid-removal/wave4-api-contract-rename.md
/wave-task docs/reports/projectid-removal/wave5-docs-sync.md
```

각 파일은 `/wave-task`의 입력으로 바로 사용 가능한 self-contained 프롬프트. 또는 fresh Claude Code 세션에 전체 붙여넣기.

## Out of scope / Deferred

- **`client.projects.*` / `client.confirm.*` 함수명 rename** — Big blast radius (mock implementations + 모든 call sites). 파라미터명 통일(W4)로 의미는 일치시키고, 함수명 rename은 별도 wave.
- **컴포넌트 파일명 rename** (`ProjectDetail.tsx` → `TargetSourceDetail.tsx` 등) — UI 도메인 용어 "과제(Project)"는 유지가 타당. 요구시 별도 wave.
- **ADR / `docs/reports/**`** — 역사 기록은 수정하지 않음.
- **Cloud Provider native `projectId`** (GCP Project ID 등) — 외부 계약. `ConfirmResourceMetadata.projectId` 및 `confirm.yaml` GcpMetadata 스키마는 **유지**.
- **`generateTfStatus(projectId)` 해시 시드 같은 내부 로직** — W2에서 타입만 맞추고 식은 그대로 (`String(targetSourceId)` 넘김).

## Related

- Inventory (raw findings): `inventory.md`
- API 경계: `docs/api/boundaries.md`
- ADR-007 (API client pattern): `docs/adr/007-api-client-pattern.md` — 수정 대상 아님, 참고용
- Swagger "migrated" 마킹 패턴: `docs/swagger/user.yaml:15-58`
- Pipeline skill: `.claude/skills/wave-task/SKILL.md`
