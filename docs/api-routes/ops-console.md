# Route handler index — Ops console (`/target-sources/{id}/collaboration-channel`)

Scope: the route handlers the **Ops console** screens added outside the Admin Task Queue
family. Sibling of `README.md` (Admin Task Queue), per its note to add a file per family
rather than widen one table. Only the routes introduced with the Jira Ticket console are
listed so far.

```
CSR (@/app/lib/api/ops.ts) → app/api/v1/target-sources/[targetSourceId]/**/route.ts → bff.ops.* → upstream /install/v1
```

## Routes

| Route | Upstream | BFF method | Wire → domain |
|---|---|---|---|
| `GET /target-sources/{id}/collaboration-channel?watcher_page&watcher_size` | same, query forwarded as-is | `ops.getCollaborationChannel` | `toCollaborationChannel` (`lib/types/collaboration-channel.ts`) |
| `PUT /target-sources/{id}/collaboration-channel` | same, `{ issue_key, url? }` | `ops.putCollaborationChannel` | `toCollaborationChannel` |

Contract: ASSUMED — `docs/api/ops-assumed-contracts.md` §4 (BE PR #8891, ahead of the
swagger drop). The two Jira failure lists reuse the existing
`GET /admin/queue/…` family through `bff.taskQueue.getAlertTargetSources` with the kinds
`jira-ticket-failed` / `jira-watcher-failed` (§12); the Jira Ticket page reads them
server-side, so no new Next route exists for them.
