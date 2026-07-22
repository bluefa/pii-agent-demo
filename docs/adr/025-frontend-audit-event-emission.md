# ADR-025: Frontend Audit Event Emission

## Status

Proposed — 2026-07-23

Refines the observability revision of 2026-07-22 (BFF-DB storage; see
`docs/feature/observability-strategy-overview.md`). This ADR fixes **what the
frontend sends** for the customer usage-history (audit) stream: the event
taxonomy, the shape of a single event, the policy for copying response data
into events, and the trust boundary between browser and server. Storage,
retention, and query APIs stay with the BFF (Phase 1 of the implementation
plan) and are out of scope here.

## Scope

This ADR covers the **audit stream**: events that answer "who did what on
which target source, and how did it end", consumed by the admin usage-history
screens. It does **not** cover:

- Server operational records — `withV1` access logs, route-handler
  exceptions, upstream 5xx diagnostics. These remain in the diagnostic log
  stream (strategy document §2) and are correlated with audit events via
  `requestId`, not stored as audit rows.
- Authorization-denial (403) tracking. It is a **planned additive extension**
  of this taxonomy (a seventh event type emitted by the FE server), specified
  in implementation-plan Phase 3; the envelope below is designed so adding it
  requires no schema break.

## Context

The admin "usage history" feature answers one operator question: *what
happened on this target source — who did what, and how did it end?* The
audience is operators, not developers.

Constraints already decided elsewhere and taken as given:

- Events are stored in the **BFF DB** (the FE migrates GCP projects; the BFF
  is the fixed point). FE stdout logs are a 30-day diagnostic aid only.
- Login is mandatory; `userId`/`role` are resolved server-side from the
  session. There is no `sessionId`.
- Free-text fields (`errorMessage` and any raw message) are **never stored**.
  Only fixed symbols (`status`, `code`, `error.name`), numbers, and domain
  identifiers are.

Facts about the product that shape the design (verified against code; items
marked *#558* exist only on the PR #558 branch, which is a Phase 0
prerequisite, not merged behavior):

- Customer-facing pages are exactly two: `/services` (a static server shell —
  data loading is entirely CSR, so there is no per-visit dynamic SSR
  execution) and `/target-sources/:id` (real dynamic SSR: the server calls
  `bff.targetSources.get` + `getProcessStatus` to build the first paint, then
  the open page does CSR calls).
- CSR calls go through the single `fetchJson` wrapper. Request tagging
  (`X-Request-Id` / `X-Client-Page` / `X-Client-Action` with the API function
  name) and duration measurement are added by *#558*. Known bypasses that do
  not go through the wrapper (e.g. `ProjectHistoryPanel`'s raw `fetchInfra`
  call) must be migrated or explicitly listed as uninstrumented before
  Phase 2b relies on the wrapper.
- On the customer pages, the only repeating API loops are `useScanPolling`
  (`getLatestScanJob`) and `useTestConnectionPolling`
  (`getTestConnectionLatest`), both via `usePollingBase`. **Both hooks also
  poll on mount** (`autoStart`/`enabled` default true) — polling is not
  exclusively a follow-up to a local user action. Admin pages have their own
  `setInterval` loops; they are outside the audit stream.
- Business results arrive inside successful responses: `ScanJobResponse`
  carries `id`, `scan_version`, `scan_status`, `duration_seconds`,
  `resource_count_by_resource_type` (and free-text `scan_error`);
  `TestConnectionVersionResult` carries `test_connection_version`, an overall
  `connection_status`, `requested_at`/`completed_at`, and a per-resource
  result array. `startScan`'s response is a full `ScanJobResponse` (a job key
  is available at trigger time), but `triggerTestConnection`'s response is
  only `{success}` — **no job key at trigger time** (see §2).

## Decision

### 1. Event taxonomy — six types

| eventType | Meaning | Origin |
|---|---|---|
| `page_view` | A page was opened. Dynamic SSR pages: emitted by the FE server on successful render. Static/CSR pages (`/services`): emitted by the browser on route transition | FE server / browser |
| `screen_read` | A single read triggered by the user opening/expanding UI (resource list, logical-DB list) | Browser |
| `action` | A button-driven act. Synchronous actions (e.g. `confirmInstallation`) carry their result (HTTP status, error `code`) in this one event | Browser |
| `action_result` | The settle outcome of an asynchronous action (scan, test connection): status enum, duration, structured summary | Browser |
| `client_error` | A failure observed while the page is in use: a render error or unhandled rejection in the browser, or an error response observed by the browser on a CSR call. When the underlying cause is a schema-validation failure, the event detail carries the issue list (`{path, code}` pairs) — note that in this codebase validation runs in the FE server route (`schemas.parse` inside `withV1`), so the browser typically observes it as an error status, not as a local exception | Browser |
| `ssr_error` | Page generation failed on the server; the customer saw an error page instead of the page | FE server (SSR) |

### 1a. Envelope — field-level contract

Every event shares one envelope. Ownership: **S** = server-stamped
(authoritative, client value ignored), **B** = browser-asserted (validated,
see §5), **E** = emitter (browser for browser events, server for SSR events).

| Field | Req | Owner | Notes |
|---|---|---|---|
| `eventType` | ✅ | E | one of the six values (closed enum at ingest) |
| `origin` | ✅ | S | `browser` \| `server` — set from which ingest path the event arrived on, never from payload |
| `observedAt` | ✅ | E | when the emitter observed the fact (ISO-8601) |
| `receivedAt` | ✅ | S | server receipt time — authoritative for time-window queries; large `observedAt` drift is clamped and flagged |
| `actor.userId` / `actor.role` | ✅* | S | from session. *Nullable until auth ships (Phase 3); pre-auth rows store `actor=null` and admin renders "(pre-auth)" |
| `page.template` | ✅ | E | normalized template (`/target-sources/:id`), never a raw path. Browser events: from the wrapper's page tagging; SSR events: server self-stamps its own render target |
| `surface` | ✅ | S | derived server-side from `page.template` via `surfaceOf()` |
| `action.name` | per type | E | API function name (`startScan`) — required for `screen_read`/`action`/`action_result`, optional in error events, absent in `page_view` |
| `action.method` / `action.status` / `action.durationMs` | per type | E | HTTP facts of the observed call, where one exists |
| `job.kind` / `job.key` | async only | B | canonical async-job link: `{kind:'scan', key:scan_version}` / `{kind:'test_connection', key:test_connection_version}` (§2) |
| `correlation.requestId` | ✅ | E | forgery-harmless, correlation only |
| `correlation.targetSourceId` / `correlation.serviceCode` | when known | B | validated against session access (§5); absent on `/services`-level events that concern no target |
| `domainContext.processStatus` / `domainContext.provider` | CSR events | B | snapshot of what the page held at event time |
| `detail` | per type | E | type-specific block (§3, §4): `outcome` for results, `renderMs` for `page_view`, `error{name, code, zodIssues}` for errors |

The Phase 1-2 deliverable is a **discriminated union schema** (one variant per
`eventType`) that makes required/optional per type explicit; this table is its
input. Units: durations in ms except where the upstream response provides
seconds (`durationSec` mirrors `duration_seconds` as-is and is labeled).

New pages, actions, or context keys extend the envelope additively; display
labels are a read-time dictionary (function name → Korean label), so old rows
never go stale.

### 2. Asynchronous actions: start + settle, no poll rows

- The trigger emits one `action` event with the accepted status and, when the
  trigger response carries it, the job key: `startScan` returns a full
  `ScanJobResponse`, so `job = {kind:'scan', key:scan_version}` is available
  immediately. **`triggerTestConnection` returns only `{success}`** — the
  start event has no job key today. Requiring the trigger response to return
  the new `test_connection_version` is a **Phase 1 negotiation item**; until
  it lands, test-connection start/settle rows may appear unpaired in admin
  (the UI shows unpaired rows honestly rather than pairing by time-window
  heuristics, which would be inference).
- The individual polling GETs are **not recorded**. When a poll observes a
  settled status, the browser emits one `action_result` with the outcome
  enum, the duration, and the job key from the result payload
  (`scan_version` / `test_connection_version`).
- Because both polling hooks also run on mount, a browser can observe the
  settle of a job it did not start (another tab, another user). To keep
  `action_result` an act-outcome rather than a viewing record, the browser
  emits it **only for jobs whose trigger it performed locally** (it remembers
  the job keys it started, in memory). Additionally the ingest layer enforces
  an idempotency key `(targetSourceId, job.kind, job.key, eventType)` so
  duplicate settle observations collapse to one row.
- Durations: scan uses the response's `duration_seconds` verbatim;
  test connection computes `completed_at − requested_at` from the same
  response (arithmetic on two fields of one observed payload, not a
  cross-event derivation).
- Consequence accepted: an `action` row may have no `action_result` row (the
  browser closed before settle). The UI shows the absence; it does not guess.

### 3. Business failure is an outcome, not an error

`scan_status=FAIL` inside a 200 response, or FAIL entries in the
test-connection resource array, are recorded as `action_result` with a failure
outcome (e.g. `{status:'FAIL', total:12, fail:2, failedResourceIds:[…]}`).
They are what operators most need to see. The `client_error`/`ssr_error`
types are reserved for the system misbehaving.

### 4. Response allowlist

An event copies response data **only through a per-event-type allowlist**.
The exact matrix (start set; extending it is a reviewed change):

| eventType | Allowed response-derived fields | Caps / validation |
|---|---|---|
| `screen_read` | `outcome.count` | integer |
| `action` (sync) | `action.status`, `error.code` | status = HTTP int; `code` validated against the known BFF code set, unknown → `UNKNOWN` |
| `action_result` (scan) | `outcome.status` (= `scan_status`), `outcome.durationSec`, `outcome.detail` (= `resource_count_by_resource_type`) | status validated against the scan enum (`SUCCESS`/`FAIL`/`TIMEOUT`/`CANCELED`/…), unknown → `UNKNOWN`; detail = map of type→int only |
| `action_result` (test connection) | `outcome.status` (= `connection_status`), `outcome.total`, `outcome.fail`, `outcome.failedResourceIds`, `outcome.durationSec` | status validated against the enum; `failedResourceIds` is a **bounded identifier array** (≤ 20 entries, each ≤ 64 chars) — an explicit exception to the "no list contents" rule because entries are domain identifiers, not payload data |
| `client_error` / `ssr_error` | `action.status`, `error.code`, `error.name`, `error.zodIssues[{path, code}]` | `error.name` matched against a fixed allowlist of known error classes, else `Error`; `zodIssues` ≤ 20 entries, `path` ≤ 128 chars, no messages |
| `page_view` | `detail.renderMs` | integer |

General rules:

- Allowed value kinds: status enums, counts, durations, job identifiers,
  domain identifiers (`targetSourceId`, `resource_id`).
- Forbidden: free text (`scan_error`, error messages), response bodies, list
  contents beyond the bounded identifier arrays above, credentials/URIs,
  anything not in the matrix.
- Enum values are validated at emission against locally-known value sets —
  **not** trusted from the generated Zod schemas, which are
  `partial().passthrough()` and accept arbitrary strings. Unknown values are
  stored as `UNKNOWN`; the raw value goes to the diagnostic log only.
- Implementation rule: **never spread or bulk-copy a response object** —
  passthrough schemas would leak unknown upstream fields straight into the
  audit store. Fields are picked by name, one by one.

### 5. Trust boundary and transport

```
browser  — builds the event at the observation site (fetchJson wrapper /
           poll settle / error boundary), batches, POSTs to the FE ingest route
FE server — validates against the ingest schema (closed enums, caps, shapes);
           overwrites actor{userId, role} from the session (client-sent
           identity is never adopted); stamps receivedAt, origin, surface;
           verifies the session user is authorized for the claimed
           correlation.targetSourceId (reusing the domain access check) and
           rejects the event otherwise; forwards to BFF ingest (best-effort,
           drop counter). SSR events (page_view, ssr_error) are built
           directly on the server, which self-stamps the rendered page
           template (there is no X-Client-Page during SSR).
BFF      — stores structured fields only; enforces the §2 idempotency key
```

The **ingest schema and the stored schema are distinct**: the ingest schema
is what the browser may claim (no `actor`, no `origin`, no `receivedAt`,
no `surface`); the stored schema adds the server-stamped fields. Browser
events are therefore *authenticated assertions*: identity, time-of-record,
origin, and target authorization are server-verified, while observation
content (outcome, detail) is accepted as-is — the server cannot see what the
browser saw. Residual forgery is bounded: a logged-in user can only write
events against targets they are authorized for, every row carries their
server-stamped identity, and rows carry `origin` so operational aggregates
can be filtered or weighted by provenance if abuse is ever suspected.

### 6. Facts only — no derived states, aggregation allowed

- One event = one observation. The store never records interpretations that
  span events: no "recovered", no "revisit", no "stuck customer" flags.
- Read-time **aggregation of stored facts is allowed** (count, group-by,
  time-window): e.g. the admin "needs attention" list is
  `count(*) where eventType in (client_error, ssr_error) and receivedAt >
  now()-24h group by target_source_id`. Aggregation summarizes facts; it does
  not invent new ones.
- If a derived view (e.g. "customers with ≥3 failures") is ever wanted, that
  is a separate feature decision on top of the audit store, not part of it.

## Alternatives considered

- **Store rendered sentences** ("Installation confirmation requested →
  succeeded") — rejected: display wording would be frozen at write time and
  rot as the product evolves. Facts are stored; sentences are a read-time
  dictionary.
- **Record every polling GET** — rejected: dozens of identical rows per job
  drown the timeline and carry no operator information beyond the settle.
- **Pair unkeyed test-connection start/settle by time window** — rejected:
  that is inference, and wrong across tabs/users. The contract change
  (trigger returns the job key) is negotiated instead; until then unpaired
  rows are shown as-is.
- **Derive session/recovery/revisit states at write time** — rejected: that
  is business logic built on audit data, with boundary definitions (what
  counts as a visit?) the product has not made. Raw `page_view` facts plus
  visible time gaps let operators draw their own conclusions.
- **Layer-of-execution labels in the UI** (browser/SSR/FE server/BFF) —
  rejected as operator-facing vocabulary; the service is browser-only, so the
  operator-meaningful split is "opening the page" vs "using the page". The
  technical origin remains a stored field (`origin`) for developers.

## Consequences

- The collection layer from PR #558 (wrapper headers, ring buffer, ingest
  route defenses, `log.ts` single exit) is reused as-is and is a
  prerequisite; this ADR only fixes the event vocabulary carried over it.
  The emission work itself (event builders, action/settle mappings, ingest
  route extension, SSR emission) is a dedicated implementation-plan phase
  (Phase 2b) that Admin (Phase 4) depends on.
- Admin screens (target-source usage history; 24h "needs attention"
  aggregation) are built from these six event types **plus domain APIs**
  (the target-source list, names, owners, and current process status come
  from domain endpoints; audit contributes the history and the aggregates)
  and read-time dictionaries. Mockup:
  `docs/feature/observability-admin-audit-mockup.html`.
- The BFF schema negotiation (implementation plan Phase 1-2) receives this
  taxonomy as its input contract, including the two contract asks:
  test-connection trigger returning its job key, and the ingest idempotency
  key.
- Gaps are honest: rows without results exist (closed browsers, and unpaired
  test-connection rows until the trigger contract lands), pre-auth rows have
  no actor, and code-less errors are distinguishable only if
  `error.name`/fingerprint storage is adopted (open decision in the strategy
  document).

## References

- Strategy: `docs/feature/observability-strategy-overview.md`
- Implementation plan: `docs/feature/observability-implementation-plan.md`
- Collection layer: PR #558 (`docs/feature/observability-plan.md`)
- Mockup: `docs/feature/observability-admin-audit-mockup.html`
