# Code Review

Review `$ARGUMENTS` using the current repository authorities.

Prefer the `code-reviewer` agent for the main review. It already loads
`code-review` and `coding-standards`, and those skills route to the current
references instead of duplicating stale rules.

## Required Flow

1. Start one `code-reviewer` task for `$ARGUMENTS`.
2. Ask it to inspect the diff or requested paths first, then read the relevant
   authority documents:
   - `AGENTS.md`, `CLAUDE.md`
   - `coding-standards`
   - `DESIGN.md` and `frontend-design` for UI changes
   - `docs/api/boundaries.md`, ADRs, and Swagger for API/BFF changes
   - contract-check docs for API contract changes
3. Request findings first, ordered by `P1`/`P2`/`P3`, with `file:line`,
   impact, evidence, and authority.
4. If the change is broad and a focused second pass would help, run one
   additional targeted agent only for that lens:
   - TypeScript/type safety
   - React/Next.js behavior
   - Design-system/UI token usage
   - Project structure/import boundaries

## Output

Summarize the result in this shape:

```markdown
## Findings

### P1
- ...

### P2
- ...

### P3
- ...

## Verification
- Ran: ...
- Not run: ...

## Summary
- Blocking findings: N
- Residual risk: ...
```

Do not use hardcoded old color mappings, old app folder layouts, or removed
architecture guidance in review prompts. Route those checks through the current
authority docs instead.
