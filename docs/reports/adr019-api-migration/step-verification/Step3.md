# Step 3 (연동 대상 반영중) — API Verification

Step 3 is read-only and shared across AWS / GCP / Azure / IDC. Per the intended-API
spec (`01-target-source-detail-spec.md` §5), the screen makes exactly one call on
load: `GET …/approved-integration`. No user actions; advance to Step 4 is driven by
`ProcessStatusCard` polling, not by a Step-3 API.

Contract: `docs/swagger/install-v1.yaml`
Intended source: `pii-agent-migration-notes/01-target-source-detail-spec.md` §5

## Verification matrix

| Intended API | In swagger? (path + method + schema) | Currently called? (file:line) | Verdict |
|---|---|---|---|
| `GET …/approved-integration` (getApprovedIntegration) — 승인받은 DB 목록 조회 | YES. `install-v1.yaml:3314` path `/install/v1/target-sources/{targetSourceId}/approved-integration`, `get`, `operationId: getApprovedIntegration` (`:3320`); 200 → `ApprovedIntegrationResponseDto` (`:3383`, schema at `:5684`) | YES. Client `app/lib/api/index.ts:447` → fetch `…/approved-integration` (`:453`). Upstream BFF client `lib/bff/http.ts:254`. Route handler `app/integration/api/v1/.../approved-integration/route.ts:28`. UI: `ApplyingApprovedCard.tsx:75` (Step 3 card) — also `WaitingApprovalCard.tsx:86` (Step 2) | PATH/METHOD MATCH; **200 schema mismatch** (see below) |

## Schema mismatch — `ApprovedIntegrationResponseDto` (200)

The path/method/operationId match exactly. The **response body shape does not**.

### Swagger (`install-v1.yaml:5684`)
```
ApprovedIntegrationResponseDto:
  id: int64
  request_id: int64
  approved_at: date-time
  approved_by: ActorDto
  resources: TargetSourceResourceItemDto[]   # SINGLE array
```
`TargetSourceResourceItemDto` (`:4636`) carries per-item:
`selected` (bool), `metadata` (TargetSourceResourceMetadataDto), `resource_id`,
`resource_name`, `resource_type`, `integration_category` (TARGET / NO_INSTALL_NEEDED /
INSTALL_INELIGIBLE), `recommend_fail_reason`, `exclusion_reason`. There is **no
top-level `excluded_*`** anywhere — exclusion is expressed per-resource via
`selected === false` + `exclusion_reason`.

### Normalizer (`lib/approval-bff.ts:126`, `normalizeApprovedIntegration` at `:512`)
```
ApprovedIntegrationResponseDto (client-facing):
  id?, request_id?, approved_at?, approved_by?
  resource_infos: ResourceConfigDto[]              # SPLIT: included
  excluded_resource_infos?: ExcludedResourceInfoDto[]   # SPLIT: excluded
```

### Field-by-field

| Swagger field | Normalizer reads | Status |
|---|---|---|
| `id` | `record.id` (`:520`) | match |
| `request_id` | `record.request_id` (`:521`) | match |
| `approved_at` | `record.approved_at` (`:522`) | match |
| `approved_by` (ActorDto) | `record.approved_by` via `toActorDto` → `{user_id}` (`:523`) | match (client flattens) |
| `resources[]` (single array; `selected`/`exclusion_reason` per item) | **`record.resource_infos[]`** (`:517`) — different key, included-only | **MISSING / WRONG KEY** |
| (none — exclusion is `selected:false` inside `resources`) | **`record.excluded_resource_infos[]`** / `excluded_resource_ids` (`toExcludedResourceInfos`, `:302`) | **READS NON-CONTRACT FIELD** |
| `resources[].metadata` (provider/region/host/port/networkInterfaces) | not read — normalizer pulls flat `host`/`port`/`database_region` off the item | MISSING (nested metadata ignored) |
| `resources[].integration_category` (TARGET/NO_INSTALL_NEEDED/INSTALL_INELIGIBLE) | not read | MISSING |
| `resources[].recommend_fail_reason` | not read | MISSING |
| — | `scan_status` (UNCHANGED/NEW_SCAN), `integration_status` (INTEGRATED/NOT_INTEGRATED) read on each item (`:282`, `:314`) | NOT IN this DTO (item has neither) |

## Findings

1. **Response contract drift (primary).** The whole chain — mock (`lib/bff/mock/confirm.ts:691`),
   normalizer (`approval-bff.ts:512`), client API (`app/lib/api/index.ts:447`), and both
   consuming cards (`ApplyingApprovedCard.tsx:84-85` reads `resource_infos` +
   `excluded_resource_infos`) — is built on a **split included/excluded shape that the
   swagger does not define**. The contract returns one `resources[]` array where
   excluded items are `selected: false` with an `exclusion_reason`. Migration must
   collapse the split read into a single `resources[]` and derive inclusion/exclusion
   from `selected` (the Step-3 UI segment filter 전체/연동 대상/제외 대상 maps onto this).

2. **`metadata` nesting ignored.** Swagger nests provider/region/host/port under
   `metadata` (`TargetSourceResourceMetadataDto`, `:4713`); the normalizer reads them
   flat. region/host/port for the Step-3 table will be empty against a real BFF.

3. **`integration_category` / `recommend_fail_reason` unmapped.** Available in the
   contract, not consumed. The spec's "연동 제외 사유" column is contract
   `exclusion_reason` (present and read), so that column survives; the category field is unused.

4. **`scan_status` / `integration_status` are not in this DTO.** The Step-3 spec lists
   "스캔 이력 (신규/-)" and "연동 이력 (Integrated/-)" columns, and the normalizer reads
   `scan_status`/`integration_status` per item — but `TargetSourceResourceItemDto` defines
   neither. Either the contract is missing these fields or those columns cannot be
   populated from `approved-integration`; flag for BFF clarification.

5. **Base-path note (non-blocking).** Spec §5 writes the bare path; client uses
   `CONFIRM_BASE = '/target-sources'` (`app/lib/api/index.ts:294`) and the Next route is
   under `/integration/api/v1/…`. The `/install/v1` vs `/confirm/v1` prefix is resolved by
   the proxy layer, consistent with other Step verifications — not a Step-3-specific gap.

**Verdict:** endpoint correctly wired (path + method + operationId), but the 200 response
is consumed via a split `resource_infos`/`excluded_resource_infos` model that diverges from
the contract's single `resources[]` + per-item `selected`/`exclusion_reason`. Schema
alignment (collapse split, read `metadata`, decide `scan_status`/`integration_status`) is
required before cutting Step 3 to the new swagger.
