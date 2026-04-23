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
| `lib/bff/mock-adapter.ts` | `getProjectIdByTargetSourceId` import + 자체 `resolveProjectId` 내부 함수 | **단순화** (W2) — legacy helper 의존 제거 |
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

## Status (2026-04-24)

| Wave | Status | PR |
|---|---|---|
| W0 — behavior lock-in tests | ✅ merged | #322 |
| W1 — route segment `[projectId]` → `[targetSourceId]` | ✅ merged | #320 |
| W2 — mock store pivot + `resolveProjectId` 제거 | ✅ merged | #328 |
| W3 — `app/projects/` 해체 → route `_components/` colocate | ✅ merged | #324 |
| W4 — API client param + `integrationRoutes` rename | ✅ merged | #325 |
| W6 — URL 경로 `/integration/projects/` → `/integration/target-sources/` | ✅ merged | #329 |
| W5 — docs/swagger 동기화 | 🟢 (current) | — |

코드 측 projectId → targetSourceId 전환은 완료되었고, 본 wave(W5)가 docs 동기화로 전체 migration을 종료합니다.

## Wave 구성

| Key | Title | Scope | Est. LOC Δ | Depends on |
|---|---|---|---|---|
| `wave0-test-scaffolding` | Behavior lock-in tests (선행 안전망) | `lib/__tests__/mock-sdu|gcp|test-connection.test.ts` 신규 | +670 / −0 (순수 테스트) | — |
| `wave1-route-segment` | URL 세그먼트 rename | `[projectId]` → `[targetSourceId]` folder + `lib/routes.ts` param name | +10 / −15 | — |
| `wave2-mock-pivot` | Mock store pivot + resolver 제거 + `mock-adapter.ts` 단순화 | 10 mock 파일 + 59 routes + `lib/types.ts` 3 필드 + `target-source.ts` + `lib/bff/mock-adapter.ts` | +40 / −260 | **W0** |
| `wave3-component-relocate` | `app/projects/` 폴더 해체 | 21 파일 이동 + 4 import 경로 | ±0 (이동 위주) | W1 |
| `wave4-api-contract-rename` | API client 파라미터 + `integrationRoutes` rename | `lib/api-client/types.ts` param names + routes.ts + 4 call sites | +10 / −10 | — |
| `wave6-url-path-rename` | URL 경로 `/integration/projects/` → `/integration/target-sources/` | 폴더 rename + `lib/routes.ts` URL 리터럴 + TopNav + `_components/` 절대경로 | +15 / −15 | W3, W4 |
| `wave5-docs-sync` | Swagger + docs/api 동기화 | `docs/api/**`, `docs/swagger/*.yaml` | ±50 | W1-W4, W6 완료 |

## Testing Strategy — 로직 보존 보장 (behavior preservation)

리팩토링의 핵심 약속은 **외부 관찰 가능한 동작이 변하지 않는다**는 것. 이 약속은 6-layer 방어선으로 보증한다:

| Layer | 수단 | 언제 | 보증 강도 | 놓치는 것 |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit` | 각 wave Step 5 | 🔒🔒🔒 타입 cascade | semantic 변화 (타입 OK 인 논리 오류) |
| 2 | 기존 vitest 스위트 | 각 wave Step 5 | 🔒🔒 assertion 동결 | **커버되지 않은 코드 경로** (sdu/gcp/test-conn 갭) |
| 3 | **Wave 0 behavior lock-in** (신규, 값 기반 + snapshot) | W2 **전** 선행 | 🔒🔒🔒 sdu/gcp/test-conn 갭 메움 | Wave 0 assertion 품질에 의존 |
| 4 | **Response Parity** (mock byte-level diff) | W2 Step 5 Layer 6 | 🔒🔒🔒 **가장 강력** — 실제 HTTP 응답 동일성 증명 | 시간/UUID 필드는 필터 필요 |
| 5 | Dev 수동 E2E 매트릭스 (5 provider × 5 flow) | 각 wave Step 5.5 | 🔒 integration 스모크 | 사람 실수 |
| 6 | grep 잔여 검증 | 각 wave Step 5 | 🔒 정적 잔여 감지 | 런타임 동작 |

### Wave 별 검증 강도

| Wave | Layer 1 tsc | Layer 2 vitest | Layer 3 W0 테스트 | Layer 4 E2E | Layer 5 grep |
|---|---|---|---|---|---|
| W0 | ✓ | ✓ (신규 통과) | N/A (자신이 W0) | 불필요 | — |
| W1 | ✓ | page.test.ts | — (W0 W2 전용) | 라우팅 smoke | `[projectId]` → 0건 |
| **W2** | **✓ 필수** | **✓ 필수 (fixture rewrite, assertion 유지)** | **✓ 필수 (sdu/gcp/test-connection 통과)** | **5 provider 전부** | resolver grep 0 |
| W3 | ✓ | page.test.ts | — | 5 provider 렌더 | `app/projects` → 0건 |
| W4 | ✓ | ✓ | — | admin/task dashboard | `integrationRoutes.project` → 0건 |
| W5 | ✓ (문서도 tsc 안전) | ✓ | — | N/A | projectId in docs |

### 핵심 원칙

1. **W2 의 테스트 변경 범위는 fixture 의 타입만** — assertion 은 그대로. `expect(result.data?.provider).toBe('SDU')` 같은 behavior 검증은 W2 에서 **단 한 줄도 수정되지 않아야** behavior 보존 증명.
2. **W0 발견 quirk 는 W2 에서 수정하지 않는다** — 같은 quirk 가 W2 후에도 살아있어야 "logic unchanged". 개선은 별도 follow-up wave.
3. **Response Parity (Layer 4) 가 최종 증거** — 타입/테스트가 다 통과해도 실제 HTTP 응답이 다르면 사용자는 다른 화면을 봄. W2 에서 시간 필드 제외 **byte-identical** 이 통과 기준.
4. **Fixture 매핑 표는 W2 의 contract** — `projectId ↔ targetSourceId` 매핑을 `docs/reports/projectid-removal/id-mapping-snapshot.md` 에 박제 후 W2 PR 에 첨부. Wave 0 테스트의 string id 를 number id 로 교체할 때 이 표가 유일한 ground truth.
5. **해시/경로 입력 문자열 보존** — `mock-sdu` 의 S3 버킷명 `sdu-data-${projectId.slice(-8)}`, `mock-idc` 의 해시 기반 state 생성 등은 **원본 projectId string** 으로 계산되어야 동일 결과. `String(targetSourceId)` 대체 금지 — `getProjectByTargetSourceId(id).id` 로 원본 복원 후 사용.

### 한계 (honest limitations)

이 전략이 보장하지 못하는 것:

1. **BFF 모드 (`USE_MOCK_DATA=false`) 실서비스 동작**
   - `httpBff` path 는 원래부터 `String(targetSourceId)` identity 변환만 수행 (resolveProjectId 안 거침) → 실제 변경 사항 없음. 하지만 실제 upstream BFF 연동은 개발자가 staging 환경에서 직접 확인해야 함. 이 계획에서는 증명 불가.
2. **UI 인터랙션 타이밍/에러 edge case**
   - E2E 매트릭스는 happy path 5×5 만. 네트워크 실패, polling timeout, race condition 은 수동 검증 불가. Playwright/Cypress 도입 없이는 증명 한계.
3. **Wave 0 assertion 품질에 의존**
   - `expect.any(String)` 같은 loose assertion 만 있으면 Layer 3 무력화. Wave 0 스펙 §3-0.5 의 assertion 품질 가이드 준수가 전제.
4. **Production 코드에 숨겨진 비결정성**
   - `Math.random()`, `process.env` 읽기 등이 내부에 있으면 Layer 4 parity diff 가 false positive. 발견 시 snapshot 에서 필터 or production 에서 seed 주입.
5. **W2 의 scope 외 behavior 변화 (의도된)**
   - mock-adapter.ts 의 404 에러 발생 위치가 바뀜 (`resolveProjectId` 내부 → `mockTargetSources.get` 내부). 에러 shape 은 유지되지만 stack trace 미묘하게 다를 수 있음 — 사용자 관찰 불가 영역이므로 수용.

### File-level non-overlap (verified)

| Spec | Files it modifies |
|---|---|
| W1 | `app/integration/projects/[projectId]/**` (rename), `app/projects/[projectId]/**` (rename), `lib/routes.ts` (param name only) |
| W2 | `lib/types.ts` (3 interfaces), `lib/mock-*.ts` (10 files — mock-test-connection 포함), `app/api/_lib/target-source.ts`, `lib/mock-data.ts` (2 helpers 삭제), `app/integration/api/v1/**/route.ts` (59 files), `lib/__tests__/*.test.ts` (3 files) |
| W3 | `app/projects/**` (삭제), `app/integration/projects/[targetSourceId]/_components/**` (생성), 4 import call sites |
| W4 | `lib/api-client/types.ts`, `lib/routes.ts` (function name), 4 `integrationRoutes.project()` call sites, `lib/api-client/mock/**` (signature match) |
| W5 | `docs/api/**/*.md`, `docs/swagger/user.yaml`, `docs/swagger/confirm.yaml`, `docs/detail-page.md` (if exists) |

**W1과 W4 모두 `lib/routes.ts` 를 만짐** — W1은 파라미터명, W4는 함수명. diff 충돌은 사소하지만 리뷰 friction을 피하기 위해 **직렬** 실행.

## 병렬 실행 전략

```
Batch 1 (parallel, 2 agents — disjoint files):
  ├── /wave-task wave0-test-scaffolding   (behavior lock-in, W2 blocker)
  └── /wave-task wave1-route-segment       (lib/routes.ts param rename 포함)

Batch 2 (parallel, 3 agents — W0 + W1 merge 후):
  ├── /wave-task wave2-mock-pivot          (W0 필수 — 테스트 안전망)
  ├── /wave-task wave3-component-relocate  (W1 필수)
  └── /wave-task wave4-api-contract-rename (lib/routes.ts 함수명 — W1과 직렬 후 진행)

Batch 3 (serial — W3 + W4 merge 후):
  └── /wave-task wave6-url-path-rename     (URL 경로 /integration/projects → /integration/target-sources)

Batch 4 (serial — W1-W4, W6 merge 후):
  └── /wave-task wave5-docs-sync
```

## Invocation

```
/wave-task docs/reports/projectid-removal/wave0-test-scaffolding.md
/wave-task docs/reports/projectid-removal/wave1-route-segment.md
/wave-task docs/reports/projectid-removal/wave2-mock-pivot.md
/wave-task docs/reports/projectid-removal/wave3-component-relocate.md
/wave-task docs/reports/projectid-removal/wave4-api-contract-rename.md
/wave-task docs/reports/projectid-removal/wave6-url-path-rename.md
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
