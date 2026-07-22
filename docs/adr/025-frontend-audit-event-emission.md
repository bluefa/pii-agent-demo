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
- Authorization-denial (403) tracking. It is a **planned extension**: a
  seventh event type named `auth_denied`, emitted by the FE server
  (`origin=server`, actor from session, `action.status=403`, no other
  detail). Page-level denials self-stamp `page.template`; API-level denials
  carry the denied API path in a separate normalized `route.template` field
  (an API path is not a page template, and `surfaceOf()` classifies page
  prefixes only — `surface` derives from `page.template` when present, else
  from a route-prefix mapping defined in Phase 3). The variant requires
  **exactly one location field** (`page.template` for page-level denials,
  `route.template` for API-level denials) — a stated exception to the
  common-required `page.template` rule. Adding the type changes no existing
  field; it adds the enum value and the `route.template` column as an
  **additive, coordinated schema extension** (FE ingest schema and BFF
  schema extended together in Phase 3 — a schema change, just a compatible
  one).

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
| `screen_read` | A single read triggered by the user opening/expanding UI (resource list, logical-DB list). **Emitted at the UI observation site** (the component/hook reacting to the user opening a panel), never by blanket per-function tagging — automatic mount loads, background refreshes, and internal retries do not emit (they would record machine activity as user reads) | Browser |
| `action` | A button-driven act. Synchronous actions (e.g. `confirmInstallation`) carry their result (HTTP status, error `code`) in this one event | Browser |
| `action_result` | The settle outcome of an asynchronous action (scan, test connection): status enum, duration, structured summary | Browser |
| `client_error` | A failure observed while the page is in use: a render error or unhandled rejection in the browser, or an error response observed by the browser on a CSR call. When the underlying cause is a schema-validation failure, the event detail carries the issue list (`{path, code}` pairs) — note that in this codebase validation runs in the FE server route (`schemas.parse` inside `withV1`), so the browser typically observes it as an error status, not as a local exception | Browser |
| `ssr_error` | Page generation failed on the server; the customer saw an error page instead of the page. **Server-origin render failures belong exclusively here** — the browser error boundary that catches the same failure (recognizable by the server-error `digest` Next.js attaches) must not also emit `client_error`, or one failed render would double-count in error aggregates | FE server (SSR) |

### 1a. Envelope — field-level contract

Every event shares one envelope. Ownership: **S** = server-stamped
(authoritative, client value ignored), **B** = browser-asserted (validated,
see §5), **E** = emitter (browser for browser events, server for SSR events).

| Field | Req | Owner | Notes |
|---|---|---|---|
| `eventType` | ✅ | E | one of the six values (closed enum at ingest) |
| `origin` | ✅ | S | `browser` \| `server` — set from which ingest path the event arrived on, never from payload |
| `observedAt` | ✅ | E | when the emitter observed the fact (ISO-8601) |
| `receivedAt` | ✅ | S | server receipt time — authoritative for time-window queries |
| `clockSkew` | optional | S | stored-envelope flag: when `|observedAt − receivedAt|` > 10 minutes the server clamps `observedAt` to `receivedAt` and sets `clockSkew:true`; absent otherwise |
| `actor.userId` / `actor.role` | ✅ | S | from session. **Durable audit ingestion is gated on authentication existing** (§5) — there are no actor-less audit rows |
| `page.template` | ✅ | E | normalized template (`/target-sources/:id`), never a raw path, **canonicalized to a basePath-relative value** — the app mounts under `basePath:'/pass'` and browser tagging sees `/pass/...` in `location.pathname`, so the server strips the basePath before storage and `surfaceOf()` runs only on the canonical value (tests must use real `/pass/...` inputs). Browser events: from the wrapper's page tagging; SSR events: server self-stamps its own render target |
| `surface` | ✅ | S | derived server-side from `page.template` via `surfaceOf()` |
| `action.name` | per type | E | API function name (`startScan`) — required for `screen_read`/`action`/`action_result`, optional in error events, absent in `page_view` |
| `action.method` / `action.status` / `action.durationMs` | per type | E | HTTP facts of the observed call, where one exists |
| `job.kind` / `job.key` | async only | B | canonical async-job link: `{kind:'scan', key:scan_version}` / `{kind:'test_connection', key:test_connection_version}` (§2) |
| `correlation.requestId` | ✅ | E | forgery-harmless, correlation only |
| `correlation.targetSourceId` | ✅ on target-scoped variants | B/E | **required** whenever the event carries `job.*` (idempotency key needs it) or occurs on the target-detail page — ingest rejects such events without it; genuinely target-less events (`/services`-level) omit it. Browser-asserted values are validated against session access (§5); on server-origin SSR events the server render context self-stamps it |
| `correlation.serviceCode` | when known | S/B | when a target is present the server **derives it from the authorized target and ignores the client value**; on service-level events without a target the server validates the session user's membership in the claimed service (§5) |
| `domainContext.processStatus` / `domainContext.provider` | CSR events | B | snapshot of what the page held at event time |
| `outcome.*` / `error.*` / `detail.renderMs` | per type | E | the three type-specific blocks, **all top-level** (there is no wrapping `detail` object except `detail.renderMs` on `page_view`): `outcome.*` on `screen_read` (`outcome.count`) and `action_result` (§3, §4), `error.*` on failures, `detail.renderMs` on SSR `page_view` |

Per-type field matrix (normative — anything not listed as required/optional
for a type is **forbidden** on that type):

| eventType | Required beyond common¹ | Optional | Forbidden |
|---|---|---|---|
| `page_view` | `page.template`, `detail.renderMs` (SSR variant only) | — | `action.*`, `job.*`, `error.*`, `outcome.*` |
| `screen_read` | `action{name, method, status, durationMs}`, `outcome.count` | `domainContext` | `job.*`, `error.*` |
| `action` | `action{name, method, status}` (`status:0` is the no-response sentinel for network/timeout failures, paired with `error.code` `NETWORK`/`TIMEOUT`) | `error.code` (on failure), `job{kind, key}` (async trigger, when the response carries the key), `domainContext` | `outcome.*` |
| `action_result` | `action.name`, `job{kind, key}`, `outcome.status` | `outcome.durationSec` (omit when the source value or either timestamp is absent, invalid, negative, or reversed), `outcome.detail` / `outcome.total` / `outcome.fail` / `outcome.failedResourceIds` (per §4), `domainContext` | `error.*` |
| `client_error` | `error.name` | `action{name, method, status}` (when a call was involved), `error.code`, `error.zodIssues` (only when the error surface carries issue pairs — requires the capped ProblemDetails extension, plan 2b-8), `domainContext` | `job.*`, `outcome.*` |
| `ssr_error` | `page.template`, `error.name` | `action{name, method, status}` (the failed upstream call), `error.code`, `error.zodIssues` (schema validation runs on the FE server, so this is where issue pairs originate) | `job.*`, `outcome.*`, `domainContext` |

¹ Common required fields (`eventType`, `origin`, `observedAt`, `receivedAt`,
`actor`, `page.template`, `surface`, `correlation.requestId`) apply to every
type per the ownership table above; `clockSkew` is a common optional
server-stamped flag.

**One observation, one event.** A failed synchronous action (e.g.
`confirmInstallation` → 500) produces exactly one `action` event carrying the
failure status — never an additional `client_error`. `client_error` is for
failures outside a user action: render errors, unhandled rejections, and
failed reads observed by the browser.

The Phase 1-2 deliverable is the **discriminated union schema** transcribing
this matrix (one variant per `eventType`). Units: durations in ms except
where the upstream response provides seconds (`durationSec` mirrors
`duration_seconds` as-is and is labeled).

New pages, actions, or context keys extend the envelope additively; display
labels are a read-time dictionary (function name → Korean label), so old rows
never go stale.

### 2. Asynchronous actions: start + settle, no poll rows

- The trigger emits one `action` event with the accepted status and, when the
  trigger response carries it, the job key: `startScan` returns a full
  `ScanJobResponse`, so a key is available at trigger time. The local trigger
  record preserves **which field supplied the key** —
  `{kind:'scan', keyField:'scan_version'|'id', key:<value>}` (prefer
  `scan_version`, fall back to `id`) — and settle matching reads the **same
  field** from the poll payload, so a poll carrying both fields cannot
  mismatch. If neither field is present, the start event has no `job` and no
  settle will be emitted for it. Standardizing scan correlation on one
  guaranteed key is part of the Phase 1 contract discussion.
  **`triggerTestConnection` returns only `{success}`** — the start event has
  no job key today.
- **Settle emission requires a locally-proven job key.** The browser emits
  `action_result` only for a job key it recorded from its own trigger
  response. Until the test-connection trigger returns
  `test_connection_version` (a **Phase 1 negotiation item**), test-connection
  emits the unkeyed `action` start and **no settle event at all** — the admin
  timeline shows a start without a result, which is the honest state of the
  contract. Pairing by time window is forbidden (inference, wrong across
  tabs/users).
- The individual polling GETs are **not recorded**. When a poll observes a
  settled status (scan: `SUCCESS`/`FAIL`/`TIMEOUT`/`CANCELED`; test
  connection: `SUCCESS`/`FAIL` — `PENDING`/`RUNNING` are in-progress) for a
  locally-recorded job key, the browser emits one `action_result`. A status
  outside both sets is **not** a settle: no `action_result` is emitted and
  the value goes to the diagnostic log (the `UNKNOWN` normalization in §4
  applies to fields inside an emitted event, not to the settle decision).
- Both polling hooks also run on mount, so a browser can observe the settle
  of a job it did not start (another tab, another user); the local-key rule
  above excludes those. Additionally the ingest layer enforces an idempotency
  key `(targetSourceId, job.kind, job.key, eventType)` so duplicate settle
  observations collapse to one row.
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
| `screen_read` | `outcome.count` | non-negative integer |
| `action` (sync) | `action.status`, `error.code` | status = valid HTTP int, or `0` (no-response sentinel) **only when** paired with `error.code` `NETWORK`/`TIMEOUT`; `code` validated against the known BFF code set **plus the client-side codes** `NETWORK`/`TIMEOUT`/`UNKNOWN` (`lib/errors.ts` — these never come from the BFF), unknown → `UNKNOWN` |
| `action` (async trigger) | `action.status`, `error.code` (on failure — same status/code rules as the sync row, including the `status:0` + `NETWORK`/`TIMEOUT` sentinel), `job.key` (= `scan_version` or fallback `id`; test connection: none until the Phase 1 contract lands) | `job.key` = integer or string ≤ 64 chars |
| `action_result` (scan) | `outcome.status` (= `scan_status`), `outcome.durationSec`, `outcome.detail` (= `resource_count_by_resource_type`), `job.key` | status validated against the **exact settle set** `SUCCESS`/`FAIL`/`TIMEOUT`/`CANCELED`, unknown → `UNKNOWN`; detail = map with ≤ 20 keys, each key ≤ 32 chars (resource-type symbol), values non-negative int |
| `action_result` (test connection) | `outcome.status` (= `connection_status`), `outcome.total`, `outcome.fail`, `outcome.failedResourceIds`, `outcome.durationSec` (= `completed_at − requested_at`), `job.key` | status validated against the **exact settle set** `SUCCESS`/`FAIL` (`PENDING`/`RUNNING` never emit); `failedResourceIds` is a **bounded identifier array** (≤ 20 entries, each ≤ 64 chars) — an explicit exception to the "no list contents" rule because entries are domain identifiers, not payload data |
| `client_error` / `ssr_error` | `action.status`, `error.code`, `error.name`, `error.zodIssues[{path, code}]` | `error.name` matched against a fixed allowlist of known error classes, else `Error`; `zodIssues` ≤ 20 entries, `path` ≤ 128 chars, `code` validated against the closed Zod issue-code set (`invalid_type`, `invalid_enum_value`, `too_small`, `too_big`, `invalid_string`, `custom`, …complete set in the schema), unknown → `custom`, no messages |
| `page_view` | `detail.renderMs` | non-negative integer |

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
           identity is never adopted); stamps receivedAt, origin, surface,
           and clockSkew (only after its own clamping decision — any
           client-sent clockSkew is ignored);
           verifies the session user is authorized for the claimed
           correlation.targetSourceId (reusing the domain access check) and
           rejects the event otherwise; derives serviceCode from the
           authorized target (ignoring the client value) or, for
           target-less events, validates service membership; forwards to BFF ingest (best-effort,
           drop counter). SSR events (page_view, ssr_error) are built
           directly on the server, which self-stamps the rendered page
           template (there is no X-Client-Page during SSR).
BFF      — stores structured fields only; enforces the §2 idempotency key
```

The **ingest schema and the stored schema are distinct**: the ingest schema
is what the browser may claim (no `actor`, no `origin`, no `receivedAt`,
no `surface`, no `clockSkew`); the stored schema adds the server-stamped
fields. The two ingress paths accept **different unions**: browser ingress
accepts only browser-originated variants (`screen_read`, `action`,
`action_result`, `client_error`, and the browser `page_view` — which has no
`detail.renderMs`); the server-only variants (`ssr_error`, the SSR
`page_view` with `renderMs`) are constructed in-process by the FE server and
are **rejected on browser ingress**, so no impossible type/origin
combination can be stored. Browser
events are therefore *authenticated assertions*: identity, time-of-record,
origin, and target authorization are server-verified, while observation
content (outcome, detail) is accepted as-is — the server cannot see what the
browser saw. Residual forgery is bounded: a logged-in user can only write
events against targets they are authorized for, every row carries their
server-stamped identity, and rows carry `origin` so operational aggregates
can be filtered or weighted by provenance if abuse is ever suspected.

**Two sinks, one logger.** `log.ts` exposes two explicit paths:
`emitAudit` (the six types + the future `auth_denied`) goes to BFF ingest;
`emitDiagnostic` (withV1 access records, route-handler exceptions, upstream
5xx diagnostics, sanitized stacks) goes to stdout only and is **never**
stored as an audit row. The transport swap (implementation-plan Phase 2)
changes where `emitAudit` delivers; diagnostic records keep their stdout
destination.

**Authentication gate.** Both the actor stamp and the target-authorization
check require a session, so **durable audit ingestion and admin exposure are
enabled only after authentication ships** (implementation-plan Phase 3).
Before that, the emission code paths can be built and exercised in
staging/mock, but production events are not durably stored — there is no
actor-less audit data and no placeholder-guarded admin.

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
  (trigger returns the job key) is negotiated instead; until then no settle
  is emitted and the start row stands alone.
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
- Gaps are honest: rows without results exist (closed browsers, and
  test-connection starts without settles until the trigger contract lands),
  nothing is durably stored before authentication ships, and — since the
  per-type matrix requires `error.name` on error events — **storing
  `error.name` is adopted by this ADR**; only `fingerprint` (sanitized-stack
  hash) storage remains an open decision in the strategy document, and
  without it code-less errors sharing one `error.name` are not further
  distinguishable in the DB.

## References

- Strategy: `docs/feature/observability-strategy-overview.md`
- Implementation plan: `docs/feature/observability-implementation-plan.md`
- Collection layer: PR #558 (`docs/feature/observability-plan.md`)
- Mockup: `docs/feature/observability-admin-audit-mockup.html`
