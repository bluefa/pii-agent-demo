# Approval Domain — Contract Review (commit bfb5f5a)

Adversarial CONTRACT review against `docs/swagger/install-v1.yaml` (Approval Requests)
and spec `specs/D-approval.md`. Read-only.

## Verdict: CLEAN (contract) — 1 non-blocking cleanup nit

The boundary architecture diverges from spec §3.0 (which proposed
`fetchInfraCamelJson` at the client) but is **internally consistent and correct**:
the single casing boundary lives in each **route handler** as
`normalizeX(camelCaseKeys(raw))` (`lib/approval-response.ts` + 8 routes). The
client uses raw `fetchInfraJson` and receives already-normalized camel from the
route. No double-camelization, no silent `as T` on migrated responses.

## Verified (all pass)

1. **PATH/METHOD verbatim.** All 8 endpoints match swagger char-for-char
   (876/952/1022/1098/1174/1244/3384/3454). `createApprovalRequest` route returns
   `{ status: 200 }` (not 201); mock also returns `{ status: 200 }`. Route tree:
   `approval-requests/{approve,cancel,latest,reject,route.ts}`, `approval-history`,
   `approval-unavailable/{route.ts,confirm}`. `system-reset` route dir removed.

2. **REQUEST/RESPONSE wire schema.** `lib/approval-response.ts` domain types +
   normalizers match every DTO field/casing: ApprovalRequestSummaryDto,
   ApprovalActionResponseDto, ApprovalUnavailableResponseDto (request_id/status/
   processed_by/processed_at/reason), ApprovalUnavailableConfirmResponseDto
   (target_source_id/confirm_status/processed_at/confirmed_by — `confirmedBy` typed
   `string`, NOT ActorDto ✓), ApprovalRequestLatestDto (request/resources[]/result —
   `resources[]` added as opaque `Record<string,unknown>[]`, documented), ActorDto
   (`userId` only, no name/email). reject/unavailable body `{reason}` required;
   approve body `{comment?}` optional; cancel/confirm no body.

3. **ENUM.** `ApprovalRequestStatus` = swagger 7-value set incl.
   `UNAVAILABLE_ACKNOWLEDGED`; synthetic `CONFIRMED` dropped. `ApprovalConfirmStatus`
   is the distinct 7-value confirm lifecycle (IDLE…CONFIRMED). Unknown values degrade
   to a contract default (`PENDING`/`IDLE`) rather than throwing — acceptable hardening.

4. **I-3 flip complete.** Snake→snake `normalize*` retired (the new file is
   wire-snake→camel). UI reads camel: `WaitingApprovalCard` →
   `request.requestedAt` / `request.requestedBy.userId`; `ApprovalApplyingBanner` →
   `request.resourceSelectedCount`. No undefined-producing half-migration.
   `approval-unavailable` (+confirm) fully wired NEW: client + http.ts + types +
   mock + route + mock-adapter.

5. **Mock == swagger snake.** All approval mocks emit swagger snake DTOs
   (`createApprovalRequest`/approve/reject/cancel/latest/unavailable/confirm). Legacy
   `{success, result, process_info}` wire keys are gone from these returns.
   `getApprovalHistory` mock returns a **flat Spring `Page`** (`emptyPage`,
   confirm.ts:869) with camel `pageable`/`sort` meta and snake `content[]` items
   `{request, result?}` — matches swagger Page + the agreed out-of-swagger content shape.

6. **Governing rule.** No non-swagger approval calls reachable: grep for
   `system-reset` / `approval-requests/confirm` / `confirm-firewall` returns nothing
   in client/http/types/routes. `createApprovalRequest` request body uses Option (B)
   (legacy `{resource_inputs}`) flagged greppably at route.ts:8
   (`// ADR-019: out-of-contract request shape, pending BFF`) — matches spec §2.1.

## Issue 1 (non-blocking, cleanup) — orphaned `systemResetApprovalRequest`

The commit message claims "system-reset removed", but `systemResetApprovalRequest`
survives in `lib/bff/mock/confirm.ts:1471` plus its test
`lib/__tests__/mock-confirm-system-reset.test.ts`. Its entire consumer surface was
removed (client fn, `lib/bff/http.ts`, `lib/bff/types.ts` confirm interface, route
dir, mock-adapter wiring) — grep confirms it is **unreachable** from any adapter.
So it is now dead mock code + a test exercising a dead path.

This is **not a contract defect** — spec §5.1 explicitly recommended KEEPING
system-reset as an out-of-contract dev helper until #8 (`approval-unavailable/confirm`)
is product-confirmed to replace it. But the current state is the worst of both: the
*public* surface is gone (so it cannot be invoked) while the *mock* and *test* linger.
Either (a) restore the full out-of-contract surface if it is still wanted, or
(b) delete the orphaned mock fn + test to match the commit message. Recommend (b)
since #8 now covers the UNAVAILABLE→initial reset path. Adjust the commit/PR wording
either way ("removed" overstates the current state).
