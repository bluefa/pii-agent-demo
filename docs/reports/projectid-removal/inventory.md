# projectId 폐기 — 전수 조사 증거 (inventory)

각 Wave 스펙의 레퍼런스. file:line 증거 모음. 본 문서는 **읽기 전용 레퍼런스** — 수정 금지 (작업이 진행되면 실제 파일이 변하므로, 이 스냅샷은 origin/main HEAD `2b4f641` 기준 / 2026-04-23).

> 참고: PR #309 (`useInstallationStatus` hook) / #310 (connection-test children) / #311 (IdcResourceInputPanel useReducer) 머지 반영됨. 모두 projectId 직접 영향 없음 — 신규 hook/컴포넌트는 이미 `targetSourceId: number` 기반.

---

## 1. URL 세그먼트 (Route)

### 1.1 실제 라우트
- `app/integration/projects/[projectId]/page.tsx` — 라우트 존재, 내부에서 `targetSourceId` 변환:
  ```tsx
  // line 6-10
  interface PageProps {
    params: Promise<{ projectId: string }>;
  }
  export default async function ProjectDetailPage({ params }: PageProps) {
    const targetSourceId = Number((await params).projectId);
  ```
- `app/integration/projects/[projectId]/layout.tsx` — TopNav + bg 래퍼. params 사용 없음.
- `app/integration/projects/[projectId]/error.tsx:3` — `import { ErrorState } from '@/app/projects/[projectId]/common';`
- `app/integration/projects/[projectId]/page.test.ts:23,27,31,33` — mock path + import path + describe 라벨에 `[projectId]`

### 1.2 라우트 아님 (컴포넌트 저장소)
- `app/projects/[projectId]/` — **page.tsx 없음**. 21개 파일 (트리 섹션 참고).

### 1.3 URL 생성
- `lib/routes.ts:5` — `project: (projectId: number | string) => \`/integration/projects/${projectId}\``

---

## 2. `integrationRoutes.project()` call sites (총 4)

- `app/components/features/AdminDashboard.tsx:160` — `router.push(integrationRoutes.project(targetSourceId));`
- `app/components/features/AdminDashboard.tsx:165` — `router.push(integrationRoutes.project(targetSourceId));`
- `app/components/features/queue-board/TaskDetailModal.tsx:70` — `href={integrationRoutes.project(item.targetSourceId)}`
- `design/components/features/admin/ProjectsTable.tsx:107` — `onClick={() => router.push(integrationRoutes.project(project.targetSourceId))}` (SIT 시안, 비프로덕션)

**모든 호출자가 이미 `targetSourceId` 값을 전달한다** — 함수 파라미터명만 불일치.

---

## 3. `app/projects/[projectId]/` 폴더 트리 (21 파일)

```
app/projects/[projectId]/
├── ProjectDetail.tsx                          # Provider별 분기 라우팅
├── common/
│   ├── ErrorState.tsx                         # 공통 에러 UI
│   ├── LoadingState.tsx
│   ├── ProjectPageMeta.tsx                    # 페이지 헤더 (공통)
│   ├── ProjectIdentityCard.tsx                # 신규 (PR #303) — brand gradient 헤더
│   ├── DeleteInfrastructureButton.tsx         # 신규 — 우측 상단 삭제 버튼
│   ├── RejectionAlert.tsx
│   └── index.ts                               # re-export
├── aws/
│   ├── AwsProjectPage.tsx
│   └── index.ts
├── azure/
│   ├── AzureProjectPage.tsx
│   ├── AzureSubnetGuide.tsx                   # 외부에서도 import됨 (밑의 역참조)
│   └── index.ts
├── gcp/
│   ├── GcpProjectPage.tsx
│   └── index.ts
├── idc/
│   ├── IdcProjectPage.tsx
│   ├── IdcProcessStatusCard.tsx
│   └── index.ts
└── sdu/
    ├── SduProjectPage.tsx
    ├── SduProcessStatusCard.tsx
    └── index.ts
```

### 3.1 역참조 (이 폴더 밖에서 이 폴더로의 import)
- `app/integration/projects/[projectId]/page.tsx:2-3` — `ProjectDetail`, `ErrorState`
- `app/integration/projects/[projectId]/error.tsx:3` — `ErrorState`
- `app/integration/projects/[projectId]/page.test.ts:23,27` — vi.mock 경로
- `app/components/features/process-status/azure/AzureInstallationInline.tsx:10` — `AzureSubnetGuide`

**총 4개 외부 import 경로** (mock 경로 1 + 런타임 import 3).

---

## 4. 타입 필드 `projectId` (lib/types.ts)

### 4.1 제거 대상 — 3개 타입

- `lib/types.ts:444-459` — `ScanJob`:
  ```ts
  export interface ScanJob {
    id: string;
    projectId: string;   // ← LEGACY
    provider: CloudProvider;
    status: ScanStatus;
    // ...
  }
  ```
- `lib/types.ts:461-471` — `ScanHistory`:
  ```ts
  export interface ScanHistory {
    id: string;
    projectId: string;   // ← LEGACY
    scanId: string;
    // ...
  }
  ```
- `lib/types.ts:752-759` — `ProjectHistory`:
  ```ts
  export interface ProjectHistory {
    id: string;
    projectId: string;   // ← LEGACY
    type: ProjectHistoryType;
    // ...
  }
  ```

### 4.2 보존 대상 — GCP native

- `lib/types.ts:800-810` — `ConfirmResourceMetadata`:
  ```ts
  export interface ConfirmResourceMetadata {
    provider: CloudProvider;
    // ...
    projectId?: string;   // ← GCP Cloud Project ID (외부 개념). 유지!
    rawResourceType?: string;
    subscriptionId?: string;
    // ...
  }
  ```

이 필드는 GCP 리소스 메타데이터의 GCP Project ID를 담으며, legacy 내부 projectId와 다른 개념이다.

### 4.3 보존 대상 — Project 인터페이스 (도메인)

- `lib/types.ts:236-287` — `Project` (id, targetSourceId, projectCode, ... 동시 존재). 도메인 UI 명칭이므로 이번 이관에서 구조 변경 없음.

---

## 5. `app/api/_lib/target-source.ts` — resolver 기둥

파일 전체 내용 (89 LOC). 이 이관에서 **대부분 삭제** 대상:

```ts
// line 15-28: parseTargetSourceId — 유지 (번호 검증 필요)
export function parseTargetSourceId(param: string, requestId: string): ParseResult { ... }

// line 30-55: resolveProjectId — 삭제
export function resolveProjectId(
  targetSourceId: number,
  requestId: string,
): { ok: true; projectId: string } | { ok: false; problem: ProblemDetails } {
  if (!IS_MOCK) {
    return { ok: true, projectId: String(targetSourceId) };  // ← BFF 모드는 identity
  }
  const projectId = getProjectIdByTargetSourceId(targetSourceId);
  if (!projectId) { return { ok: false, problem: ... }; }
  return { ok: true, projectId };
}

// line 61-88: resolveProject — 삭제 또는 targetSourceId 직접 받도록 전환
export function resolveProject(targetSourceId: number, requestId: string) { ... }
```

**59개 BFF route가 `resolveProjectId`를 호출** (리스트는 §7 참고). 이 함수의 삭제 = 이관의 핵심 단순화.

---

## 6. Mock 레이어

### 6.1 Mock 파일 목록 (provider별 store)
- `lib/mock-sdu.ts` — 65 건 (store key + 함수 파라미터)
- `lib/mock-idc.ts` — 33 건
- `lib/mock-azure.ts` — 30 건
- `lib/mock-history.ts` — 22 건
- `lib/mock-scan.ts` — 17 건
- `lib/mock-installation.ts` — 13 건
- `lib/mock-test-connection.ts` — 11 건 ← 2026-04-23 update: 누락 보정
- `lib/mock-gcp.ts` — 10 건
- `lib/mock-data.ts` — 4 건 (주로 매핑 헬퍼)
- `lib/mock-store.ts` — 1 건

(영향 없는 mock: `lib/mock-dashboard.ts`, `lib/mock-service-settings.ts` — projectId 0건)

### 6.2 Store 구조 예시 (lib/mock-idc.ts:17-29)

```ts
interface IdcStore {
  installationStatus: Record<string, IdcInstallationStatus>;  // key: projectId
  serviceSettings: Record<string, IdcServiceSettings>;        // key: projectId
  resources: Record<string, IdcResourceInput[]>;              // key: projectId
}
```

### 6.3 매핑 헬퍼 (lib/mock-data.ts:855-868)
```ts
export const generateTargetSourceId = (): number => { ... };  // 유지

export const getProjectByTargetSourceId = (targetSourceId: number): Project | undefined =>
  getStore().projects.find(p => p.targetSourceId === targetSourceId);
  // ↑ 유지 가치 있음 — store에서 Project 객체 조회

export const getTargetSourceIdByProjectId = (projectId: string): number | undefined =>
  getStore().projects.find(p => p.id === projectId)?.targetSourceId;
  // ↑ 삭제 — 역방향 조회 불필요

export const getProjectIdByTargetSourceId = (targetSourceId: number): string | undefined =>
  getStore().projects.find(p => p.targetSourceId === targetSourceId)?.id;
  // ↑ 삭제 — resolveProjectId의 유일한 소비자
```

### 6.4 `getProjectById` 여전히 많이 쓰임
Mock 함수들이 내부 guard로 `const project = getProjectById(projectId)`를 함 — project 객체에서 `cloudProvider` 등을 꺼내기 위함. W2에서는 이 guard를 `getProjectByTargetSourceId(targetSourceId)`로 교체.

---

## 7. BFF Route (59 파일) — `resolveProjectId` 호출 사이트

패턴 (모든 route 동일):
```ts
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);    // ← W2에서 삭제
  if (!resolved.ok) return problemResponse(resolved.problem);    // ← W2에서 삭제

  const response = await client.idc.getInstallationStatus(resolved.projectId);
  //                                                       ↑ → String(parsed.value)로 변경
  // ...
});
```

### 파일 목록 (provider별)

**IDC (6 files):**
- `app/integration/api/v1/idc/target-sources/[targetSourceId]/confirm-firewall/route.ts`
- `.../resources/route.ts` (GET + POST)
- `.../resources/list/route.ts`
- `.../confirm-targets/route.ts`
- `.../check-installation/route.ts`
- `.../installation-status/route.ts`

**SDU (11 files):**
- `.../athena-tables/route.ts`
- `.../s3-upload/route.ts`, `.../s3-upload/check/route.ts`
- `.../source-ip/route.ts`, `.../source-ip/confirm/route.ts`, `.../source-ip/register/route.ts`
- `.../check-installation/route.ts`, `.../installation-status/route.ts`
- `.../iam-user/route.ts`, `.../iam-user/issue-aksk/route.ts`
- `.../connection-test/route.ts`, `.../connection-test/execute/route.ts`

**Azure (7 files):**
- `.../settings/route.ts`, `.../check-installation/route.ts`, `.../installation-status/route.ts`
- `.../subnet-guide/route.ts`
- `.../vm/check-installation/route.ts`, `.../vm/installation-status/route.ts`, `.../vm-terraform-script/route.ts`

**GCP (4 files):**
- `.../check-installation/route.ts`, `.../installation-status/route.ts`
- `.../scan-service-account/route.ts`, `.../terraform-service-account/route.ts`

**AWS (6 files):**
- `.../settings/route.ts`, `.../terraform-script/route.ts`, `.../verify-execution-role/route.ts`
- `.../installation-mode/route.ts`, `.../check-installation/route.ts`, `.../installation-status/route.ts`

**Common target-sources (5+ files):**
- `.../target-sources/[targetSourceId]/route.ts`
- `.../target-sources/[targetSourceId]/approval-requests/route.ts`, `.../cancel/route.ts`, `.../reject/route.ts`, `.../latest/route.ts`

정확한 수치는 `grep -rl "resolveProjectId" app/integration/api` 로 재검증.

---

## 8. `lib/api-client/types.ts` — 파라미터명 불일치

**145 LOC 단일 파일**. 파라미터명 `projectId: string` 사용하는 메서드 50+개:

### 8.1 네임스페이스별 파라미터명 혼재 현황

| 네임스페이스 | 파라미터명 | 라인 (예시) |
|---|---|---|
| `targetSources` | `projectId` | L12 |
| `projects` | `projectId` | L16-31 (15 methods) |
| `sdu` | `projectId` | L40-51 (12 methods) |
| `aws` | `projectId` | L54-58 (5 methods) |
| `azure` | `targetSourceId` ✓ | L61-68 |
| `gcp` | `targetSourceId` ✓ | L71-74 |
| `idc` | `projectId` | L78-84 |
| `scan` | `targetSourceId` ✓ | L120-123 |
| `confirm` | `projectId` | L129-144 (15 methods) |

**Azure/GCP/Scan만 이미 올바름.** 나머지 모두 `projectId` → `targetSourceId` rename 필요 (W4).

### 8.2 Mock 구현체도 같이 rename 필요
- `lib/api-client/mock/sdu.ts`, `.../idc.ts`, `.../aws.ts`, `.../confirm.ts`, `.../projects.ts`, `.../target-sources.ts` — 파라미터명 일치시켜야 TS 타입 통과.

---

## 9. 테스트 파일

- `lib/__tests__/mock-history.test.ts` — 13 건 (projectId 필터링 검증)
- `lib/__tests__/mock-scan.test.ts` — 8 건 (ScanJob.projectId 검증)
- `lib/__tests__/mock-target-source.test.ts` — 8 건 (양방향 매핑 검증, `getProjectIdByTargetSourceId` 등)
- `app/integration/projects/[projectId]/page.test.ts` — 4 건 (세그먼트 + import 경로)

---

## 10. 문서 / Swagger

### 10.1 Swagger (projectId 언급 — 2 파일)
- `docs/swagger/user.yaml` — **이미 "migrated" 마킹됨** (L15-58 Legacy API Replacement Map). 유지 또는 최종 정리.
- `docs/swagger/confirm.yaml` — L697 `GcpMetadata.projectId` (GCP native, **유지**)

나머지 13개 yaml: projectId 참조 없음.

### 10.2 Markdown docs (대량)
- `docs/api/**/*.md` — `/projects/{projectId}` 경로 패턴 사용 (provider별 6 파일, ~50 건)
- `docs/detail-page.md` — L8 라우트 정의 `/projects/[projectId]`, ~25 건
- `docs/adr/001/004/006/007` — 역사 기록. **수정 금지**
- `docs/reports/**` — 과거 세션 기록. **수정 금지**

### 10.3 Config / Scripts / Memory
- `package.json`, `tsconfig.json`, `next.config.ts`: projectId 참조 **없음**
- `scripts/*.sh`: 참조 **없음**
- `.claude/skills/**`: 참조 **없음**
- Auto-memory: 특별 기록 없음 (MEMORY.md)

---

## 11. 수치 요약

| 지표 | 값 |
|---|---|
| 전체 projectId 참조 (code, `*.ts` + `*.tsx`) | 723 |
| 전체 projectId 참조 파일 수 | ~114 |
| URL segment `[projectId]` 라우트 | 1 (`app/integration/projects/`) |
| 컴포넌트 저장소 `app/projects/[projectId]/` 파일 | 21 |
| 타입 필드 `projectId: string` (legacy) | 3 (ScanJob/ScanHistory/ProjectHistory) |
| 타입 필드 `projectId` (GCP native, 보존) | 1 (ConfirmResourceMetadata) |
| `resolveProjectId` 호출 route 파일 | 59 |
| `integrationRoutes.project()` call site | 4 |
| `lib/api-client/types.ts` `(projectId: ...)` 메서드 | 50+ |
| Mock 파일 (projectId 참조) | 10 |
| Swagger yaml (projectId, 비 GCP) | 1 (`user.yaml`, 이미 migrated) |
| Markdown docs (projectId 경로) | ~7 파일 (수정 대상) + ADR/reports (유지) |

---

## 12. 이관 불가 / 보존 대상 (Critical Not-to-touch)

1. **`ConfirmResourceMetadata.projectId`** (lib/types.ts:805) — GCP Cloud Project ID
2. **`docs/swagger/confirm.yaml` L697 `GcpMetadata.projectId`** — 동상
3. **모든 ADR 문서** (`docs/adr/**`) — 역사 기록
4. **`docs/reports/**`의 과거 세션 기록** — 역사 기록
5. **`Project` 인터페이스** (lib/types.ts:236) — 도메인 객체. id/targetSourceId/projectCode 3개 식별자 공존 유지 (이번 이관의 관심사 아님)
6. **UI 텍스트 "과제" / "프로젝트"** — 이번 이관은 식별자 레벨만. 도메인 용어 유지
7. **컴포넌트 파일명 (`ProjectDetail.tsx`, `ProjectPageMeta.tsx` 등)** — 파일 이동(W3)은 하되 이름 변경은 하지 않음
