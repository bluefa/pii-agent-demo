# Spec F — Create-flow / Services / Users / Guides

> Domain F of the ADR-019 `/install/v1` contract migration (PLAN.md §3, rows 35–38, 48–51).
> Source of truth: `docs/swagger/install-v1.yaml`. ADR-019 D1/D2/D3/D6.
> Scope: 8 operations across 4 sub-domains. **Path + schema must match swagger VERBATIM.**

**Endpoints (verification-log rows 35–38, 48–51):**

| # | Method | Path (`/install/v1` prefix) | operationId | Req | Resp | vs current |
|---|--------|------|-------------|-----|------|------------|
| 35 | POST | `…/target-sources/services/{serviceCode}/creation-candidates` | getTargetSourceCreationCandidates | `TargetSourceCreationCandidateRequest` | `TargetSourceCreationCandidateResponse[]` | **RENAME** from `registration-preview` + reshape |
| 36 | POST | `…/target-sources/services/{serviceCode}/target-sources` | createTargetSource | `TargetSourceCreationCandidateResponse` | 201 `TargetSourceInfo` | path SAME; **req body = candidate response (round-trip)** |
| 37 | GET | `…/target-sources/services/{serviceCode}` | getTargetSourcesByServiceCode | — | `TargetSourceDetail[]` | SAME path (Azure-only) |
| 38 | GET | `/services/{serviceCode}/authorized-users` | getServiceAuthorizedUsers | — | `AuthorizedUsersResponse` | **NEW** (not under `target-sources/`) |
| 48 | GET | `/users/search` | searchUsers | — (q `q`, `excludeIds[]`) | `UserSearchResponse` | SAME |
| 49 | GET | `/user/services/page` | getUserServices | — (q `page`,`size`,`query`) | `PageServiceItem` | **RESHAPE** (Spring Page) |
| 50 | GET | `/user/me` | getUserMe | — | `UserMeResponse` (flat) | **UNWRAP** (`{user}` → flat) |
| 51 | GET / PUT | `/admin/guides/{name}` | getGuide / updateGuide | `GuideUpdateRequest` | `GuideDetail` | PUT resp reshape (snake→camel) |

**Casing rule recap (ADR-019):** responses are snake on the wire → `camelCaseKeys` at the proxy (`lib/object-case.ts`) → camel domain. Requests match swagger casing per-endpoint (D3). Mocks author the **wire (snake)** shape and route through the same `camelCaseKeys` boundary as `httpBff` (PLAN §2 mock-parity). None of these 8 needs a `getSnakeRaw`/`OpaqueKeys` opt-out (all plain JSON; no data-keyed maps). D6: no silent `as T` on migrated response paths.

**`/install/v1` note:** all paths in this spec are relative to the proxy base. `httpBff` helpers (`get`/`post`/`put`/`del`) prepend the target-source base; the `/services/*`, `/users/*`, `/user/*`, `/admin/*` paths are siblings of `/target-sources/*` under `/install/v1`. The swagger confirms endpoint 38 lives at `/install/v1/services/{serviceCode}/authorized-users` (NOT `/install/v1/target-sources/...`), and endpoints 35–37 live under `/install/v1/target-sources/services/{serviceCode}/…`.

---

## 0. Current code map (paths + symbols)

### Client (`lib/bff/http.ts`, `httpBff`)
- `targetSources.get` `:87` → `GET /target-sources/${id}`
- `targetSources.list` `:88` → `GET /target-sources/services/${serviceCode}` — **already swagger-correct (37)**
- `targetSources.create` `:89-95` → `POST /target-sources/services/${serviceCode}/target-sources` (strips `serviceCode`, posts `rest`) → `CreateTargetSourceResult`
- `targetSources.previewRegistration` `:96-100` → `POST /target-sources/services/${serviceCode}/target-sources/registration-preview` → `RegistrationPreviewResponse` — **RENAME target (35)**
- `users.search` `:123-129` → `GET /users/search?q&excludeIds` — swagger-correct (48)
- `users.me` `:130` → `GET /user/me` — path correct, **shape wrong (50)**
- `users.getServices` `:131` → `GET /user/services` — **not in swagger** (legacy; see §discrepancies)
- `users.getServicesPage` `:132-138` → `GET /user/services/page?page&size&query` — swagger-correct path (49)
- `services.permissions.list` `:143` → `GET /services/${serviceCode}/authorized-users` — swagger-correct (38)
- `services.permissions.add` `:144` → `POST /services/${serviceCode}/authorized-users` — **NOT in swagger**
- `services.permissions.remove` `:145` → `DELETE /services/${serviceCode}/authorized-users/${userId}` — **NOT in swagger**
- `services.settings.aws.*` `:148-152` → `/services/${serviceCode}/settings/aws[...]` — **NOT in swagger** (3 ops)
- `guides.get` `:288` → `GET /admin/guides/${name}` — swagger-correct (51)
- `guides.put` `:289` → `PUT /admin/guides/${name}` — path correct, **PUT resp shape reshape (51)**

### Wire/domain types (`lib/bff/types/*`)
- `target-sources.ts`: `RegistrationPreviewRequest` `:86-97` (camel), `RegistrationPreviewItemCommon/Add/Duplicate` `:99-123` (snake), `RegistrationPreviewResponse = {items: […]}` `:125-127`, `CreateTargetSourceBody` `:40-53` (camel), `CreateTargetSourceResult` `:55-71` (snake), `ServicesTargetSourcesItem` `:17-29` (camel) + `ServicesTargetSourcesResponse` `:31-33`.
- `services.ts`: `ServiceAuthorizedUsersResponse = {users: User[]}` `:11-14`; AWS-settings types `:31-63` (out-of-contract).
- `users.ts`: `UserSearchResponse = {users: Pick<User,'id'|'name'|'email'>[]}` `:14-17`; `UserMeResponse = {user: CurrentUser}` `:19-22` (**wrapped — wrong**); `UserServicesPageResponse = {content, page}` `:29-39` (**not Spring Page**).
- `guides.ts`: `GuideGetResponse = GuideDetail` `:13-14`; `GuidePutResult = {name, contents:{ko,en}, updated_at}` `:16-21` (**snake — wrong; must be `GuideDetail`**). Domain `GuideDetail` from `@/lib/types/guide`.

### CSR wrappers (`app/lib/api/index.ts`)
- `CurrentUser` `:39-43` (flat `{id,name,email}`), `getCurrentUser` `:45-46` → `fetchInfraCamelJson<CurrentUser>('/user/me')` — **expects flat already (mismatch with BFF `{user}`)**.
- `getServices` `:48-56` → `/user/services` (legacy).
- `getServicesPage` `:63-82` + `ServicePageResponse` `:58-61` → `/user/services/page` (maps `serviceCode/serviceName`→`{code,name}`).
- `getProjects` `:131-138` → `fetchInfraCamelJson('/services/${serviceCode}/target-sources')` — **WRONG PATH** (swagger 37 = `/target-sources/services/{serviceCode}`); `toProjectSummary` `:104-129`.
- `searchUsers` `:256-269` + `UserSearchResult` `:250-254` → `/users/search`.

### Route handlers (Next proxy)
- `app/integration/api/v1/services/[serviceCode]/target-sources/registration-preview/route.ts` — **must rename dir → `creation-candidates`**.
- `app/integration/api/v1/services/[serviceCode]/authorized-users/route.ts` (+ `[userId]/route.ts`) — list/add/remove; **add/remove out-of-contract**.

### UI consumers
- `app/components/features/ProjectCreateModal.tsx` — creation flow (preview → create).
- `app/components/features/admin/v7/RegistrationPreviewCardList.tsx` (+ `index.ts`) — renders preview items.
- `app/integration/admin/guides/components/GuideEditorPanel.tsx`, `app/hooks/useGuide.ts` — guide editor.
- `app/components/features/process-status/GuideCard/GuideCardContainer.tsx` — guide consumer.

### Mocks (`lib/bff/mock/*`)
- `mock/target-sources.ts`: `list` `:347-373` returns `getProjectsByServiceCode().map(toBffTargetSourceDetail)`; `toBffTargetSourceDetail` `:102-111` is **snake** (`target_source_id`, `process_status`, `cloud_provider`, `created_at`, `metadata`). `create` `:382+` returns `toBffTargetSourceInfo` `:116-129` (**camel**). `previewRegistration` `:488-541` returns `{items: [...]}` with `buildPreviewCommon` `:317-344` snake items + `type: 'ADD'|'DUPLICATE'`.
- `mock/services.ts`: `permissions.list` `:10-30` returns `{users: [{id,name,email}]}`; `add`/`remove`/`settings.aws.*` (out-of-contract).
- `mock/users.ts`: `search` `:5-30` `{users:[{id,name,email}]}`; `getMe` `:32-43` `{user}` (**wrapped**); `getServicesPage` `:64-104` `{content:[{serviceCode,serviceName}], page:{…}}` (**not Spring Page**).
- `mock/guides.ts`: `get` `:105-126` / `put` `:128-167` return `GuideDetail` (camel `updatedAt`) — already wire-correct; `guides-seed.ts` 22 entries camel `updatedAt`.
- Foundation: `lib/object-case.ts` `camelCaseKeys` `:39`, `snakeCaseKeys` `:36`. `getSnakeRaw`/`OpaqueKeys`/`SnakeRaw` **do not exist yet** (introduced in P1 foundation).

---

## 1. Endpoint 35 — getTargetSourceCreationCandidates (RENAME + RESHAPE)

**Swagger** (`install-v1.yaml:1392-1468`):
- `POST /install/v1/target-sources/services/{serviceCode}/creation-candidates`
- Path param `serviceCode: string` (required).
- Request body `TargetSourceCreationCandidateRequest` (required).
- 200 → **array** of `TargetSourceCreationCandidateResponse`.

### Request wire — `TargetSourceCreationCandidateRequest` (`:4993-5026`)
snake_case. required: `cloud_type`, `database_types`, `is_china_region`, `metadata`.
```
cloud_type: string  enum [aws, azure, gcp, idc, others]  pattern (?i)^(aws|azure|gcp|idc|others)$   // LOWERCASE
is_china_region: boolean
database_types: string[]                                  // e.g. ["mysql","others"]
grant_service_terraform_execution_permission?: boolean
metadata: TargetSourceCreationCandidateMetadata
```
`TargetSourceCreationCandidateMetadata` (`:4888-4906`, all optional):
```
aws_account_id?: string  (pattern ^[0-9]{12}$)
tenant_id?: string
subscription_id?: string
project_id?: string          // GCP project id  (note: NOT gcp_project_id here)
description?: string
```

### Response wire — `TargetSourceCreationCandidateResponse` (`:4907-4947`)
snake_case. required: `cloud_type`, `is_china_region`, `is_sdu_type`, `metadata`, `status`.
```
status: string  enum [ADD, DUPLICATE]
cloud_type: string  enum [AWS, GCP, AZURE, IDC, UNKNOWN]   // UPPERCASE in response
is_sdu_type: boolean
is_china_region: boolean
metadata: TargetSourceCreationCandidateMetadata
existing_target_source_id?: integer(int64) nullable
grant_service_terraform_execution_permission?: boolean nullable
```

### Target types
- Request (camel, D3 — wire is snake so the typed wire body is snake; build a camel domain input then map to snake at the call, OR type the request body verbatim-snake since swagger request is snake). **Recommendation:** type request body **snake verbatim** (matches swagger), since the request casing is snake here — no `snakeCaseKeys`, no camel intermediate. Replace `RegistrationPreviewRequest`.
```ts
// lib/bff/types/target-sources.ts
export interface TargetSourceCreationCandidateMetadata {
  aws_account_id?: string; tenant_id?: string; subscription_id?: string;
  project_id?: string; description?: string;
}
export interface TargetSourceCreationCandidateRequest {
  cloud_type: 'aws' | 'azure' | 'gcp' | 'idc' | 'others';
  is_china_region: boolean;
  database_types: string[];
  grant_service_terraform_execution_permission?: boolean;
  metadata: TargetSourceCreationCandidateMetadata;
}
```
- Response domain (camel, post-`camelCaseKeys`):
```ts
export interface TargetSourceCreationCandidate {
  status: 'ADD' | 'DUPLICATE';
  cloudType: 'AWS' | 'GCP' | 'AZURE' | 'IDC' | 'UNKNOWN';
  isSduType: boolean;
  isChinaRegion: boolean;
  metadata: { awsAccountId?: string; tenantId?: string; subscriptionId?: string; projectId?: string; description?: string };
  existingTargetSourceId?: number | null;
  grantServiceTerraformExecutionPermission?: boolean | null;
}
export type TargetSourceCreationCandidatesResponse = TargetSourceCreationCandidate[];
```
**Delete:** `RegistrationPreviewRequest`, `RegistrationPreviewItemCommon/Add/Duplicate`, `RegistrationPreviewItem`, `RegistrationPreviewResponse` (replaced).

### Client change (`lib/bff/http.ts:96-100`)
```ts
getCreationCandidates: (serviceCode, body) =>
  post<TargetSourceCreationCandidate[]>(
    `/target-sources/services/${serviceCode}/creation-candidates`, body),
```
Rename method `previewRegistration` → `getCreationCandidates`; drop the trailing `/target-sources/registration-preview` segment → `/creation-candidates`. Update `BffClient` interface signature.

### Response→Adapter→UI
- **Wire→domain:** proxy runs `camelCaseKeys` on the array → `TargetSourceCreationCandidate[]`. (Old shape was `{items:[{type, …}]}`; new is a bare array and field `type`→`status`, with new `is_sdu_type` already present in old.)
- **Adapter:** `RegistrationPreviewCardList.tsx` reads `items[].type` ('ADD'/'DUPLICATE') + `existing_target_source_id`. Remap to `status` + `existingTargetSourceId` and iterate the bare array (no `.items`). Index-match to request `database_types[i]` is preserved (server returns one candidate per db type, in order).
- **UI:** card list renders ADD vs DUPLICATE badge; DUPLICATE shows `existingTargetSourceId`. Carry `grantServiceTerraformExecutionPermission` and `isSduType` for the create round-trip (§2).

### Mock (`mock/target-sources.ts`)
- Rename `previewRegistration` → `getCreationCandidates`. Validate body in **snake** (`cloud_type`, `database_types`, `metadata.*`) instead of camel (`cloudProvider`, `dbTypes`).
- Emit a **bare array** of `TargetSourceCreationCandidateResponse` (snake), each:
  ```jsonc
  { "status": "ADD"|"DUPLICATE", "cloud_type": "AWS", "is_sdu_type": false,
    "is_china_region": <bool>, "metadata": { "aws_account_id": "...", ... },
    "existing_target_source_id": <id|null>,           // present when DUPLICATE
    "grant_service_terraform_execution_permission": <bool|null> }
  ```
- One element per `database_types[i]`; `status: DUPLICATE` + `existing_target_source_id` when a matching project exists (port `buildPreviewCommon` matching logic from `:516-538`). Route through `camelCaseKeys` (P1).

---

## 2. Endpoint 36 — createTargetSource (round-trip)

**Swagger** (`install-v1.yaml:1319-1391`):
- `POST /install/v1/target-sources/services/{serviceCode}/target-sources`
- Path param `serviceCode: string` (required).
- Request body `TargetSourceCreationCandidateResponse` (required) — **the candidate response is posted back verbatim.**
- **201 Created** → `TargetSourceInfo`.

### Request wire = `TargetSourceCreationCandidateResponse` (snake, §1 response shape)
The exact object returned by endpoint 35 (one selected candidate) is sent back. The body is **snake** (`status`, `cloud_type`, `is_sdu_type`, `is_china_region`, `metadata`, `existing_target_source_id?`, `grant_service_terraform_execution_permission?`). Required fields per schema: `cloud_type`, `is_china_region`, `is_sdu_type`, `metadata`, `status`.

### Response wire — `TargetSourceInfo` (`:4948-4975`) — **camelCase already**
```
targetSourceId?: integer(int64)
description?: string
cloudProvider?: string  enum [AWS, GCP, AZURE, IDC, UNKNOWN]
createdAt?: string(date-time)
serviceCode?: string
serviceName?: string
updatedAt?: string(date-time)
metadata?: TargetSourceMetadata
```
`TargetSourceMetadata` (`:4976-4992`, snake, all optional): `tenant_id`, `subscription_id`, `gcp_project_id`, `aws_account_id`, `is_sdu_type`, `is_china_region`, `grant_service_terraform_execution_permission`.

> ⚠ `TargetSourceInfo` top-level is camel but its nested `metadata` is snake. After `camelCaseKeys` the whole thing becomes camel (`metadata.gcpProjectId`, `metadata.isSduType`, …) — uniform domain shape. Mock must author the **wire** exactly: camel top-level + snake `metadata`.

### Target types
```ts
export interface TargetSourceMetadata {           // wire (snake) — for mock authoring
  tenant_id?: string; subscription_id?: string; gcp_project_id?: string;
  aws_account_id?: string; is_sdu_type?: boolean; is_china_region?: boolean;
  grant_service_terraform_execution_permission?: boolean;
}
export interface TargetSourceInfo {               // domain (post-camelCaseKeys)
  targetSourceId?: number; description?: string;
  cloudProvider?: 'AWS' | 'GCP' | 'AZURE' | 'IDC' | 'UNKNOWN';
  createdAt?: string; serviceCode?: string; serviceName?: string; updatedAt?: string;
  metadata?: { tenantId?: string; subscriptionId?: string; gcpProjectId?: string;
    awsAccountId?: string; isSduType?: boolean; isChinaRegion?: boolean;
    grantServiceTerraformExecutionPermission?: boolean };
}
```
**Delete/replace:** `CreateTargetSourceBody` (camel, with `dbType`) and `CreateTargetSourceResult` (snake) — the request is now the candidate response and the result is `TargetSourceInfo`.

### Client change (`lib/bff/http.ts:89-95`)
```ts
create: (serviceCode, candidate) =>
  post<TargetSourceInfo>(`/target-sources/services/${serviceCode}/target-sources`, candidate),
```
Path is unchanged. Body type changes from `CreateTargetSourceBody` → `TargetSourceCreationCandidate` (the selected candidate, re-serialized to snake wire). Remove the `serviceCode`-extraction branch and the `POST /target-sources` fallback (out of contract). Update `BffClient` signature.

### Response→Adapter→UI (round-trip)
- **Round-trip:** `ProjectCreateModal.tsx` fetches candidates (35), user selects the ADD candidate(s); the selected candidate object is posted back **as-is** to (36). The client must re-serialize the camel domain candidate to the **snake** wire body (inverse of §1's `camelCaseKeys`), OR keep the raw snake candidate from (35) and post it unchanged. **Recommendation:** keep the raw wire candidate from (35) for the round-trip body to avoid a lossy camel↔snake bounce, since the contract is "post the response back verbatim".
- **201:** treat 201 as success (not only 200) in the create caller.
- **Adapter:** map `TargetSourceInfo` → existing `ProjectSummary`/navigation (use `targetSourceId`, `cloudProvider`, `serviceCode`).

### Mock (`mock/target-sources.ts:382+`)
- `create` now accepts a **candidate body** (snake) instead of `CreateTargetSourceBody`. Read `cloud_type`/`metadata.*` from the candidate.
- Return **201** with `toBffTargetSourceInfo` shaped to swagger `TargetSourceInfo`: camel top-level (`targetSourceId`, `cloudProvider`, `serviceCode`, `serviceName`, `createdAt`, `updatedAt`, `description`) + **snake `metadata`** (`aws_account_id`, `gcp_project_id`, `is_sdu_type`, …). Drop extra fields (`id`, `projectCode`, `processStatus`, `isRejected`, …) not in `TargetSourceInfo`. Route through `camelCaseKeys` (P1).

---

## 3. Endpoint 37 — getTargetSourcesByServiceCode

**Swagger** (`install-v1.yaml:3542-3612`):
- `GET /install/v1/target-sources/services/{serviceCode}` (Azure type only).
- Path param `serviceCode: string` (required).
- 200 → **array** of `TargetSourceDetail`.

### Response wire — `TargetSourceDetail` (`:5140-5174`) — snake
```
description?: string
target_source_id?: integer(int64)
service_code?: string
service_name?: string
process_status?: string  enum [IDLE, PENDING, CONFIRMING, CONFIRMED, INSTALLED, CONNECTED, COMPLETED]
cloud_provider?: string  enum [AWS, GCP, AZURE, IDC, UNKNOWN]
created_at?: string(date-time)
metadata?: TargetSourceMetadata   // snake (see §2)
```

### Target type (domain, post-`camelCaseKeys`)
```ts
export interface TargetSourceDetail {
  description?: string; targetSourceId?: number; serviceCode?: string; serviceName?: string;
  processStatus?: 'IDLE'|'PENDING'|'CONFIRMING'|'CONFIRMED'|'INSTALLED'|'CONNECTED'|'COMPLETED';
  cloudProvider?: 'AWS'|'GCP'|'AZURE'|'IDC'|'UNKNOWN';
  createdAt?: string; metadata?: { /* camel TargetSourceMetadata */ };
}
export type TargetSourcesByServiceResponse = TargetSourceDetail[];
```
Replaces `ServicesTargetSourcesItem` (`:17-29`) / `ServicesTargetSourcesResponse` (`:31-33`). **Note** the swagger 200 is a **bare array** — the union `| { targetSources: [...] }` is removed (the wrapped variant is not in the contract).

### Response→Adapter→UI
- Client `httpBff.targetSources.list` `:88` path is already correct — no path change; only the result type changes to `TargetSourceDetail[]`.
- ⚠ **Discrepancy:** `app/lib/api/index.ts:getProjects` (`:131-138`) fetches `/services/${serviceCode}/target-sources` (**wrong path**) and tolerates both array and `{targetSources}` wrapper. Align it to the swagger path `/target-sources/services/{serviceCode}` and to a **bare array** only; keep `toProjectSummary` mapping but source the snake fields (`target_source_id`, `process_status`, `cloud_provider`) — note `processStatus` here is a **string enum**, whereas `toProjectSummary` currently normalizes a numeric/step status. Verify `normalizeTargetSourceProcessStatus` accepts the 7-value string enum.
- `process_status` is a **string enum** (not the numeric step used in the projects mock `getCurrentStep`). The UI adapter must map the enum → step where it expects a number.

### Mock (`mock/target-sources.ts:347-373`)
- `list` already returns a bare array of `toBffTargetSourceDetail` (snake) — **wire-correct**. Verify `process_status` is emitted as the **string enum** (`toBffApprovalProcessStatus`) matching the 7 values, not a number. Route through `camelCaseKeys` (P1). Keep 401/404/403 guards.

---

## 4. Endpoint 38 — getServiceAuthorizedUsers (NEW)

**Swagger** (`install-v1.yaml:3613-3680`):
- `GET /install/v1/services/{serviceCode}/authorized-users` (NOT under `target-sources/`).
- Path param `serviceCode: string` (required).
- 200 → `AuthorizedUsersResponse`.

### Response wire — `AuthorizedUsersResponse` (`:5747-5753`)
```
users?: UserInfo[]
```
`UserInfo` (`:5027-5035`): `id?: string`, `name?: string`, `email?: string` — case-neutral keys (no snake/camel divergence).

### Target type
```ts
export interface AuthorizedUser { id?: string; name?: string; email?: string }
export interface AuthorizedUsersResponse { users?: AuthorizedUser[] }
```
Replaces `ServiceAuthorizedUsersResponse` (`services.ts:11-14`, currently `{users: User[]}`). Narrow `User[]` → `{id,name,email}[]` to match `UserInfo`.

### Response→Adapter→UI
- Client `httpBff.services.permissions.list` `:143` path already correct — keep. `camelCaseKeys` is a no-op on `{id,name,email}` (already flat). The authorized-users picker/admin permissions view consumes `users[]`.

### Mock (`mock/services.ts:10-30`)
- `permissions.list` already returns `{users:[{id,name,email}]}` — **wire-correct**. Keep ADMIN 403 guard. Route through `camelCaseKeys` (P1, no-op).

> ⚠ **Out-of-contract siblings (FLAG — PLAN §0 deprecate divergent paths):** `services.permissions.add` (`http.ts:144`, `POST …/authorized-users`) and `services.permissions.remove` (`http.ts:145`, `DELETE …/authorized-users/{userId}`) **are NOT in the swagger** — only the GET list exists. Likewise `services.settings.aws.{get,update,verifyScanRole}` (`http.ts:148-152`) and their types (`services.ts:31-63`), mocks (`mock/services.ts:156-230`), and route handlers (`authorized-users/[userId]/route.ts`, settings routes). **Decision needed** (mirror PLAN §4.4 for `system-reset`): keep as out-of-contract admin helpers, or drop. Do **not** silently migrate them as if contract-backed. Recorded in §7.

---

## 5. Endpoint 48 — searchUsers

**Swagger** (`install-v1.yaml:1469-1541`):
- `GET /install/v1/users/search`
- Query: `q?: string`, `excludeIds?: string[]` (both optional).
- 200 → `UserSearchResponse`.

### Response wire — `UserSearchResponse` (`:5036-5042`)
```
users?: UserInfo[]      // UserInfo = {id?, name?, email?}
```

### Target type
```ts
export interface UserSearchResponse { users?: { id?: string; name?: string; email?: string }[] }
```
Adjust `users.ts:14-17` (`Pick<User,…>` → `UserInfo` shape). CSR `searchUsers` (`api/index.ts:256-269`) + `UserSearchResult` (`:250-254`) already match `{id,name,email}` — keep.

### Response→Adapter→UI
- Client `httpBff.users.search` `:123-129` path/params already correct (`q`, `excludeIds[]`). `camelCaseKeys` no-op. User-search picker consumes `users[]`.

### Mock (`mock/users.ts:5-30`)
- `search` already returns `{users:[{id,name,email}]}` — **wire-correct**. Keep ADMIN filter + `excludeIds` + `q` behavior. Route through `camelCaseKeys` (P1, no-op).

---

## 6. Endpoint 49 — getUserServices (RESHAPE to Spring Page)

**Swagger** (`install-v1.yaml:1542-1623`):
- `GET /install/v1/user/services/page`
- Query: `page?: int32 = 0`, `size?: int32 = 10`, `query?: string`.
- 200 → `PageServiceItem`.

### Response wire — `PageServiceItem` (`:5043-5076`) — Spring Page envelope
```
totalPages?: int32
totalElements?: int64
pageable?: PageableObject
first?: boolean
last?: boolean
size?: int32
content?: ServiceItem[]
number?: int32
sort?: SortObject[]
numberOfElements?: int32
empty?: boolean
```
`ServiceItem` (`:5097-5103`): `service_code?: string`, `service_name?: string` — **snake**.
`PageableObject` (`:5077-5096`): `paged?`, `pageNumber?:int32`, `pageSize?:int32`, `unpaged?`, `offset?:int64`, `sort?: SortObject[]`.
`SortObject` (`:5104-5116`): `direction?`, `nullHandling?`, `ascending?`, `property?`, `ignoreCase?`.

### Target types (domain, post-`camelCaseKeys`)
After `camelCaseKeys`: `content[].serviceCode/serviceName`, `pageable.pageNumber`, etc.
```ts
export interface ServiceItem { serviceCode?: string; serviceName?: string }
export interface SortObject { direction?: string; nullHandling?: string; ascending?: boolean; property?: string; ignoreCase?: boolean }
export interface PageableObject { paged?: boolean; pageNumber?: number; pageSize?: number; unpaged?: boolean; offset?: number; sort?: SortObject[] }
export interface PageServiceItem {
  totalPages?: number; totalElements?: number; pageable?: PageableObject;
  first?: boolean; last?: boolean; size?: number; content?: ServiceItem[];
  number?: number; sort?: SortObject[]; numberOfElements?: number; empty?: boolean;
}
```
Replaces `UserServicesPageResponse` (`users.ts:29-39`, currently `{content, page:{…}}`). **Key change:** the page metadata is **flat on the envelope** (`totalPages`, `totalElements`, `number`, `size`) + `pageable`/`sort` objects — **not** nested under a `page` key. And `content[]` is **snake on the wire** (`service_code`/`service_name`).

### Response→Adapter→UI
- Client `httpBff.users.getServicesPage` `:132-138` path/params correct — only result type changes.
- CSR `getServicesPage` (`api/index.ts:63-82`) + `ServicePageResponse` (`:58-61`) must read from the **flat envelope** (`data.totalElements`, `data.totalPages`, `data.number`, `data.size`) instead of `data.page.*`, and map `content[].serviceCode/serviceName` → `{code,name}`. Update `ServicePageResponse.page` construction to source the flat fields.

### Mock (`mock/users.ts:64-104`)
- `getServicesPage` must emit the **Spring Page wire** (snake `content`, flat envelope):
  ```jsonc
  { "content": [ { "service_code": "...", "service_name": "..." } ],
    "totalElements": N, "totalPages": M, "number": page, "size": size,
    "first": page===0, "last": page>=M-1, "numberOfElements": content.length,
    "empty": content.length===0,
    "pageable": { "paged": true, "pageNumber": page, "pageSize": size, "unpaged": false, "offset": page*size, "sort": [] },
    "sort": [] }
  ```
  (Replace the current `{content:[{serviceCode,serviceName}], page:{…}}`.) Route through `camelCaseKeys` (P1) → domain camel. Keep 401 guard + ADMIN/permission filter + `query` filter.

> Note: `httpBff.users.getServices` (`:131`, `GET /user/services`) and CSR `getServices` (`api/index.ts:48-56`), mock `getServices` (`mock/users.ts:45-62`) hit `/user/services` (non-paged) which is **NOT in the swagger**. Out-of-contract — flag in §7 (keep or drop alongside the paged variant decision).

---

## 7-A. Endpoint 50 — getUserMe (UNWRAP)

**Swagger** (`install-v1.yaml:1624-1684`):
- `GET /install/v1/user/me`
- 200 → `UserMeResponse`.

### Response wire — `UserMeResponse` (`:5117-5125`) — **FLAT**
```
id?: string
name?: string
email?: string
```
No `{user}` wrapper. Case-neutral keys.

### Target type
```ts
export interface UserMeResponse { id?: string; name?: string; email?: string }
```
Replaces `users.ts:19-22` (`{user: CurrentUser}` — **wrong wrapper**).

### Response→Adapter→UI
- ⚠ **Discrepancy:** CSR `getCurrentUser` (`api/index.ts:45-46`) already expects **flat** `CurrentUser` (`{id,name,email}`), but the BFF type + mock wrap it under `{user}`. The swagger says **flat** → CSR is right, BFF/mock are wrong. Migrate the BFF `UserMeResponse` type and the mock to **flat**; the CSR path needs no change.
- `camelCaseKeys` no-op (flat `{id,name,email}`).

### Mock (`mock/users.ts:32-43`)
- `getMe` must return the **flat** user object (`{id,name,email}` from `getCurrentUser()`), **not** `{user}`. Keep 401 guard. Route through `camelCaseKeys` (P1, no-op).

---

## 7-B. Endpoint 51 — getGuide / updateGuide

**Swagger** (`install-v1.yaml:516-654`):
- `GET /install/v1/admin/guides/{name}` → 200 `GuideDetail`.
- `PUT /install/v1/admin/guides/{name}` → body `GuideUpdateRequest` (required) → 200 `GuideDetail`.
- Path param `name: string` (required).

### Request wire — `GuideUpdateRequest` (`:4401-4407`)
```
contents: GuideContentRequest   (required)
```
`GuideContentRequest` (`:4391-4400`, required `ko`,`en`): `ko: object`, `en: object`.
> ⚠ Swagger types `ko`/`en` as `type: object` (free-form), but the domain + mock treat them as **HTML strings** (`{ko: string, en: string}`). The current mock `isUpdateBody` (`mock/guides.ts:59-65`) requires both to be **strings**. Keep the **string** request body (domain truth); the swagger `object` is a generator artifact. Flag in §7.

### Response wire — `GuideDetail` (`:4415-4424`) — **camelCase**
```
name?: string
contents?: GuideContents       // {ko?: string, en?: string}
updatedAt?: string(date-time)
```
`GuideContents` (`:4408-4414`): `ko?: string`, `en?: string`.

### Target types
- GET response `GuideGetResponse = GuideDetail` (`guides.ts:13-14`) — already correct (domain `GuideDetail` from `@/lib/types/guide`, camel `updatedAt`).
- PUT response: **change `GuidePutResult` → `GuideDetail`** (`guides.ts:16-21` currently `{name, contents, updated_at}` snake — **wrong**; swagger PUT returns camel `GuideDetail`).
- Request body type `{ contents: { ko: string; en: string } }` (domain string shape).

### Response→Adapter→UI
- Client `httpBff.guides.get`/`put` `:288-289` paths correct — only PUT result type changes (`GuidePutResult` → `GuideDetail`). With ADR-019 D1/D2, PUT response is `camelCaseKeys`-d → `updatedAt` (camel), consistent with GET. Remove the old "PUT = snake raw passthrough" assumption (the type comment at `guides.ts:16` and `target-sources.ts:6`/`services.ts:6`/`users.ts:6` is the pre-ADR-019 rule).
- `GuideEditorPanel.tsx` / `useGuide.ts` consume `GuideDetail` (camel `updatedAt`) on both GET and PUT — no UI field rename needed once PUT result is `GuideDetail`.

### Mock (`mock/guides.ts:105-167`, `guides-seed.ts`)
- `get` / `put` already return `GuideDetail` (camel `updatedAt`) — **wire-correct** for both. `guides-seed.ts` 22 entries already camel. No casing change; verify both flow through `camelCaseKeys` (P1, no-op on already-camel). Keep ProblemDetails error paths (GUIDE_NOT_FOUND, GUIDE_CONTENT_INVALID, VALIDATION_FAILED).

---

## 8. Discrepancies (resolve in verification log)

1. **RENAME (35):** `…/target-sources/services/{serviceCode}/target-sources/registration-preview` → `…/target-sources/services/{serviceCode}/creation-candidates`. Drop the extra `/target-sources/` segment. Response reshape `{items:[{type,…}]}` → bare `TargetSourceCreationCandidateResponse[]` (`type`→`status`). Rename Next route dir `registration-preview/` → `creation-candidates/`.
2. **Create round-trip (36):** request body = `TargetSourceCreationCandidateResponse` (the candidate from 35 posted back verbatim, snake wire). Response is `TargetSourceInfo` at **201**. Recommend posting the raw wire candidate (no camel↔snake bounce). Old `CreateTargetSourceBody`/`CreateTargetSourceResult` deleted.
3. **NEW authorized-users (38):** `GET /install/v1/services/{serviceCode}/authorized-users` is now contract-backed (list only). Path is **not** under `target-sources/`. `httpBff.services.permissions.list` already matches.
4. **Out-of-contract paths (FLAG):** `services.permissions.add` (POST) + `.remove` (DELETE) and all `services.settings.aws.*` (GET/PUT/verify-scan-role) are absent from swagger. Also `users.getServices`/`GET /user/services` (non-paged). Decision: keep as admin helpers or drop (mirror PLAN §4.4). Do not migrate as contract-backed.
5. **`/user/me` unwrap (50):** swagger is **flat** `{id,name,email}`; BFF type + mock wrap under `{user}`. CSR `getCurrentUser` already expects flat → fix BFF/mock to flat.
6. **Page reshape (49):** `PageServiceItem` is a Spring Page (flat envelope `totalElements/totalPages/number/size` + `pageable`/`sort`; `content[]` snake `service_code/service_name`). Current `UserServicesPageResponse`/mock use `{content, page:{…}}` and camel content — reshape both. CSR `getServicesPage` reads `data.page.*` → must read flat envelope.
7. **`getProjects` wrong path (37):** `api/index.ts:getProjects` calls `/services/{serviceCode}/target-sources` (not the swagger `…/target-sources/services/{serviceCode}`) and tolerates a `{targetSources}` wrapper not in contract. Align path + accept bare array only. `process_status` is a **string enum**, not a numeric step — verify the normalizer.
8. **Guide PUT result casing (51):** swagger PUT returns camel `GuideDetail` (not snake `{updated_at}`). Change `GuidePutResult` → `GuideDetail`. Under ADR-019 D1/D2 all JSON responses (incl. PUT) are `camelCaseKeys`-d — retire the per-type "PUT = snake raw passthrough" comment.
9. **Guide request `ko`/`en` typing (51):** swagger `GuideContentRequest` types `ko`/`en` as `object`; domain + mock treat them as HTML **strings**. Keep the string shape (domain truth, mock validates strings); treat swagger `object` as a generator artifact.
10. **Candidate metadata `project_id` vs `gcp_project_id`:** request/candidate `TargetSourceCreationCandidateMetadata.project_id` (GCP) vs `TargetSourceInfo.metadata.gcp_project_id` / `TargetSourceMetadata.gcp_project_id`. Two different field names for GCP project id across schemas — preserve each verbatim; do not unify.
11. **`cloud_type` casing across request vs response:** request enum is **lowercase** (`aws|azure|gcp|idc|others`), response enum is **UPPERCASE** (`AWS|GCP|AZURE|IDC|UNKNOWN`). Preserve both; the round-trip body (36) carries the **response (uppercase)** `cloud_type`.

---

## 9. Verification (self-review, 3 passes — path + schema exactness)

**Review 1: clean — checked** all 8 paths char-by-char vs swagger line refs: 35 `:1392` (`/target-sources/services/{serviceCode}/creation-candidates`), 36 `:1319` (`…/target-sources`), 37 `:3542` (`/target-sources/services/{serviceCode}`), 38 `:3613` (`/services/{serviceCode}/authorized-users` — confirmed NOT under target-sources), 48 `:1469` (`/users/search`), 49 `:1542` (`/user/services/page`), 50 `:1624` (`/user/me`), 51 `:516` (`/admin/guides/{name}` GET+PUT). Methods + path params (`serviceCode` string, `name` string, `targetSourceId` n/a here) verified.

**Review 2: clean — checked** request schemas: 35 `TargetSourceCreationCandidateRequest` required `[cloud_type, database_types, is_china_region, metadata]`, `cloud_type` lowercase enum + pattern, `metadata.project_id` (not gcp_); 36 body = `TargetSourceCreationCandidateResponse` required `[cloud_type, is_china_region, is_sdu_type, metadata, status]`; 51 PUT `GuideUpdateRequest.contents` required, `GuideContentRequest` required `[ko,en]` (object vs string flagged). Response schemas: 35 **array** of candidate (`status` enum ADD/DUPLICATE, `cloud_type` UPPERCASE, `is_sdu_type` required, `existing_target_source_id` nullable int64); 36 `TargetSourceInfo` (camel top + snake `metadata`) at **201**; 37 **array** of `TargetSourceDetail` (`process_status` 7-enum, snake `metadata`); 38 `AuthorizedUsersResponse {users: UserInfo[]}`; 48 `UserSearchResponse {users: UserInfo[]}`; 49 `PageServiceItem` Spring Page (flat envelope, snake `ServiceItem`); 50 `UserMeResponse` **flat**; 51 `GuideDetail` camel `updatedAt`. Enum spellings verified (`ADD/DUPLICATE`, `IDLE…COMPLETED`, `AWS/GCP/AZURE/IDC/UNKNOWN`).

**Review 3: clean — checked** Response→Adapter→UI + mock-wire + D6: every domain type is the post-`camelCaseKeys` shape; mocks author wire-snake where the wire is snake (35/36/37/49) and case-neutral/camel where already so (38/48/50/51), all routed through `camelCaseKeys` (P1); no `getSnakeRaw`/`OpaqueKeys` needed (no raw-passthrough, no data-keyed maps in this domain); no silent `as T` on migrated response paths. All 11 discrepancies recorded with explicit resolutions. `TargetSourceInfo` camel-top/snake-metadata split and the create round-trip (raw candidate reposted) double-checked against `:1335` (req `$ref TargetSourceCreationCandidateResponse`) and `:1386` (201 `$ref TargetSourceInfo`).

**Verification-log rows to update (`contract-verification.md` 35–38, 48–51):** mark each with this spec as the contract reference; advance to 3/3 only after codex+opus per-endpoint review per PLAN §7.
