# Ops Console — Assumed Contracts (no backing in install-v1.yaml)

The Target Source ops page (`/admin/pipelines/ops/target-sources/{id}`) renders four
capabilities that have **no endpoint in `docs/swagger/install-v1.yaml`**. They are
implemented mock-first behind Next.js routes with the shapes below. When the BFF ships
real endpoints, replace the mock handlers and delete the corresponding section here.

Conventions follow install-v1: snake_case wire, Spring `Page` for pagination,
`ErrorMessage` problem responses.

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
→ 200   { target_source_id: number, grant_service_terraform_execution_permission: boolean }
```

## 3. AWS role registration / update

`verify-scan-role` / `verify-execution-role` (GET) return `role_arn` but nothing can set
it. The UI collects the role *name* only; the server composes the ARN from the account id
and partition (`aws` / `aws-cn` for China accounts).

```
PUT /install/v1/target-sources/{targetSourceId}/aws/scan-role
PUT /install/v1/target-sources/{targetSourceId}/aws/execution-role
body     { role_name: string }            // /^[\w+=,.@-]{1,64}$/
→ 200   { role_arn: string }              // e.g. arn:aws:iam::123456789012:role/{role_name}
→ 400   ErrorMessage                      // name fails the IAM pattern
```

Saving a role resets its verification verdict (next verify GET starts from IN_PROGRESS);
a stale "verified" state must not survive an ARN change.

## 4. Collaboration channel

The 협업 채널 bubble (Jira issue link) in the page header.

```
GET /install/v1/target-sources/{targetSourceId}/collaboration-channel
→ 200   { issue_key: string, url: string } | 204 (none)

PUT /install/v1/target-sources/{targetSourceId}/collaboration-channel
body     { issue_key: string, url: string }
→ 200   same shape
```

## 5. Ops target-source list

Powers the Target Source 운영 index list. `process_status` uses the 7-step wire enum
from `process-status`; `last_changed_at` is the latest status-transition timestamp.

```
GET /install/v1/admin/ops/target-sources?query={q}&page={n}&size={n}
→ 200   Spring Page<{
          target_source_id: number,
          service_code: string,
          service_name: string,
          cloud_provider: string,        // AWS | GCP | AZURE | IDC
          is_sdu_type: boolean,
          database_type: string | null,
          process_status: IDLE|PENDING|CONFIRMING|CONFIRMED|INSTALLED|CONNECTED|COMPLETED,
          last_changed_at: ISO-8601,
        }>
// query matches target_source_id / service_code / service_name (contains).
```

## 6. Service operations

ServiceCode-level operations: owner/status summary, Jira ticket registry with
notification users, and EOS processing.

```
GET /install/v1/admin/ops/services
→ 200   [{ service_code, service_name, owner, status: OPERATING|EOS,
           target_source_count, jira_ticket_count }]

GET /install/v1/admin/ops/services/{serviceCode}
→ 200   { service_code, service_name, owner, status,
          jira_tickets: [{ ticket_key, summary, status: TO_DO|IN_PROGRESS|DONE, users: string[] }],
          target_sources: <§5 row>[] }

POST /install/v1/admin/ops/services/{serviceCode}/eos
body     { force: boolean }
→ 200   service summary (status becomes EOS)
→ 409   ErrorMessage        // running pipeline exists and force=false

POST /install/v1/admin/ops/services/{serviceCode}/jira-tickets/{ticketKey}/users
body     { user_id: string }
→ 200   updated jira ticket
```

## 7. Ops alerts (운영 알림)

Powers 운영 알림. The page is a cross-service aggregation: it needs exact counts, a
total ordering by elapsed time, and rows drawn from *two* populations (target sources
by `process_status`, plus Test Connection re-run requests). None of that can be done
correctly in the browser — filtering a single page of §5 caps the counts at the fetched
window, silently drops rows past it, and sorts only within it. So the aggregation is
the server's job.

```
GET /install/v1/admin/ops/alerts?kind={kind}&page={0}&size={20}
→ 200 {
     counts: {                       // whole population, independent of kind/paging
       PENDING:     number,          // 연동 대상 승인·반려 대기
       CONFIRMED:   number,          // Agent 설치 필요
       CONNECTED:   number,          // 연결 테스트 완료 승인 대기
       TC_REJECTED: number,          // 연결 테스트 재실행 요청됨
       STALE:       number,          // last_changed_at 이 STALE_DAYS 이상 경과
     },
     alerts: Page<OpsAlertRow>
   }

OpsAlertRow {
  target_source_id: number
  service_code:     string
  service_name:     string
  cloud_provider:   string           // AWS | GCP | AZURE | IDC
  is_sdu_type:      boolean
  process_status:   IDLE|PENDING|CONFIRMING|CONFIRMED|INSTALLED|CONNECTED|COMPLETED
  last_changed_at:  ISO-8601         // what 경과 is measured from
  alert_kinds:      AlertKind[]      // every kind that applies; never empty
}
```

- `kind` omitted → every row with at least one alert kind (the default view).
- Rows are sorted by `last_changed_at` **ascending** (longest elapsed first) and paged.
- `alert_kinds` is a list because a row can be several at once (a CONNECTED target that
  has also sat for 8 days is both `CONNECTED` and `STALE`). The server decides which
  kinds apply; the client must not re-derive them from `process_status`.
- `STALE_DAYS` is server policy (currently 7). The client renders the threshold it is
  told about, it does not own it.
- `TC_REJECTED` is not a process status. Rejecting a Test Connection rolls the target
  back to its pre-test step, so these rows match no status filter — the server joins the
  test-connection queue to find them. That join is only sound because every queue row is
  a real target source (see the invariant below).

### Invariant: a Test Connection queue row is always a target source

`GET /admin/queue/test-connections` returns rows keyed by `target_source_id`. Every such
id MUST resolve at `GET /target-sources/{id}`, because 운영 알림 links Test Connection
alerts to that target's 운영 화면 (`?tab=tc`) — the only place the Test Connection
detail lives. A queue row without a target source is a dangling reference, and the mock
is built to make that unrepresentable: the queue's demo targets are seeded as real
projects in `lib/mock-data.ts`, not as a side fixture.

## Mock implementation

All sections are served by `app/api/v1/…` route handlers backed by globalThis-guarded
in-memory stores in `lib/bff/mock/ops.ts` (`__opsConsoleMockStore` for per-target
state, `__opsConsoleServiceStore` for §6), same pattern as the admin queue mocks.
Handlers are marked `// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md`.
