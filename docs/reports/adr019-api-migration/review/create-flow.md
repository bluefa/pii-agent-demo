# Create-flow Contract Review — commit bfb5f5a

Adversarial CONTRACT review of create-flow / services / users / guides domain vs
`docs/swagger/install-v1.yaml`. Endpoints 35–38, 48–51.

**VERDICT: CLEAN (2 minor non-blocking issues).**

All 8 endpoints verified path-verbatim + wire-schema-exact against swagger:

- **35 creation-candidates** — client `POST /target-sources/services/{serviceCode}/creation-candidates`
  (renamed, extra `/target-sources/` seg dropped). Route `services/[serviceCode]/creation-candidates`
  (CSR-facing hop) → `normalizeTargetSourceCreationCandidates(camelCaseKeys(data))`. Bare array,
  `type`→`status`. Request authored snake (`cloud_type` lowercase, `metadata.project_id`). Mock emits
  bare array, snake, `is_sdu_type`, UPPERCASE `cloud_type`, `existing_target_source_id` on DUPLICATE. ✔
- **36 createTargetSource** — path SAME, **201** (route + mock). Round-trip body = candidate posted
  back via `snakeCaseKeys(candidate)` in CSR `createTargetSource` (lossless; null `existing_target_source_id`
  + UPPERCASE `cloud_type` preserved). Resp `TargetSourceInfo` (camel top + snake metadata) via
  `toBffTargetSourceCreatedInfo`. ✔
- **37 getTargetSourcesByServiceCode** — `GET /target-sources/services/{serviceCode}`, bare array
  `TargetSourceDetail[]`, `getSnakeRaw` + route `normalizeTargetSourceDetails(camelCaseKeys(...))`.
  `process_status` string-enum. ✔ (see Issue 1)
- **38 authorized-users (GET)** — `/services/{serviceCode}/authorized-users` (NOT under target-sources),
  `{users: UserInfo[]}`. add/remove (POST/DELETE) GONE from client + mock-adapter. ✔
- **48 users/search** — `{users: UserInfo[]}`, `q`/`excludeIds[]`. ✔
- **49 user/services/page** — Spring Page wire (flat envelope + `pageable`/`sort`, snake `service_code/service_name`)
  from mock; route reads flat `totalElements/totalPages/number/size`; `resolveUserService` accepts snake. ✔
- **50 user/me** — FLAT `{id,name,email}` (mock + type + CSR `getCurrentUser`); route tolerant of legacy
  `{user}` wrapper. ✔
- **51 admin/guides GET+PUT** — `GuidePutResult = GuideDetail` (camel `updatedAt`); mock returns camel on
  both; PUT request validates `contents.ko/en` strings (domain truth; swagger `object` = generator artifact). ✔

Governing rule: grep finds NO non-swagger calls in client (`lib/bff/http.ts`) or CSR (`app/lib/api/index.ts`).
`settings/aws`, non-paged `/user/services`, `registration-preview`, `authorized-users/{userId}` all dropped.

## Issues (minor, non-blocking)

1. **Mock `toBffTargetSourceDetail` (37) omits `service_code` + `service_name`.** Swagger `TargetSourceDetail`
   defines both; `lib/bff/mock/target-sources.ts:103-112` emits neither. Not UI-breaking — CSR
   `toProjectSummary` (`app/lib/api/index.ts:129-154`) reads neither — but a mock-vs-swagger field gap that
   masks a missing-field bug if a future consumer reads them. Add both for mock-parity.

2. **Orphaned out-of-contract mock methods left as dead code.** `mockServices.settings.aws.{get,update,verifyScanRole}`
   and `mockServices.projects` (`lib/bff/mock/services.ts:34-153`) are no longer wired by the client or
   mock-adapter (only `permissions.list` is exposed). Correctly NOT migrated as contract-backed, but the dead
   mock bodies (+ `import UpdateAwsSettingsRequest`, `mock-service-settings`) are cleanup debt. Same for the
   internally-renamed `mockTargetSources.previewRegistration` (now serves `getCreationCandidates`) — harmless
   but a stale name.

## Notes (acceptable by design, not issues)

- Route handler dirs sit under `services/[serviceCode]/...` (CSR-facing proxy hop) while `httpBff` targets the
  swagger `…/target-sources/services/{serviceCode}/…` (upstream hop). Two-hop architecture — the swagger governs
  the upstream hop only, which `httpBff` matches verbatim. Not a path violation.
- Page route (49) emits CSR-facing `{content, page:{…}}` (lossy: drops `pageable`/`sort`/`first`/`last`/`empty`/
  `numberOfElements`) — acceptable since CSR `getServicesPage` consumes only `{content, page}`.
