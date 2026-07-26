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

## Mock implementation

All four are served by `app/api/v1/ops/…` route handlers backed by a globalThis-guarded
in-memory store (`app/api/v1/ops/_lib/store.ts`), same pattern as the admin queue mocks.
Handlers are marked `// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md`.
