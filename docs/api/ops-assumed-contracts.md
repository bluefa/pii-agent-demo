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

## 6. Service operations

ServiceCode-level operations: owner/status summary and EOS processing. Jira tickets
are NOT here — they are a real contract (`docs/api/jira-tickets.md` §1), fetched
separately per service and keyed by cloudProvider. `jira_ticket_count` stays on the
summary so the index list can show a count without a second round trip.

```
GET /install/v1/admin/ops/services
→ 200   [{ service_code, service_name, owner, status: OPERATING|EOS,
           target_source_count, jira_ticket_count }]

GET /install/v1/admin/ops/services/{serviceCode}
→ 200   { service_code, service_name, owner, status,
          target_sources: <§5 row>[] }

POST /install/v1/admin/ops/services/{serviceCode}/eos
body     { force: boolean }
→ 200   service summary (status becomes EOS)
→ 409   ErrorMessage        // running pipeline exists and force=false
```

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

## Mock implementation

All sections are served by `app/api/v1/…` route handlers backed by globalThis-guarded
in-memory stores in `lib/bff/mock/ops.ts` (`__opsConsoleMockStore` for per-target
state, `__opsConsoleServiceStore` for §6), same pattern as the admin queue mocks.
Handlers are marked `// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md`.
