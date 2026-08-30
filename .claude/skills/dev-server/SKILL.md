---
name: dev-server
description: Worktree dev 서버 실행. lock 정리 + 랜덤 포트(3000-8000).
user_invocable: true
---

# Dev Server

Runs the Next.js dev server from a worktree path.

## How to run

Run the script yourself, in the background. Do NOT spawn another subagent from
here — whoever invoked this skill is already the right place to run it, and a
nested spawn does not inherit the caller's model.

```bash
bash scripts/dev.sh <worktree-path>   # Bash tool, run_in_background: true
```

Then read the output:

- `✅ 이미 이 워크트리의 서버가` → already running; report that port
- `Dev server: http://localhost:<port>` → started; report that port
- `ERROR` → report to the user and stop
- `next: command not found` → `bash scripts/bootstrap-worktree.sh <worktree-path>`, then retry once

The app is mounted under basePath `/pass`, so verify with
`curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/pass`.
A 404 on `/` is expected.

## Cost note

The dev server is pure Bash work. When the main session delegates it, send it to
a **haiku** subagent and have that agent run the script directly.

## Script behavior

`scripts/dev.sh`:
1. Runs `scripts/bootstrap-worktree.sh` to verify dependencies
2. Removes `.next/dev/lock` if present
3. If a server for the same worktree is already running, reports its port and exits
4. Picks one time-seeded random port in 3000-8000; if taken, exits with an error and does not retry
5. Starts `npx next dev -p <port>`

## Rules

- **NEVER retry** — if it fails once, report to the user
- **Background execution required** — this is a long-running process
- Verify the "Ready" message appears
- Report the final port to the user
