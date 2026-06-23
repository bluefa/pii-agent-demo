# Step 2 — 연동 대상 승인 대기 (API verification)

Shared step across **AWS / GCP / Azure / IDC**. Cloud variant = `WaitingApprovalStep.tsx` → `WaitingApprovalCard.tsx`; IDC variant = `IdcStep2WaitingApproval.tsx`. Both reuse the same cancel button and read-only resource table.

- Intended-API source: `pii-agent-migration-notes/01-target-source-detail-spec.md` §4
- Contract: `docs/swagger/install-v1.yaml` (all paths under `/install/v1` prefix)
- Code path: CSR `app/lib/api/index.ts` → Next.js proxy `app/integration/api/v1/...` → upstream BFF (2-hop). `CONFIRM_BASE = '/target-sources'` (`app/lib/api/index.ts:294`), so CSR calls resolve to `/integration/api/v1/target-sources/...`.

## Verification matrix

| Intended API | In swagger? (path + method + schema) | Currently called? (file:line) | Verdict |
|---|---|---|---|
| `GET …/approval-requests/latest` — 요청 DB 목록 및 반려 상태 조회 | YES. `GET /install/v1/target-sources/{targetSourceId}/approval-requests/latest` (swagger 3384-3453). 200 → `ApprovalRequestLatestDto` = `{ request: ApprovalRequestSummaryDto, resources: TargetSourceResourceItemDto[], result: ApprovalActionResponseDto }` (5702-5712). | YES. `getApprovalRequestLatest()` `app/lib/api/index.ts:608-615`; proxy `app/integration/api/v1/target-sources/[targetSourceId]/approval-requests/latest/route.ts:11`. Consumed in `WaitingApprovalCard.tsx:106-113` (header summary only). | **MATCH (path/method)** + **SCHEMA MISMATCH** — see §A |
| `POST …/approval-unavailable/confirm` — 반려 확인 → Step1 | YES. `POST /install/v1/target-sources/{targetSourceId}/approval-unavailable/confirm` (swagger 952-1021). No request body. 200 → `ApprovalUnavailableConfirmResponseDto` `{ target_source_id, confirm_status, processed_at, confirmed_by }` (4598-4618). | **NO.** Zero call sites in `app/**` / `lib/**` (grep `approval-unavailable`, `confirmApprovalUnavailable` → empty). | **NOT-WIRED** — see §B |
| `POST …/approval-requests/cancel` — 전체 요청 취소 → Step1 | YES. `POST /install/v1/target-sources/{targetSourceId}/approval-requests/cancel` (swagger 1174-1180+). No request body. | YES. `cancelApprovalRequest()` `app/lib/api/index.ts:617-626` (`POST`, no body); proxy `app/integration/api/v1/.../approval-requests/cancel/route.ts`. UI: `WaitingApprovalCancelButton.tsx:7,21-22` ("전체 요청 취소"), wired in both `WaitingApprovalStep.tsx:58` and `IdcStep2WaitingApproval.tsx:74`. | **MATCH** |
| reject flow (`POST …/approval-requests/reject`) — admin-side | YES. `POST /install/v1/target-sources/{targetSourceId}/approval-requests/reject`, body `ApprovalRejectRequestDto` `{ reason }` (1098-1173). | Admin only (`app/lib/api/index.ts:573`, `QueueBoard.tsx:58`). **Not surfaced in Step 2** — Step 2 shows rejection read-only via `RejectionAlert.tsx` off `project.isRejected`. | MATCH (admin); N/A for Step 2 |
| approve flow (`POST …/approval-requests/approve`) | YES (1244-1249). | Admin only (`app/lib/api/index.ts:555`, `QueueBoard.tsx:35`). Not in Step 2. | MATCH (admin); N/A for Step 2 |

## §A. `approval-requests/latest` schema mismatch (resources never read; result shape diverges)

The local `ApprovalRequestLatestResponse` type (`app/lib/api/index.ts:589-606`) diverges from swagger `ApprovalRequestLatestDto`:

1. **`resources[]` ignored.** Swagger returns `resources: TargetSourceResourceItemDto[]`, but the local type omits it and `WaitingApprovalCard.tsx:67-72` reads only `request.requested_at` / `request.requested_by.user_id` for the header. The actual Step 2 resource table is populated by a **different** endpoint — `getApprovedIntegration()` (`WaitingApprovalCard.tsx:86`, `getApproved_integration`), not by `approval-requests/latest`. Functionally OK today, but the intended "요청 DB 목록 … 조회" via `latest` is not how resources are sourced; the contract's `resources[]` is dead on the client.
2. **`result` shape.** Local type declares `result.processed_by: { user_id: string }` and `result.request_id: number | null`; swagger `ApprovalActionResponseDto` matches field names but `processed_by` is `ActorDto` (optional `user_id` only) and all fields optional. Local non-nullable typing is stricter than contract (low risk, but a typing lie).
3. **404 handling.** Swagger declares `404 No approval request found`; the consumer swallows all errors to `null` (`WaitingApprovalCard.tsx:110-112`), so this is tolerated.

## §B. Reject-acknowledge ("반려 확인 → Step1") is NOT-WIRED

Spec §4 step 3: a rejected request should offer 반려 사유 / 반려일시 / 검토자(ID) + a "다시 선택하기" button that calls `POST …/approval-unavailable/confirm` and routes back to Step 1.

Current behavior: `RejectionAlert.tsx` renders 사유 + 반려일시 only, **read-only**. There is:
- **No 검토자(ID)** displayed (reviewer field absent in component — see §C).
- **No "다시 선택하기" button** and **no `approval-unavailable/confirm` call** anywhere.
- The only escape from a rejected Step 2 is the generic "전체 요청 취소" (`cancel`).

So the dedicated reject-acknowledge → Step1 transition the contract supports (`approval-unavailable` + `approval-unavailable/confirm`, returning `confirm_status` through the `UNAVAILABLE → CONFIRMING` lifecycle) is unimplemented. Note `RejectionAlert` keys off `project.isRejected` (boolean, derived from upstream `approval.status === 'REJECTED'`, `lib/mock-data.ts:46`), independent of the swagger `UNAVAILABLE` / `UNAVAILABLE_ACKNOWLEDGED` enum — the client has no concept of the unavailable-acknowledged state.

## §C. Enum drift + ActorDto reviewer-name gap (affect Step 2 display)

- **Synthetic `CONFIRMED` vs swagger `UNAVAILABLE_ACKNOWLEDGED`.** Local `ApprovalStatus` (`lib/approval-bff.ts:32-39`) ends `… | 'UNAVAILABLE' | 'CONFIRMED'`. Swagger `ApprovalRequestSummaryDto.status` / `ApprovalActionResponseDto.status` enum is `PENDING|APPROVED|AUTO_APPROVED|REJECTED|CANCELLED|UNAVAILABLE|UNAVAILABLE_ACKNOWLEDGED` (4840-4847, 4867-4874) — there is **no `CONFIRMED`** member, and the client is **missing `UNAVAILABLE_ACKNOWLEDGED`**. This is the documented approval-enum drift; it is why §B's acknowledged state cannot be represented.
- **ActorDto reviewer-name gap.** Swagger `ActorDto` (4570-4574) exposes only `user_id` — no display name. Spec §4 wants "검토자(ID)"; ID is available but Step 2 (`RejectionAlert.tsx`) renders neither the reviewer ID nor a name. The result-side reviewer (`result.processed_by.user_id`) exists in the `latest` payload but is never surfaced in Step 2 — only the request-side `requested_by.user_id` is shown in the header.

## Summary (4–6 lines)

- `approval-requests/cancel` = full **MATCH** (path/method/no-body) and is the only mutating call Step 2 actually makes; wired in both Cloud and IDC variants.
- `approval-requests/latest` path/method MATCH but **schema mismatch**: client ignores the contract's `resources[]` (table is fed by a separate `approved-integration` call) and uses only the request-summary header.
- `approval-unavailable/confirm` is in swagger but **NOT-WIRED** — the spec's "반려 확인 → Step1" flow is unimplemented; rejection is shown read-only via `RejectionAlert` and the only exit is generic `cancel`.
- Enum drift confirmed: local `ApprovalStatus` carries synthetic `CONFIRMED` and is **missing `UNAVAILABLE_ACKNOWLEDGED`**, so the acknowledged-unavailable lifecycle cannot be represented client-side.
- ActorDto gap: contract gives `user_id` only; Step 2 surfaces no 검토자(ID)/name on rejection at all.
