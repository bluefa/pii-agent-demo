# Ops Console — Assumed Contracts (no backing in install-v1.yaml)

Capabilities with **no endpoint in `docs/swagger/install-v1.yaml`**: §1–§5 and §9 on the
Target Source ops page (`/admin/pipelines/ops/target-sources/{id}`), and §8 on the
service-owner list (`/services`). They are implemented mock-first behind Next.js routes
with the shapes below. When the BFF ships real endpoints, replace the mock handlers and
delete the corresponding section here. §9 is the one section whose endpoints already exist
upstream — what it waits for is the declaration, so it goes when install-v1.yaml names it.

Conventions follow install-v1: snake_case wire, Spring `Page` for pagination,
`ErrorMessage` problem responses.

Sections §6 (서비스 운영) and §7 (운영 알림) are no longer assumed — both now run on
declared endpoints. They are kept as a record of what was withdrawn and why, so the
same shapes are not re-invented. §1–§5 **and §8** are still assumed and still 404 against
the real BFF — §8 is the only one whose caller is a service owner rather than an operator,
so its failure copy does not promise that a retry will work. §9 is a third case: undeclared
here but confirmed as implemented upstream, so its copy may invite a retry.

## 1. Status change history

The 상태 변경 이력 card. `process-status` only returns the *current* snapshot; there is
no transition log.

```
GET /install/v1/target-sources/{targetSourceId}/status-history?page={0}&size={10}
→ 200 Page<StatusHistoryItem>

StatusHistoryItem {
  changed_at:   string (date-time)
  from_status:  BffProcessStatus | null   // null for the initial entry
  to_status:    BffProcessStatus          // IDLE|PENDING|CONFIRMING|CONFIRMED|INSTALLED|CONNECTED|COMPLETED
  actor:        string                    // user id, or "system"
}
```

## 2. Installation mode update

Read side is covered by `GET /target-sources/{id}` →
`metadata.grant_service_terraform_execution_permission`. There is no writer.

```
PUT /install/v1/target-sources/{targetSourceId}/installation-mode
body     { grant_service_terraform_execution_permission: boolean }
→        no response body                      // owner, 2026-09-07: upstream returns void
```

The write is judged by HTTP status alone, never by a body. This section used to declare
`200 { target_source_id, grant_service_terraform_execution_permission }`; nothing upstream
ever sent it, and reading it turned a landed write into 「변경에 실패했습니다」. Every layer
tolerates both bodyless shapes (204, or a 200 with an empty body), so which one upstream
picks does not matter. The dialog keeps the value it just sent — there is nothing to read
back, and nothing to re-read.

## 3. AWS role registration / update — GRADUATED to the real contract

The real endpoints landed in install-v1.yaml (2026-08-08 swagger v5), replacing this
section's assumed shape. This entry stays as a tombstone so old references resolve:

```
PUT /install/v1/target-sources/{targetSourceId}/aws/scan-role
PUT /install/v1/target-sources/{targetSourceId}/aws/terraform-execution-role   // NOT …/aws/execution-role
body     AwsAssumeRoleUpsertRequest  { roleArn }                    // FULL ARN, camel wire
→ 200   AwsAssumeRoleUpsertResponse { targetSourceId, roleArn, readOnly }
```

Differences from the assumed shape: the client sends the full ARN (the edit modal still
collects the name only and composes account + partition + name), the wire is camelCase,
and the execution-role path segment is `terraform-execution-role`. The current role
values are also readable from `TargetSourceMetadata.aws_scan_role_arn` /
`aws_terraform_execution_role_arn`.

Saving a role resets its verification verdict (next verify GET starts from IN_PROGRESS);
a stale "verified" state must not survive an ARN change.

## 4. Collaboration channel — REINSTATED by BE PR #8891 (ahead of the swagger drop)

The withdrawal note of 2026-08-10 is superseded. After 인프라 등록 the BFF asks
jira-manager to create a Jira ticket asynchronously (retries every 10 minutes, gives up
after 6). The Jira Ticket console (`/admin/pipelines/ops/jira`) reads that state per
target and lets an admin link an existing issue key when auto-creation could not.
Tickets are one per (serviceCode, cloudProvider); SDU targets are their own unit.

Not in `docs/swagger/install-v1.yaml` yet — every field below is read as optional and
absence renders as "조회 실패" / "티켓 없음", never as a made-up state. `npm run
contract-check` is expected to FAIL on these paths until the swagger drop lands.

```
GET /install/v1/target-sources/{targetSourceId}/collaboration-channel
→ 200 always
{
  "issue_key": "BDCDIP-1234",          // "" for PENDING/RETRYING/FAILED, null for NONE
  "url": "https://jira…/browse/…",     // null when there is no ticket
  "status": "CREATED",                 // CREATED | PENDING | RETRYING | FAILED | NONE
  "attempt_count": 3,                  // may be 0 on RETRYING (auth problems) → hide the count
  "max_attempts": 6,
  "next_attempt_at": "2026-09-30T14:20:00.123456"   // server-local, fractional seconds, NO offset
}

PUT /install/v1/target-sources/{targetSourceId}/collaboration-channel
{ "issue_key": "BDCDIP-1234", "url": "https://…" }   // url optional; issue_key required
→ 200 same shape, status CREATED
→ 400 issue_key empty
→ 409 JIRA_TICKET_CREATION_IN_PROGRESS   // auto-creation is writing this ticket right now
→ 409 (any other code)                   // someone else linked first — re-read and show it
```

| status | Meaning | "has a ticket" |
|---|---|---|
| `CREATED` | A ticket is linked (auto or by hand). | yes (`!!issue_key`) |
| `PENDING` | First creation attempt not made yet. | no |
| `RETRYING` | A previous attempt failed; the next runs at `next_attempt_at`. | no |
| `FAILED` | All `max_attempts` attempts failed; an admin links a ticket. | no |
| `NONE` | Nothing was ever requested for this target. | no |

- `next_attempt_at` carries no offset. The screen prints `HH:mm` by cutting the string —
  it MUST NOT be parsed as UTC (see `lib/types/collaboration-channel.ts`).
- Linking applies to every target source of the same (service, cloud): the PUT on one
  row clears the whole unit from the `jira-ticket-failed` list on the next read.
- The 운영 화면 header (`OpsHeader.tsx`) is unchanged and keeps reading the real
  `GET …/jira-ticket`; this pair is the console's, not the header's.
- Route: `app/api/v1/target-sources/[targetSourceId]/collaboration-channel/route.ts`
  (GET / PUT). BFF: `bff.ops.getCollaborationChannel` / `putCollaborationChannel`.
  Mock: `lib/bff/mock/ops.ts` (`__opsCollaborationChannelStore`; the key `BDCDIP-409`
  answers the in-progress 409 on purpose).

## 5. Ops target-source list

Powers the Target Source 운영 index list. `process_status` uses the 7-step wire enum
from `process-status`; `last_changed_at` is the latest status-transition timestamp.

```
GET /install/v1/admin/ops/target-sources?query={q}&page={n}&size={n}
→ 200   Spring Page<{
          target_source_id: number,
          service_code: string,
          service_name: string,
          description: string | null,    // = TargetSourceInfo.description (install-v1)
          cloud_provider: string,        // AWS | GCP | AZURE | IDC
          is_sdu_type: boolean,
          database_type: string | null,
          process_status: IDLE|PENDING|CONFIRMING|CONFIRMED|INSTALLED|CONNECTED|COMPLETED,
          last_changed_at: ISO-8601,
          metadata: {                    // CSP account identifiers
            aws_account_id:  string | null,
            aws_region_type: "global" | "china" | null,
            subscription_id: string | null,   // Azure
            gcp_project_id:  string | null,
          },
        }>
// query matches target_source_id / service_code / service_name (contains).
// metadata: only the owning provider's field is populated. IDC and SDU targets
// have no CSP account at all — every field is null and the list renders nothing.
```

## 6. Service operations — WITHDRAWN, rebuilt on real contracts

The assumed `GET /admin/ops/services`, `GET /admin/ops/services/{code}` and
`POST /admin/ops/services/{code}/eos` are gone with their routes, mocks and wire
types. They were never declared in install-v1.yaml, so against the real BFF every
call 404'd and 서비스 운영 showed only "서비스 목록을 불러오지 못했습니다" — the
mock hid the gap because the mock adapter answered paths the upstream never had.

서비스 운영 now composes declared endpoints only:

| Screen part | Real contract |
|---|---|
| 서비스 레일 (목록·검색·페이징) | `GET /install/v1/user/services/page?page&size&query` → `PageServiceItem` |
| 상세의 Target Source 행 + CSP 계정 | `GET /install/v1/target-sources/page?serviceCode&page&size` → `PageTargetSourceInfo` |
| Jira Ticket 연결 | `GET·PUT·DELETE /install/v1/services/{serviceCode}/jira-tickets[/{cloudProvider}]` (unchanged, `docs/api/jira-tickets.md` §1) |

Two endpoints, no join. `serviceCode` is a declared query param on
`/target-sources/page`, and that one response carries every field the detail draws.

### 설치 진행 단계는 이 화면에 없다 (owner's call)

An earlier revision showed a per-target step pill and a "현재 단계" filter here, fed by
a `/process-statuses` aggregate. Both were removed on the owner's call, and the
aggregate went with them.

Anyone re-adding a step here should know the cost first.
`TargetSourceInfo.confirmStatus` is the *confirm* sub-state enum
(`IDLE|PENDING|UNAVAILABLE|CONFIRMING|RESOURCE_CLEANING|RESOURCE_CLEAN_FAILED|CONFIRMED`),
NOT the 7-step lifecycle `StepPill` renders — only `/process-statuses` carries that,
and it has no `serviceCode` filter (`processStatus` / `targetSourceId` only). Serving
one service therefore means paging the whole table on every detail view. Per-target
step already lives on the Target Source 운영 screen, one click from each card.

`OpsServiceTargetRow` (`app/lib/api/ops.ts`) is deliberately separate from
`OpsTargetSourceListItem` for this reason: §5's list still renders a step, and sharing
one type would force this screen to fetch a field it does not show.

### What no declared endpoint carries

- **`owner`** — no such field anywhere in install-v1.yaml. Dropped from the screen.
  `GET /services/{serviceCode}/authorized-users` returns *authorized users*, which is
  a different thing; do not substitute it for 담당자 without a product decision.
- **EOS processing (write)** — read-only `is_eos_service` / `isEosService` exist
  (`TargetSourceServiceInfoResponse`, `ServiceInfoRefinedResponse`); there is no
  writer. The EOS 처리 button and its modal were removed rather than left as a
  control that cannot fire.
- **EOS display** — the flag rides only on a target's `service_info`, reachable via
  `/process-statuses` (global, no serviceCode filter) or `GET /target-sources?serviceCode=`
  (declared, service-scoped, returns `TargetSourceResponse[]`). The 단계 removal took
  the `/process-statuses` call with it, so the header badge is gone too. Re-adding it
  means wiring the service-scoped `GET /target-sources?serviceCode=` — one extra round
  trip, not a global aggregate. `ServiceItem` is `{service_code, service_name}` only,
  so the rail can never show it without such a call.
- **`database_type`** — absent from both `TargetSourceInfo` and
  `TargetSourceResponse`. The ops card never rendered it, so nothing was lost.

Re-adding any of these needs a real contract, not a client-side derivation.

## 7. Ops alerts (운영 알림) — SHIPPED, no longer assumed

Superseded by the real contract. 운영 알림 now runs on `GET /install/v1/dashboard/summary`
(`confirming_count` / `need_install_count` / `need_test_connection_count` /
`need_pii_agent_confirm_count`) plus the four sibling drill-downs
`GET /install/v1/dashboard/target-sources/{confirming|need-install|need-test-connection|need-pii-agent-confirm}`,
all declared in `docs/swagger/install-v1.yaml`.

The assumed `GET /admin/ops/alerts` aggregation was removed with its route, mock and
wire types. Three kinds it carried have no upstream equivalent: `PENDING` (still served
by `pending_approval_count` on the 연동 요청 menu), `TC_REJECTED`, and `STALE` (장기 정체).
Elapsed time is likewise gone — `TargetSourceInfo` carries no per-row "last changed"
field. Re-adding any of them needs a real contract, not a client-side derivation.

### Invariant: a Test Connection queue row is always a target source

`GET /admin/queue/test-connections` returns rows keyed by `target_source_id`. Every such
id MUST resolve at `GET /target-sources/{id}`, because 운영 알림 links Test Connection
alerts to that target's 운영 화면 (`?tab=tc`) — the only place the Test Connection
detail lives. A queue row without a target source is a dangling reference, and the mock
is built to make that unrepresentable: the queue's demo targets are seeded as real
projects in `lib/mock-data.ts`, not as a side fixture.

## 8. Target Source description update

The only assumed section whose consumer is NOT the ops console: the writer is the ⋮ menu
on the service-owner screen `/pass/services?service_code={code}`. It lives here because
this file is where "endpoints install-v1.yaml does not declare yet" are recorded, and a
second such file would just split that list in two.

Read side is `TargetSourceDetail.description` (and `TargetSourceInfo.description`), which
three screens already draw. There was no writer, so a description could be shown and never
corrected.

```
PUT /install/v1/target-sources/{targetSourceId}/description
body     { description: string }              // "" is valid — it clears the description
                                              // maxLength 1000
→ 2xx                                         // no response body is read — see below
```

The client reads nothing off the response: it reloads the list it already draws the row
from, so the row and the dialog cannot disagree.

Because nothing is read, **success is judged by status alone** (2026-08-20). The earlier
draft declared a `{ target_source_id, description }` echo and parsed it on both hops; since
the endpoint is unbuilt, that shape was ours, not the owner's, and an upstream answering
204 — or 200 with an empty body — would have failed `JSON.parse` and reported a *saved*
edit as an error. The BFF client now passes `emptyBodyOk` (as §9 does) and the internal
route answers `204` with no body of its own. The failure half is unchanged: non-2xx still
parses the upstream body for its code and message.

`maxLength` 1000 is the owner's, not this screen's (2026-08-18) — the first draft enforced
no cap precisely because the contract declared none, and that premise is now gone. It is
stated twice, as every other 1,000-char field in this repo is: `maxLength` + a counter on
the textarea (`DescriptionEditModal`, the shape `ConfirmRewindModal` uses), and an
independent `VALIDATION_FAILED` guard on the route. The route measures the string it
receives, before any trim — the dialog's trim is an editorial choice, not the contract's.

## 9. Target Source 실데이터 여부 write

```
PUT /install/v1/target-sources/{targetSourceId}/support-raw-data/enabled
PUT /install/v1/target-sources/{targetSourceId}/support-raw-data/disabled
body     none                                   // the value is the path, not a payload
→        no declared response body
404      TargetSourceNotFoundException (raised by infra, relayed by self-installation-tool)
```

Unlike §1–§5 and §8, these two are **implemented upstream** — they are only missing from
`install-v1.yaml`, so a failure here is not the permanent 404 an unbuilt endpoint gives.
The dialog's failure copy may invite a retry (§8's may not; see the note below it).

The segment was `does-support-raw` until 2026-08-18, when the owner corrected it to
`support-raw-data` — the same vocabulary the read field (`supportRawData`) uses. Only the
two upstream URLs moved: the internal route path and the writer's function names still
carry the old wording, and are the remaining follow-up.

Both endpoints still carry a BE TODO for an Admin-only permission annotation. Nothing on
the client stands in for it: the only caller is the ops console, which is already behind
the ADMIN gate, and a client-side check would state an authorisation rule the server has
not made yet.

The internal route folds the pair into one boolean — `PUT /pass/api/v1/target-sources/{id}/
does-support-raw { enabled: boolean }`. Two paths are one value written two ways, and the
path encoding is the upstream's representation of it, applied in `lib/bff/http.ts` where
every other upstream path shape is decided. Nothing is read back from either hop: on
success the header keeps the value the operator picked (one piece of local state, the same
shape 설치 모드 uses), and the next detail load is what re-reads it.

## The field the tags read: `supportRawData`

`install-v1.yaml` **does** declare this field — as `supportRawData: boolean` on
`TargetSourceResponse` (`GET /install/v1/target-sources`) and on
`TargetSourceMetadataResponse` — the `target_source` of `GET /install/v1/process-statuses`
and `/process-status-history` (**not** the singular `…/{id}/process-status`, which returns
`ProcessStatusResponseDto` and carries no target source) — and as the `supportRawData`
query filter on both target-source list endpoints. It is the
contract's own name for the fact, and the only spelling the **read** path uses for it. The
write path is a separate matter — see the carve-out below.

What is *not* declared is the field on the two responses these screens actually read:
`TargetSourceDetail` (`GET …/target-sources/{id}`, the ops header) and `TargetSourceInfo`
(`PageTargetSourceInfo`, the service-ops card). So it is read through `readSupportRawData`
(`lib/types.ts`) rather than off a declared property, using the fact that the generated
schemas are `.partial().passthrough()`: an undeclared key survives `parse()` and reaches
the consumer.

Two ways out, and the cheap-looking one is not the only one:

1. Ask BE to declare `supportRawData` on those two DTOs as well. The name needs no
   negotiation — it is already the contract's, on the sibling responses.
2. Read it off a response that already declares it. `GET /install/v1/process-statuses`
   takes a `targetSourceId` filter and returns `TargetSourceMetadataResponse`, so the ops
   header could take the fact off a zod-typed property instead of through passthrough — a
   typo would become a compile error. The call is already wired (`lib/bff/http.ts`, the
   mock adapter, an internal route); what it needs is the field kept in
   `toProcessStatusRow`, and the mock's `toProcessWire` joined to the project store so
   §9's writer stays visible. The service-ops card is **not** cheap this way: the declared
   `GET /target-sources?serviceCode=` carries no `metadata`, and the card draws the CSP
   account identifiers and `is_china_region` from it — so it is a join against the existing
   `/target-sources/page` call, not a swap.

The `실데이터` tag on `/pass/admin/pipelines/ops/services/{code}` and the 실데이터 chip in
the header of `/pass/admin/pipelines/ops/target-sources/{id}` are keyed to it.

### The unresolved half: what #721 recorded

#721 read this value under the key `doesSupportRaw`, and recorded that spelling as a BE
answer about the TargetSource **read** — not as a guess. Nothing in either yaml declares
it, and this repo no longer reads it; but that answer is still the only statement anyone
has made about what the BFF actually serialises on `TargetSourceDetail`, and the contract
cannot arbitrate because it declares neither spelling on that response.

One piece of evidence does lean, and it is worth naming: `install-v1.yaml:6829` declares
`supportRawData` as a **query filter on `/install/v1/target-sources/page`** — the exact
operation the service-ops card pages through. A filter is named for the field it filters,
on the same operation, so the response of that call is the one place where the two
spellings are hardest to reconcile. It is a strong hint, not a declaration.

Do not read the yaml's silence as evidence either way. The newest upstream dump is
byte-identical to `install-v1.yaml` but also contains **neither** `PUT …/support-raw-data/…`
**nor** `PUT …/description`, and §9 and §8 record both as shipped upstream. This contract
under-reports what the server actually serves, which is the whole reason this file exists.

So the conflict is recorded here rather than erased. It takes one live
`GET /install/v1/target-sources/{id}` to settle:

- the response carries `supportRawData` → the BE answer was a mis-transcription, and this
  note's opening paragraph is the whole story;
- the response carries `doesSupportRaw` → the BE answer was right, the read is broken, and
  the fix is BE renaming its field to the name the contract already publishes. The symptom
  is silent: 미확인 on every target in the ops header and no 실데이터 tag on any card, with
  the suite still green (the mocks emit whatever the reader reads).

Whichever way it settles, the value keeps **one** name — two names for one fact means no
screen can say which one the server actually sent. The write path used to be the deliberate
exception (`does-support-raw` is a URL, not a field name); as of 2026-08-18 its upstream
segment is `support-raw-data` too (§9), so the read field and the written path now agree.
What still lags is our own naming — `updateTargetSourceDoesSupportRaw` and the internal
route path — which no server sees.

The reader returns three states — `true` / `false` / `undefined` (not a boolean on the
wire, or absent). The two surfaces fold them differently, and on purpose:

- The service card draws a tag only on `=== true`. A tag has no "off" shape.
- The ops header always draws the chip, because it is also the control that changes the
  value: 포함 / 미포함 / 미확인. Writing 미포함 for a value we could not read would have
  the screen assert something it never received.

## The field the lifecycle tags read: `installationLifecycleStatus`

`install-v1.yaml` does **not** declare this field on any response. The spellings, values
and endpoints below are the owner's description of what the BFF sends (2026-09-28); no
live response has been captured in this repo yet.

| DTO | Key | Endpoints |
|---|---|---|
| `TargetSourceInfo`, `TargetSourceResponse` | `installationLifecycleStatus` (camel) | `GET /target-sources`, `GET /target-sources/page`, `POST /target-sources/services/{serviceCode}/target-sources`, `GET /dashboard/target-sources/{confirming,need-install,need-test-connection,need-pii-agent-confirm,recent}` |
| `TargetSourceDetail` | `installation_lifecycle_status` (snake) | `GET /target-sources/{targetSourceId}`, `GET /target-sources/services/{serviceCode}` |

| Value | BFF rule | Screen name |
|---|---|---|
| `INITIAL_INSTALLATION` | neither `pii_agent_first_installed_at` nor `pii_agent_installed_at` | 최초 연동 |
| `REINSTALLATION` | first-installed set, `pii_agent_installed_at` not set — the integration was modified or is being reinstalled, after a reset to step 1 | 연동 내용 변경 |
| `INTEGRATION_COMPLETED` | `pii_agent_installed_at` set — step 7 done, admin approved | 연동 완료 |

It is read the way `supportRawData` is: the generated schemas are `.partial().passthrough()`,
so the key survives `parse()`. `parseInstallationLifecycle` (`lib/types.ts`) validates the
value; each call site reads the **one** spelling its DTO uses. A missing or unknown value
draws nothing (a tag) or `—` (a table cell).

Screens keyed to it: the service-ops card, the ops target-source header, the 운영 알림
table, the 연동 요청 lists (승인 대기 · 반려 미확인 · 최근 생성) and the request detail
header. 전체 이력 is not: `GET /approval-history` does not carry the field.

Two things to settle:

1. Ask BE to declare the field in the swagger. Until then `contract-check` fails on any
   change that touches these readers.
2. Capture one live response per DTO. A wrong spelling is silent — no tag anywhere, suite
   green — because the mock emits whatever the readers read.

## 10. DAG weekly health status (관리자 승인 gate)

DRAFT CONTRACT — transcribed verbatim from the owner's sketch (2026-08-19), not yet in
any swagger yaml. The 관리자 승인 tab reads it as one of THREE approval conditions gating
PII Agent 설치 완료 — ① the service acknowledged Test Connection, ② the latest Test
Connection run is `SUCCESS`, ③ `healthStatus === 'HEALTHY'`. All three are allowlists:
loading, fetch failure, and unknown enum values lock rather than pass.

The same response also feeds the **Airflow 확인** tab (`?tab=airflow`), which owns the
weekly board, the agent table, and the DAG detail modal. The page owns the fetch and
hands the result to both tabs, so switching between them does not re-request §10.

A single target's response reaches MB scale (10k 논리 DB rows, BE open issue below).
Two readers ask for it, on different rules:

- **The client page** (`OpsTargetView`) asks when a tab that reads it is open — the
  관리자 승인 tab (조건 ③ gates on it) or the Airflow 확인 tab — for every target type.
  It used to wait for 완료 승인 (조건 ①) to keep an MB response nobody reads off the
  wire; that premise expired with the card below, so 조건 ③ now judges health on its
  own instead of waiting on ①. It hands the one result to both tabs, so switching
  between them does not re-request.
- **The 연동 현황 card** (`status/StatusCard.tsx`, Server Component) asks **on every
  render, at every step** — owner call 2026-08-30 ("6단계 상관없이 그냥 조회해"), which
  reversed the step gate that row used to sit behind. Its Airflow row prints whatever
  came back rather than a position in the process.

So a page load on the 관리자 승인 or Airflow 확인 tab fetches §10 **twice** — once
server-side for the card, once client-side for that tab — through different transports and with nothing
deduping them. That is the accepted cost of the owner call. It collapses when the
screen's `detail` moves to the server and the client stops fetching (see PR #832
"Known follow-up"), or when BE bounds the response (open issue below).

```
GET /install/v1/target-sources/{targetSourceId}/dag-status
→ 200 DagStatusResponse

DagStatusResponse {
  targetSourceId:    number
  connectionStatus:  TestConnectionStatus       // monitoring's own reading — NOT the TC tab's source
  healthStatus:      "HEALTHY" | "UNHEALTHY"    // read tolerantly as string; UI gates by allowlist
  timezone:          "KST"
  agents: [{
    agentId:           string                   // assumed string — sketch does not type it
    resourceId:        string
    gcpRegion:         string | null             // GCP vocabulary; other-CSP variant unresolved (open Q).
                                                 // The sketch types it non-null; we read it nullable and
                                                 // render — when it is absent, since an AWS/Azure agent
                                                 // has no GCP region to give. Read-side widening, not a
                                                 // contract change.
    connectionStatus:  TestConnectionStatus
    databaseStatuses: [{
      databaseUri:        string                // row identity; can exceed 1,500 per target
      databaseName:       string | null         // null until Infra Manager redeploy
      schemaName:         string | null
      dagName:            string | null
      namespace:          string | null
      succeededThisWeek:  boolean
      lastSuccessAt:      string | null
      days: [{                                  // exactly 7, KST buckets
        day:         string                     // YYYY-MM-DD
        status:      "SUCCESS" | "RUNNING" | "FAILED" | "NOT_SCHEDULED"
        successTime: string | null              // only on SUCCESS days
      }]
      latestTableCount:   number | null         // tables read by the most recent SUCCESS run (added 2026-09-28);
                                                // null = no successful run yet (dash), 0 = read zero tables (0)
    }]
    latestTableCountSum: number                 // Σ databaseStatuses[].latestTableCount (BE-computed)
  }]
  latestTableCountSum:  number                  // Σ agents[].latestTableCountSum (BE-computed)
}
```

**2026-09-28 (owner sample):** three `latestTableCount*` fields joined the response. The
Airflow 확인 tab prints the target-level sum in its count row, the agent-level sum as
a column of the agent table, and the per-DB count as a column of the weekly board; the
sums are BE-computed, so the FE never re-adds them.

One deliberate deviation from this doc's conventions, because the sketch is the closest
thing to the contract: the wire is **camelCase verbatim** (not snake), so `lib/bff/http.ts`
fetches it with `raw` — there is no case boundary on this path.

**Path corrected 2026-08-20 (owner).** The original sketch read
`GET /install/monitoring/dag-status/target-sources/{targetSourceId}` and was transcribed
verbatim, which is why the client carried a hand-rolled fetch outside `toUpstreamInfraApiPath`.
The real path is the standard `/install/v1` base nested under its target source, like every
sibling on this page, so that special case is gone.

Open questions for BE before this graduates (asked 2026-08-19):
- response paging — the sketch has no page params, but a 10k-row target measured ~10MB
  in the backend design (PR #707); single-response + client pagination until answered
- the `healthStatus` formula (UI copy stops at "최근 7일 DAG 실행 기준" until then)
- the region field name for non-GCP agents (`gcpRegion` is the only one sketched)
- whether `connectionStatus` here and the TC tab's status can disagree, and which wins

## 11. Airflow DAG address (pipeline-manager)

DRAFT CONTRACT — owner sketch (2026-08-20), not yet in any swagger yaml. One 논리 DB's
DAG address, so the weekly board's DAG cell can open the DAG in Airflow. The board reads
it per row, on demand — it is not part of the §10 response.

```
GET /install/v1/pipeline-manager/airflow-host?databaseUri={databaseUri}
→ 200 string   // the DAG's own URL, ready to navigate to (owner, 2026-08-20:
               //   a full address, NOT just the Airflow host)
```

- `databaseUri` carries `://` and `/`, so it MUST be URL-encoded into the query.
- The body is a single string, not an object — no case boundary applies to it. **It arrives
  in either of two shapes** and the adapter accepts both (`parseAirflowHostBody`,
  `lib/bff/http.ts`): `"https://…"` (JSON string) or `https://…` (text/plain — what
  Spring's `StringHttpMessageConverter` produces for a `String` return value). Reading the
  body with `res.json()` throws on the second shape, and the screen then shows
  "주소를 확인하지 못했어요" + 다시 시도 — a parse failure wearing the mask of a failed lookup. The request
  sends `Accept: */*` for the same reason: a text/plain endpoint must not 406 on us.
- The address is rendered as an `<a href>`, so the adapter passes only `http(s)://` values
  through; anything else (an HTML error page served with 200, a `javascript:` scheme) folds
  to the same empty landing as "no address".
- The address is not always obtainable. The screen splits the cases: an empty body is
  "Airflow 주소가 없어요" (or "DAG가 아직 생성되지 않았어요" when the row's `dagName` is null
  too), and a fetch failure is "주소를 확인하지 못했어요". Only the fetch failure offers 다시 시도,
  because retrying an answer the upstream already gave changes nothing.

Open questions for BE (asked 2026-08-20):
- a missing address: 200 with `""`/`null`, or 404? **The answer changes the screen.** A 200
  with an empty body lands on 확인 불가 with no retry; a 404 throws and lands on the failure
  branch, which mounts 다시 시도 — the CTA this section says an absent address must not get.
  If BE answers 404, the modal needs a 404 arm that folds into the empty landing.
- does this path share dag-status' auth, or the standard `/install/v1` one?

## 12. Jira failure lists and summary counts (BE PR #8891, ahead of the swagger drop)

Two more kinds on the 운영 알림 drill-down path family, admin only (403 otherwise), same
`Page<TargetSourceInfo>` envelope as the four shipped kinds:

```
GET /install/v1/dashboard/target-sources/jira-ticket-failed?page&size
GET /install/v1/dashboard/target-sources/jira-watcher-failed?page&size
```

The rows carry NO ticket status — the console GETs §4 once per row (≤10 per page;
`// ponytail` in `JiraWorklistSection.tsx`, to be replaced by list fields if the BE adds
them to the DTO).

**OWNER ASSUMPTION — unconfirmed.** Each `jira-watcher-failed` row also carries:

```
"failed_watchers": [ { "username": "hong.gildong", "status": "FAILED", "attempt_count": 6 } ]
```

It rides the schema's `.passthrough()`; the reader treats it as optional (absent → the
modal says "추가할 사용자를 응답에서 읽지 못했어요.") and drops entries without a string
`username`.

`GET /install/v1/dashboard/summary` gains two counts, also read off the passthrough:

```
"jira_ticket_failed_count": 4,
"jira_watcher_failed_count": 2
```

They feed the `Jira Ticket` sidebar badge (their sum) and the console's tiles. They are
NOT added to the 운영 알림 badge or page. An absent count is null (unknown) on the console
and 0 in `toDashboardSummary`.

Consumers: `lib/types/task-queue.ts` (`JIRA_ALERT_KINDS`, `toJiraListPage`,
`toDashboardSummary`), mock `lib/bff/mock/task-queue.ts` (fixtures in
`lib/bff/mock/ops.ts`).

## Mock implementation

Sections §1–§5 are served by `app/api/v1/…` route handlers backed by globalThis-guarded
in-memory stores in `lib/bff/mock/ops.ts` (`__opsConsoleMockStore` for per-target
state, `__opsConsoleServiceStore` for §6), same pattern as the admin queue mocks. §8 and
§9 write to the shared project store instead (`lib/bff/mock/target-sources.ts` →
`updateProject`), because both edit a field every screen already reads off the target.
Handlers are marked `// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md`.
