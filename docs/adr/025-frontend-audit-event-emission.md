# ADR-025: Frontend Audit Event Emission

## Status

Proposed — 2026-07-23

Refines the observability revision of 2026-07-22 (BFF-DB storage; see
`docs/feature/observability-strategy-overview.md`). This ADR fixes **what the
frontend sends**: the event taxonomy, the shape of a single event, the policy
for copying response data into events, and the trust boundary between browser
and server. Storage, retention, and query APIs stay with the BFF (Phase 1 of
the implementation plan) and are out of scope here.

## Context

The admin "usage history" feature answers one operator question: *what happened
on this target source — who did what, and how did it end?* The audience is
operators, not developers.

Constraints already decided elsewhere and taken as given:

- Events are stored in the **BFF DB** (the FE migrates GCP projects; the BFF is
  the fixed point). FE stdout logs are a 30-day diagnostic aid only.
- Login is mandatory; `userId`/`role` are resolved server-side from the
  session. There is no `sessionId`.
- Free-text fields (`errorMessage` and any raw message) are **never stored**.
  Only fixed symbols (`status`, `code`, `error.name`), numbers, and domain
  identifiers are.

Facts about the product that shape the design (verified against code):

- Customer-facing pages are exactly two: `/services` (CSR shell; the server
  sends an empty frame) and `/target-sources/:id` (real SSR: the server calls
  `bff.targetSources.get` + `getProcessStatus` to build the first paint, then
  the open page does CSR calls).
- Every CSR call goes through the single `fetchJson` wrapper, which already
  tags `X-Request-Id` / `X-Client-Page` / `X-Client-Action` (function name,
  46 call sites) and can measure duration for free.
- The only polling loops are `useScanPolling` (`getLatestScanJob`) and
  `useTestConnectionPolling` (`getTestConnectionLatest`), both via
  `usePollingBase`. Each starts after a user-triggered job and stops when the
  job settles. There is no process-status polling.
- Business results arrive inside successful responses: `ScanJobResponse`
  carries `scan_status` / `duration_seconds` / `resource_count_by_resource_type`
  (and free-text `scan_error`); `TestConnectionVersionResult` carries an
  overall `connection_status` plus a per-resource result array.

## Decision

### 1. Event taxonomy — six types

| eventType | Meaning | Origin |
|---|---|---|
| `page_view` | A page was opened (server rendered it successfully) | FE server (SSR) |
| `screen_read` | A single read triggered by the user opening/expanding UI (resource list, logical-DB list) | Browser |
| `action` | A button-driven act. Synchronous actions (e.g. `confirmInstallation`) carry their result (HTTP status, error `code`) in this one event | Browser |
| `action_result` | The settle outcome of an asynchronous action (scan, test connection): status enum, duration, structured summary | Browser |
| `client_error` | A failure caught while the page is in use (5xx seen by the browser, Zod validation failure on a 200, render error) | Browser |
| `ssr_error` | Page generation failed on the server; the customer saw an error page instead of the page | FE server (SSR) |

Every event shares one envelope; the type adds a small detail block:

```
envelope: eventType · ts · actor{userId, role}      ← actor is server-stamped
          page{template} · action{name, method, status, durationMs}
          correlation{requestId, targetSourceId, serviceCode}
          domainContext{processStatus, provider}    ← snapshot at event time
detail:   outcome / error{name, code, zodIssues[{path, code}]} per type
```

New pages, actions, or context keys extend the envelope additively; display
labels are a read-time dictionary (function name → Korean label), so old rows
never go stale.

### 2. Asynchronous actions: start + settle, no poll rows

- The trigger (`startScan`, `triggerTestConnection`) emits one `action` event
  with the accepted status (202) and the job identifier from the response
  (`scan_version`, `test_connection_version`).
- The individual polling GETs are **not recorded**. When the poll observes a
  settled status, the browser emits one `action_result` event carrying the
  outcome enum, duration, and the same job identifier.
- A polling GET that itself fails (5xx) is recorded as `client_error`.
- The admin UI may pair `action` and `action_result` rows **by the job
  identifier present in both events**. This is a mechanical join on a stored
  fact, not an inference.
- Consequence accepted: an `action` row may have no `action_result` row (the
  browser closed before settle). The UI shows the absence; it does not guess.

### 3. Business failure is an outcome, not an error

`scan_status=FAIL` inside a 200 response, or FAIL entries in the
test-connection resource array, are recorded as `action_result` with a failure
outcome (e.g. `{status:'FAIL', detail:{total:12, fail:2, failedResourceIds:[…]}}`).
They are what operators most need to see. The `client_error`/`ssr_error` types
are reserved for the system misbehaving.

### 4. Response allowlist

An event copies response data **only through a per-event-type allowlist**:

- Allowed: status enums, counts, durations, job identifiers, domain
  identifiers (`targetSourceId`, `resource_id`).
- Forbidden: free text (`scan_error`, error messages), response bodies, list
  contents, credentials/URIs, anything not explicitly listed.
- Implementation rule: **never spread or bulk-copy a response object** — our
  generated Zod schemas are `passthrough`, so unknown upstream fields would
  leak straight into the audit store. Fields are picked by name, one by one.

### 5. Trust boundary and transport

```
browser  — builds the event at the observation site (fetchJson wrapper /
           poll settle / error boundary), batches, POSTs to the FE ingest route
FE server — overwrites actor{userId, role} from the session (client-sent
           identity is never adopted), stamps server time, forwards to BFF
           ingest (best-effort, drop counter). SSR events (page_view,
           ssr_error) are built directly on the server, which self-stamps the
           rendered page template (there is no X-Client-Page during SSR).
BFF      — stores structured fields only
```

Outcome/detail fields originate in the browser and are accepted as-is: a user
can only pollute their own history, and the server cannot observe what the
browser saw. Identity is the only field worth forging, and it is server-owned.

### 6. Facts only — no derived states, aggregation allowed

- One event = one observation. The store never records interpretations that
  span events: no "recovered", no "revisit", no "stuck customer" flags.
- Read-time **aggregation of stored facts is allowed** (count, group-by,
  time-window): e.g. the admin "needs attention" list is
  `count(*) where eventType in (client_error, ssr_error) and ts > now()-24h
  group by target_source_id`. Aggregation summarizes facts; it does not invent
  new ones.
- If a derived view (e.g. "customers with ≥3 failures") is ever wanted, that
  is a separate feature decision on top of the audit store, not part of it.

## Alternatives considered

- **Store rendered sentences** ("설치 확정 요청 → 성공") — rejected: display
  wording would be frozen at write time and rot as the product evolves. Facts
  are stored; sentences are a read-time dictionary.
- **Record every polling GET** — rejected: dozens of identical rows per job
  drown the timeline and carry no operator information beyond the settle.
- **Derive session/recovery/revisit states at write time** — rejected: that is
  business logic built on audit data, with boundary definitions (what counts
  as a visit?) the product has not made. Raw `page_view` facts plus visible
  time gaps let operators draw their own conclusions.
- **Layer-of-execution labels in the UI** (browser/SSR/FE server/BFF) —
  rejected as operator-facing vocabulary; the service is browser-only, so the
  operator-meaningful split is "opening the page" vs "using the page". The
  technical origin remains a stored field for developers.

## Consequences

- The collection layer from PR #558 (wrapper headers, ring buffer, ingest
  route defenses, `log.ts` single exit) is reused as-is; this ADR only fixes
  the event vocabulary carried over it.
- Admin screens (target-source usage history; 24h "needs attention"
  aggregation) can be built entirely from these six event types plus read-time
  dictionaries. Mockup: `docs/feature/observability-admin-audit-mockup.html`.
- The BFF schema negotiation (implementation plan Phase 1-2) receives this
  taxonomy as its input contract.
- Gaps are honest: rows without results exist (closed browsers), and code-less
  errors are distinguishable only if `error.name`/fingerprint storage is
  adopted (open decision in the strategy document).

## References

- Strategy: `docs/feature/observability-strategy-overview.md`
- Implementation plan: `docs/feature/observability-implementation-plan.md`
- Collection layer: PR #558 (`docs/feature/observability-plan.md`)
- Mockup: `docs/feature/observability-admin-audit-mockup.html`
