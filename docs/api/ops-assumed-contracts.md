# Ops Console — Assumed Contracts (no backing in install-v1.yaml)

Capabilities with **no endpoint in `docs/swagger/install-v1.yaml`**: §1–§5 and §9 on the
Target Source ops page (`/admin/pipelines/ops/target-sources/{id}`), and §8 on the
service-owner list (`/services`). They are implemented mock-first behind Next.js routes
with the shapes below. When the BFF ships real endpoints, replace the mock handlers and
delete the corresponding section here.

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
→ 200   { target_source_id: number, grant_service_terraform_execution_permission: boolean }
```

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

## 4. Collaboration channel — WITHDRAWN, the real contract already covered it

This section invented `GET/PUT …/collaboration-channel` for the 협업 채널 block in the ops
header. It never existed upstream, and it did not need to: install-v1 already carries both
halves of what it was doing, split by role.

```
GET  /install/v1/target-sources/{targetSourceId}/jira-ticket          // read — "이 대상의 티켓"
→ 200 JiraTicketResponse { id, targetSourceId, serviceCode, issueKey, cloudProvider, browseUrl }
→ 404 no ticket mapped to this target (an answer, not an outage)

POST/DELETE /install/v1/services/{serviceCode}/jira-tickets/{cloudProvider}   // write — 연결·해제
POST        /install/v1/services/{serviceCode}/jira-tickets/{cloudProvider}/watchers
```

The assumed shape had a PUT because it assumed the ops header owned the mapping. It does
not — the writes live on the service × provider axis and the 서비스 운영 화면 owns that
surface. So the header reads the target axis and links to the service screen for the
writes; nothing is left for an assumed endpoint to do.

Keeping the assumed pair had a visible cost: the same target read `INFRA-2211` in the ops
header and `BDCDIP-1010` on the 서비스측 screen, which had been using the real target-axis
endpoint all along. Withdrawn 2026-08-10 — `ChannelModal`, the Next route, the BFF methods
and the mock store field are all deleted.

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
→ 200   { target_source_id: number, description: string }
```

The client reads nothing off the response: it reloads the list it already draws the row
from, so the row and the dialog cannot disagree.

`maxLength` 1000 is the owner's, not this screen's (2026-08-18) — the first draft enforced
no cap precisely because the contract declared none, and that premise is now gone. It is
stated twice, as every other 1,000-char field in this repo is: `maxLength` + a counter on
the textarea (`DescriptionEditModal`, the shape `ConfirmRewindModal` uses), and an
independent `VALIDATION_FAILED` guard on the route. The route measures the string it
receives, before any trim — the dialog's trim is an editorial choice, not the contract's.

## 9. Target Source 실데이터 여부 write

```
PUT /install/v1/target-sources/{targetSourceId}/does-support-raw/enabled
PUT /install/v1/target-sources/{targetSourceId}/does-support-raw/disabled
body     none                                   // the value is the path, not a payload
→        no declared response body
404      TargetSourceNotFoundException (raised by infra, relayed by self-installation-tool)
```

Unlike §1–§5 and §8, these two are **implemented upstream** — they are only missing from
`install-v1.yaml`, so a failure here is not the permanent 404 an unbuilt endpoint gives.
The dialog's failure copy may invite a retry (§8's may not; see the note below it).

Both endpoints still carry a BE TODO for an Admin-only permission annotation. Nothing on
the client stands in for it: the only caller is the ops console, which is already behind
the ADMIN gate, and a client-side check would state an authorisation rule the server has
not made yet.

The internal route folds the pair into one boolean — `PUT /pass/api/v1/target-sources/{id}/
does-support-raw { enabled: boolean }`. Two paths are one value written two ways, and the
path encoding is the upstream's representation of it, applied in `lib/bff/http.ts` where every other
upstream path shape is decided. Nothing is read back from either hop: the header reloads
the value from the detail it already draws.

## The field the tags read: `doesSupportRaw`

A field the BFF carries on TargetSource that `install-v1.yaml` does not declare yet. The
`실데이터` tag on `/pass/admin/pipelines/ops/services/{code}` and the 실데이터 chip in the
header of `/pass/admin/pipelines/ops/target-sources/{id}` are keyed to it.

It is read through `readDoesSupportRaw` (`lib/types.ts`) rather than a declared field,
because the generated schemas are `.partial().passthrough()`: an undeclared key survives
`parse()` and reaches the consumer. The casing is **camelCase in both wires** (BE-confirmed
— a camel island inside the otherwise snake `TargetSourceDetail`); the earlier reader took
both casings only because the contract had not said which one, and that branch is gone.

The reader returns three states — `true` / `false` / `undefined` (not a boolean on the
wire, or absent). The two surfaces fold them differently, and on purpose:

- The service card draws a tag only on `=== true`. A tag has no "off" shape.
- The ops header always draws the chip, because it is also the control that changes the
  value: 포함 / 미포함 / 미확인. Writing 미포함 for a value we could not read would have
  the screen assert something it never received.

## Mock implementation

All sections are served by `app/api/v1/…` route handlers backed by globalThis-guarded
in-memory stores in `lib/bff/mock/ops.ts` (`__opsConsoleMockStore` for per-target
state, `__opsConsoleServiceStore` for §6), same pattern as the admin queue mocks.
Handlers are marked `// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md`.
