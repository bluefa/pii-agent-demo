---
name: dev-server
description: Worktree dev 서버 실행. lock 정리 + 빈 포트 자동 탐색.
user_invocable: true
---

# Dev Server

Worktree 경로에서 Next.js dev 서버를 실행합니다.

## Cost Optimization Strategy

**This skill uses Haiku subagent for all operations (~65% cost reduction).**

- Main session (Sonnet/Opus): High-level orchestration only
- Haiku subagent: Bash execution (bootstrap, dev server startup)

## How This Skill Works

**Manual workflow** (This skill is NOT auto-invoked):

1. Read this guide
2. **You call Task tool** with Haiku subagent to start dev server
3. Haiku runs Bash commands and reports result

**Why manual:** Dev server is a long-running process that stays active in background. It cannot be automatically triggered by Skill tool alone.

## When to Use This Skill

- Dev server setup
- Testing changes locally
- Running next dev with auto port-finding

## Usage Example

When you want to start dev server, **you** should call Task tool:

```typescript
Task({
  subagent_type: "Bash",
  model: "haiku",
  description: "Start dev server (Haiku)",
  prompt: `
    Execute dev server startup script:

    1. Navigate to /Users/study/pii-agent-demo-fix-haiku-skills (or specify worktree-path)
    2. Check if port 3000-3100 is available
    3. Execute: bash scripts/dev.sh <worktree-path>
       - IMPORTANT: Use Bash tool with run_in_background: true
    4. Wait 3-5 seconds and verify server started (look for "Ready" message)
    5. Report: port number and confirmation

    If "next: command not found" occurs:
    - Run: bash scripts/bootstrap-worktree.sh <worktree-path>
    - Then retry dev server startup
  `
})
```

## Script Behavior

The `scripts/dev.sh` script (invoked by Haiku):
1. Runs `scripts/bootstrap-worktree.sh` for dependency verification
2. Removes `.next/dev/lock` file if exists
3. Auto-finds available port from 3000-3100
4. Starts `npx next dev -p <port>`

## Rules

- **NEVER retry** — If failed once, report to user
- **Background execution required** — dev server is a long-running process
- Verify "Ready" message appears in output
- Report the final port number to user
