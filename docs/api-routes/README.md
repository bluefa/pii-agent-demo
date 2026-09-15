# Route handler index — Admin Task Queue (`/admin/queue/**`)

Scope: the route handlers that serve the **Admin Task Queue** screens
(`app/admin/pipelines/queue/**`). Other route families are not listed here yet; add a
sibling file rather than widening this one, so a family's rows and its screens stay
together.

Every row below is hop 1 of the two-hop path in `docs/api/boundaries.md`:

```
CSR (@/app/lib/api/*) → app/api/v1/admin/queue/**/route.ts → bff.taskQueue.* → upstream /install/v1
```

Internal paths are prefixed with `/pass/api/v1` at the browser (`lib/infra-api.ts`); the
tables use the path as the route file spells it.

## Routes

| Route | Upstream | BFF method | Wire → domain |
|---|---|---|---|
| `GET /admin/queue/dashboard-summary` | `/dashboard/summary` | `getDashboardSummary` | `toDashboardSummary` |
| `GET /admin/queue/process-statuses` | `/process-statuses` | `getProcessStatuses` | `toProcessStatusPage` |
| `GET /admin/queue/target-sources` | `/target-sources/page` | `getTargetSourcesPage` | `toRequestListPage` |
| `GET /admin/queue/approval-history` | `/approval-history` | `getApprovalHistory` | `toApprovalHistoryPage` |
| `GET /admin/queue/test-connections` | `/target-sources/test-connection/status` | `getTestConnectionPage` | `toTestConnectionStatusPage` |
| `GET /admin/queue/integration-timeline` | `/admin/target-sources/integration-timeline` | `getIntegrationTimeline` · `getIntegrationTimelineCsv` | `toIntegrationTimelinePage` |

Every reshaper lives in `lib/types/task-queue.ts`: these routes own the wire→camel
boundary for this feature, and the CSR layer consumes the camel domain unchanged.

Routes that apply a rule the upstream contract does not declare:

- `process-statuses` owns the **delay** filter (`?delay=d1|d2|d3`). The upstream has no
  such parameter, so the route aggregates upstream pages and re-paginates (gap G1).
- `test-connections` rejects any `status` outside the two queue tabs the contract allows.
- `integration-timeline` owns the whole query contract — see below.

## `GET /admin/queue/integration-timeline` (P6 연동 시점)

Screen: `app/admin/pipelines/queue/integration-timeline`. Spec:
`design/pipeline/admin-taskqueue-api-spec.md` §P6, which is the SSOT while the upstream
endpoint is absent from `docs/swagger/install-v1.yaml` (**contract gap G8**). Because
there is no generated schema, two things are hand-declared and must move together when
the backend drop lands:

- the query schema, in the route file;
- `IntegrationTimelineWire` / `IntegrationTimelinePageWire`, in `lib/types/task-queue.ts`.

| Query | Values | Default |
|---|---|---|
| `axis` | `CREATED` · `FIRST_INSTALLED` | `CREATED` |
| `from` · `to` | `YYYY-MM-DD`, inclusive, `from ≤ to` | required |
| `installed` | `ALL` · `YES` · `NO` | `ALL` |
| `serviceCode` | string | – |
| `confirmStatus` | `NO_REQUEST` · `PENDING` · `CONFIRM_INFO_UPDATE_REQUIRED` · `CONFIRMED` · `REJECTED` | – |
| `sort` | `{createdAt\|piiAgentFirstInstalledAt\|leadTimeSeconds\|targetSourceId},{asc\|desc}` | `createdAt,desc` |
| `page` · `size` | 0-indexed · max 100 | `0` · `20` |

A query outside that table is a 400 from this route, before anything reaches the upstream.
`axis=FIRST_INSTALLED` with `installed=NO` is **not** an error: it is defined as an empty
page, because a row with no first-integration date cannot fall inside that axis.

`Accept: text/csv` asks the same path for the same rows as a download. Filters and sort are
identical; `page`/`size` are dropped, and the route answers `text/csv` with a
`content-disposition` filename carrying the period. The client never stitches pages into a
file.

Dates are carried, never converted. `created_at` and `pii_agent_first_installed_at` arrive
with the offset the BFF wrote, and the screen renders the calendar day from that string
(`_format.ts`); a UTC "correction" here would move rows near midnight into the wrong period.
