# Step 6 API Verification — 연결 확인 / 완료 승인 대기

**Scope:** Cloud `ConnectionVerifiedStep`, IDC `IdcStep6ConnectionVerified`.
**Intended-API source:** `/Users/study/pii-agent-migration-notes/01-target-source-detail-spec.md` §8 (Step6).
**Contract:** `docs/swagger/install-v1.yaml`.
**Date:** 2026-06-24.

---

## Verification matrix

| Intended API (spec §8) | In swagger? (path + method + schema) | Currently called? (file:line; stub vs real) | Verdict |
|---|---|---|---|
| `GET …/confirmed-integration` — 승인 대기 리소스 목록 | YES. `/install/v1/target-sources/{targetSourceId}/confirmed-integration` `get` `operationId: getConfirmedIntegration`, 200 → `ConfirmedIntegrationResponse` (`install-v1.yaml:2897-2967`) | **CLOUD: real.** `ConnectionVerifiedStep` wraps `<ConfirmedIntegrationDataProvider>` (`ConnectionVerifiedStep.tsx:77`) → `getConfirmedIntegration` (`ConfirmedIntegrationDataProvider.tsx:4,40`) → route `confirmed-integration/route.ts:26` → `bff.confirm.getConfirmedIntegration`. **IDC: divergent source.** `IdcStep6ConnectionVerified.tsx:71` uses `useIdcResources` → `getIdcResources` which hits **`…/idc/resources`** (`app/lib/api/idc.ts:154,158`), NOT `confirmed-integration`. | CLOUD ✅ / IDC ⚠️ (different-but-intentional endpoint; the read hook is shared across IDC steps 2/3/6/7 and the mock co-locates server fields on `/resources` — see `idc.ts:106-109`. Path mismatch vs spec §8.) |
| `GET …/test-connection/latest_version` — 최신 결과 + 재시도 폴링 | YES. `/install/v1/target-sources/{targetSourceId}/test-connection/latest_version` `get` `operationId: getLatestTestConnectionStatus`, 200 → `TestConnectionVersionResult` (`connection_status` enum PENDING/RUNNING/SUCCESS/FAIL) (`install-v1.yaml:1976-2042, 5214-5239`) | **NOT wired in Step 6 (either provider).** Neither `ConnectionVerifiedStep.tsx`, `IdcStep6ConnectionVerified.tsx`, nor `ConfirmedResourcesSlot.tsx` imports `latest_version`/`latest-results`/`completion-status`. App-wide, `latest_version` is consumed only by Step-5 connection-test code (`ResourceResultRow.tsx`, `TestConnectionHistoryModal.tsx`). | ❌ NOT-WIRED. Step 6 shows a static "승인 대기" badge + read-only table; no latest-result fetch and no retry-polling exists. |
| `PUT …/test-connection-acknowledgment {confirmed:false}` — 재실행 모달 "되돌아가기" = 롤백 | YES. `/install/v1/target-sources/{targetSourceId}/test-connection-acknowledgment` `put` `operationId: updateTestConnectionConfirmation`, summary **"Test Connection 완료 확인 설정/롤백"**, body `UpdateTestConnectionConfirmationRequest` (`required: [confirmed]`, `confirmed: boolean`), 200 → `TestConnectionConfirmationResponse` (`install-v1.yaml:51-126, 4323-4340`) | **Client/route exist and support `{confirmed:false}`, but the Step-6 button does NOT call them.** Handler is a placeholder toast: `handleConfirm` → `toast.info('…BFF 연동 후 활성화됩니다.')` (`ConnectionVerifiedStep.tsx:39-42`, identical at `IdcStep6ConnectionVerified.tsx:32-35`). Wiring that exists but is unused by Step 6: `updateTestConnectionConfirmation(id, confirmed)` (`app/lib/api/index.ts:706-713`) → route `test-connection-acknowledgment/route.ts:12-20` (`confirmed: body.confirmed === true`) → `bff.confirm.updateTestConnectionConfirmation` (`lib/bff/http.ts:310-314`, body passthrough). | ❌ NOT-WIRED (button = placeholder). Underlying acknowledgment stack ✅ supports `{confirmed:false}` rollback. |
| `GET …/test-connection/latest_version` — 재시도 폴링 (SUCCESS/FAIL/RUNNING) | Same endpoint as above (`install-v1.yaml:1976`); enum present. | Not wired in Step 6 (see row 2). No polling loop in either Step-6 component. | ❌ NOT-WIRED |

---

## Critical findings

1. **"재실행" handler is a placeholder toast in BOTH providers — confirmed NOT-WIRED.** `ConnectionVerifiedRetestButton.handleConfirm` opens `ConfirmRewindModal` (kind `'retest'`) and on confirm only fires `toast.info('연결 테스트 재실행(5단계로 되돌아가기)은 BFF 연동 후 활성화됩니다.')` (`ConnectionVerifiedStep.tsx:33-61`, `IdcStep6ConnectionVerified.tsx:26-54`). It never calls `test-connection-acknowledgment`. The in-code comment says the rewind endpoint "is not in the contract yet" — but the acknowledgment endpoint with `{confirmed:false}` rollback semantics **does** exist in swagger (line 51, summary "완료 확인 설정/롤백"), so the contract gap is overstated.

2. **`{confirmed:false}` rollback IS supported end-to-end (from commit 297e872).** Route accepts `{ confirmed }` and forwards `confirmed: body.confirmed === true` (`route.ts:18`) — `{confirmed:false}` passes through as `false`. Client `updateTestConnectionConfirmation(id, confirmed: boolean)` (`index.ts:706`) and BFF `confirm.updateTestConnectionConfirmation` (`http.ts:310`) both pass the body verbatim. Request wire type `UpdateTestConnectionConfirmationRequestWire { confirmed: boolean }` (`lib/bff/types/test-connection.ts:67-70`) matches swagger `UpdateTestConnectionConfirmationRequest` exactly. The `=== true` coercion means a malformed/absent body degrades to `false` rather than 400 — note but harmless for the rollback path.

3. **`latest_version` (load + retry-poll) is entirely absent from Step 6.** Spec §8 lists it twice (load + retry polling); the implementation does neither. Step 6 renders a static "승인 대기" badge and a read-only resource table only.

---

## Summary (4-6 lines)

- `GET confirmed-integration`: swagger-confirmed (`getConfirmedIntegration` → `ConfirmedIntegrationResponse`). **Cloud wired** via `ConfirmedIntegrationDataProvider`; **IDC reads `…/idc/resources` instead** (shared read hook, intentional but path diverges from spec §8).
- `GET test-connection/latest_version`: swagger-confirmed (`TestConnectionVersionResult`, status enum), but **NOT-WIRED in Step 6** (no latest-result fetch, no retry-poll in either provider).
- `PUT test-connection-acknowledgment {confirmed:false}`: swagger summary literally "완료 확인 설정/롤백"; body/response schemas match. The acknowledgment route/client/BFF (commit 297e872) **do support `{confirmed:false}`**, but the Step-6 "재실행" button is a **placeholder toast** and never calls it → **NOT-WIRED**.
- Net: Step 6 is largely a static read-only confirmation screen. Real gaps to close: (a) wire retest → `PUT …acknowledgment {confirmed:false}`; (b) add `latest_version` load + retry-poll; (c) reconcile IDC's `/idc/resources` vs spec's `confirmed-integration`.
