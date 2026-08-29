---
name: dev-server
description: Start the worktree dev server on a random free port and hand the user the full URL list.
user_invocable: true
---

# Dev Server

## The Standing Rule

**After finishing any implementation, always start the dev server through a
haiku subagent and hand the user the full URL list.**

- Never report a bare port number. Never report a path fragment.
- Every URL is complete and clickable: `http://localhost:<port>/pass/...`,
  including the `/pass` base path and any query the screen needs to land on the
  state you changed.
- The list is not one line. Give one URL per axis your change splits on
  (see [URL Handover](#url-handover)).
- Every id in the list must exist in the mock data. `curl` each URL and confirm
  `200` before you write it down. A dead link is not a report.

## How To Start It

Call the Agent tool with a haiku subagent — the main session should not run the
server itself, and the script is cheap enough that a small model can drive it.

```typescript
Agent({
  subagent_type: "general-purpose",
  model: "haiku",
  description: "Start dev server",
  prompt: `
    Run: bash scripts/dev.sh <absolute-worktree-path>

    The script is fast (~1-4s) and detaches the server, so run it in the
    FOREGROUND and read its stdout. Do NOT sleep and hope.

    Success is the line "DEV_URL=http://localhost:<port>/pass" in stdout.
    Also report DEV_PID and DEV_LOG.

    If stdout starts with "ERROR:", report the error and the log tail verbatim.
    Do NOT retry.
  `
})
```

`scripts/dev.sh [worktree-path] [port]`:

1. runs `scripts/bootstrap-worktree.sh` (installs `node_modules` if missing)
2. short-circuits if a server for **this** worktree is already up — one pid+port
   lookup, not a port scan
3. removes a stale `.next/dev/lock`
4. draws a **random** port in 3000–8000, checked with a single `lsof -ti`, up to
   5 draws (pass a port as the 2nd argument only when you need a fixed one)
5. starts `next dev` **detached** (`nohup … & disown`), so the server outlives
   the shell and the subagent that launched it
6. polls `http://127.0.0.1:<port>/pass` every 0.3s until it answers 2xx/3xx

Measured 2026-08-29: `DEV_URL=` in ~1.1s warm, ~3.7s on a cold `.next`. The
previous script's 3000→3100 `lsof` walk cost 6–12s before Next even started.

Output contract, one per line, greppable:

```
DEV_URL=http://localhost:6265/pass
DEV_PID=3862
DEV_LOG=/Users/study/pii-agent-demo-<topic>/.next/dev-server.log
```

`kill $DEV_PID` stops the whole tree. Run **one** server per worktree: two
`next dev` processes over the same `.next` clobber each other's build and the
older one starts answering 404.

## URL Handover

Build the list from the axes the change actually splits on. Skip an axis the
change does not touch — a list of everything is as useless as a bare port.

| Axis | Where it lives in the URL |
|------|---------------------------|
| Cloud provider (AWS · Azure · GCP · IDC · SDU) | the target source id in the path |
| Install step (1–7) | the target source id in the path |
| Ops console tab | `?tab=` on the ops detail route |
| Service | `?service_code=` on `/services`, or the code in the admin path |
| Notice vs FAQ | `?type=NOTICE` / `?type=FAQ` on `/notices` |
| Install mode (auto / manual) | **not in the URL** — it is the ops console's TF-execution grant. Give the ops URL and name the toggle to flip. |

### Verified fixture ids

All ids below returned `200` on 2026-08-29 against the mock data. Re-verify with
`curl` before pasting them — fixtures move.

User-facing target detail — `http://localhost:<port>/pass/target-sources/<id>`:

| Provider | Step 1 | Step 2 | Step 4 | Step 5 | Step 6 | Step 7 |
|----------|--------|--------|--------|--------|--------|--------|
| AWS  | 1006, 1029 | 1007 | 1008 | 1010 | 1011, 1642 | 1012 |
| Azure | 1005, 1030 | — | 1003, 1004 | — | 1799, 1801 | — |
| GCP  | 1002, 1017 | — | — | — | 1511 | — |
| IDC  | 1020, 1028 | 1021, 1027 | 1023 | 1024, 1583 | 1025 | 1026 |
| SDU  | — | — | 1100 | — | — | 1099 |

Other routes worth listing when the change touches them:

```
/pass/services
/pass/services?service_code=aws
/pass/notices            /pass/notices?type=FAQ
/pass/access-requests
/pass/admin/pipelines
/pass/admin/pipelines/queue/requests          /pass/admin/pipelines/queue/requests/1029
/pass/admin/pipelines/ops/alerts
/pass/admin/pipelines/ops/services/aws
/pass/admin/pipelines/ops/target-sources/1008?tab=<slug>
/pass/admin/pipelines/access/admins           /pass/admin/pipelines/access/requests
/pass/admin/pipelines/posts
```

Ops `?tab=` slugs are the URL contract in `lib/routes.ts` (`OPS_TAB_SLUGS`):
`status` · `scan` · `request` · `confirm` · `infra` · `tc` · `approval` ·
`airflow` · `danger`.

### Shape of the handover

```
dev server: http://localhost:6265/pass  (PID 3862)

Step 4 install rail — the change:
  AWS   http://localhost:6265/pass/target-sources/1008
  IDC   http://localhost:6265/pass/target-sources/1023
  Azure http://localhost:6265/pass/target-sources/1003
Ops view of the same target:
  http://localhost:6265/pass/admin/pipelines/ops/target-sources/1008?tab=infra
```

## Rules

- **NEVER retry blindly** — if it failed once, report the failure and the log
  tail to the user. Do not restart, do not change the port and hope.
- Poll until the script prints `DEV_URL=`. Do not sleep for a fixed number of
  seconds.
- Do not touch a server belonging to another worktree. The short-circuit and the
  random port already keep you out of its way.
- Verify each URL with `curl` before handing it over.

## Related

- `/mock-dev-server` — same script, plus an explicit `USE_MOCK_DATA=true` guard
  on `.env.local`.
- `/feature-development` — the workflow that ends by invoking this skill.
