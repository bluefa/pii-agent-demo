# IDC domain — ADR-019 contract review (commit bfb5f5a)

VERDICT: **CLEAN** (0 contract issues; 3 informational notes below)

## Verified against `docs/swagger/install-v1.yaml`

1. **Paths verbatim — PASS.** Upstream paths in `lib/bff/http.ts:214-222` are swagger-verbatim:
   `/target-sources/${id}/idc/installation-status`, `/target-sources/${id}/idc/previous-request`,
   `/idc/nlb/${nlbIndex}/resources`, `/idc/nlb/table`. The `/idc/target-sources/` segment in
   `app/lib/api/idc.ts:240` and the route dir is the **internal Next proxy** only (documented as a
   free app-local choice); the upstream rewrite lands the correct swagger order. operationIds match
   (getIdcPreviousRequest L2553, getIdcInstallationStatus L2621, getOccupiedResources L3751,
   getNlbTable L3821). Path-param casing/format verbatim (`{targetSourceId}` int64, `{nlbIndex}` int32).

2. **Wire schemas — PASS.** `lib/bff/types/idc.ts` matches swagger field-for-field and casing-for-casing:
   - `IdcResourceInputWire`: adds `selected`, drops `name`/`resource_id`/server-assigned, `database_type: string` (plain). ✓
   - install-status DTO set: snake (`last_check`, `installation_status`, `bdc_side_cx_terraform_apply`,
     `bdc_side_bdp_terraform_apply`, `firewall_check`); shared 5-value enum `COMPLETED|FAIL|IN_PROGRESS|SKIP|UNKNOWN`. ✓
   - `Nlb*` camel-on-wire (`serviceCode`, `targetSourceId`, `isLatest`, `ipSet`, `databaseType`,
     `nlbIndex`, `nlbIpList`, `occupiedListenerCount`); both endpoints return top-level array. ✓

3. **Feature UNKNOWN → "작업중" — PASS.** `IDC_INSTALL_TASK_STATUS.UNKNOWN: 'running'` (== IN_PROGRESS bucket)
   and `idcInstallStatusLabel('UNKNOWN') === '작업중'`. Resource-level: rendered in `IdcStep4Installing.tsx:137`.
   Step-level: step DTOs feed `aggregateCardStatus` where UNKNOWN→running. Missing status defaults to
   `'UNKNOWN'` (never silent COMPLETED), `toStepView` + `toIdcInstallationView`. Unit test green (5/5).

4. **Response → mapper (`app/lib/api/idc.ts`) → UI — lossless PASS.** `toIdcInstallationView` maps all
   fields (`last_check.checked_at → lastCheck.checkedAt`, 3 step DTOs, per-resource status). Step4 consumes
   2-task pipeline + per-resource status + lastCheck.checkedAt. Spec's Step-4 `src`/`fw` blocker resolved by
   dropping those columns (no orphaned `source_ips`/`firewall_open` reads from install-status).
   `IdcResourceView.sourceIps/firewallOpen` survive correctly — they are Step-1/2 client state, a separate model.

5. **Mock — PASS.** `lib/mock-idc.ts` emits wire-snake == swagger; `IDC_PREV_REQUEST_SEED` reshaped (no
   `name`/`resource_id`, `selected` present); install-status includes resource `idc-r2` with
   `installation_status: "UNKNOWN"` AND step-level `bdc_side_bdp_terraform_apply.status: "UNKNOWN"`.
   NLB mocks in `lib/bff/mock/idc.ts` emit camel arrays. mock-adapter (L159-167) registers all 4.

6. **Governing rule — PASS.** `idc.getResources`/`updateResources` (idc/resources) are GONE;
   `checkIdcInstallation`/`confirmIdcFirewall`/`getIdcSourceIpRecommendation` and their routes
   (resources/check-installation/confirm-firewall/source-ip-recommendation) all removed. Only the 4
   swagger-sanctioned route dirs exist. No non-swagger `/idc/...` upstream calls. The hook
   (`useIdcInstallationStatus.ts:67-68`) correctly refreshes via plain re-GET (check-installation left contract).

## Informational notes (NOT contract violations — pre-flagged open items)

- **N1 (open item §8.d).** `SKIP` → bucket `'done'` and label `'제외'`. Spec recommended SKIP as
  neutral/resolved and flagged it for user confirmation; current choice is reasonable but unconfirmed.
- **N2 (open item §8.b).** `IdcResourceInput.selected` is in the wire type + mock seed but
  `toIdcResourceView` does not read it (no pre-check-on-import wiring). Acceptable — import-precheck UX
  was an open item; flag only so it isn't lost.
- **N3 (informational).** `NlbOccupiedResource.targetSourceId` is swagger `int64` typed as TS `number`
  (mock value 1001, safe). Same JS-precision caveat as everywhere else in the codebase; no action.
