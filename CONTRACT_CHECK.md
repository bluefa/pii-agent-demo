# API Contract Check

This document is the repository-level rule source for API contract validation.
It is written for both people and AI agents.

## What It Is

`contract-check` is a lightweight guard for API contract drift.
It checks whether API runtime changes stay aligned with the Swagger contract in
`docs/swagger/*.yaml`.

The check is intentionally mechanical. It does not prove that every schema field
matches runtime behavior. It catches the highest-risk drift cases early:

- API runtime files changed without a matching Swagger file change.
- Changed files contain deny-listed legacy fields or flags from
  `contract-check.rules`.

Swagger remains the source of truth for request and response contracts.

## When It Runs

The local git pre-commit hook runs contract check automatically:

```bash
bash scripts/contract-check.sh --mode staged
```

PR preparation should also run the branch diff form:

```bash
bash scripts/contract-check.sh --mode diff --base origin/main --head HEAD
```

Run the staged form when you want to verify only currently staged files.
Run the diff form when you want to verify everything in the current branch.

## API Runtime Scope

The script treats these paths as API runtime or API-facing type changes:

- `app/api/**`
- `app/integration/api/**`
- `app/lib/api/**`
- `lib/bff/**`
- `lib/types/**`

Changes under these paths must be reviewed against the relevant Swagger files.
If the public API contract changes, update `docs/swagger/*.yaml` in the same
change.

## Rule File

Domain-specific deny rules live in:

```text
contract-check.rules
```

Each non-comment line has this format:

```text
<regex>|<message>
```

Example:

```text
\blegacyFlag\b|Legacy flag is deprecated. Use canonical source field instead.
```

Use deny rules for fields, enum values, flags, or payload aliases that must not
be reintroduced.

## How To Read Failures

### API Changed Without Swagger

This means a runtime API file changed but no `docs/swagger/*.yaml` file changed
in the same staged set or branch diff.

Before bypassing the failure, verify whether the external request/response
contract changed:

- If the contract changed, update Swagger.
- If the contract did not change, state that explicitly in the PR notes and
  include the manual contract-check result.

### Rule Match

This means a changed file matched a regex in `contract-check.rules`.
Remove the deprecated field or update the rule only after confirming the new
contract direction.

## What Humans And AI Must Still Check

Contract check is not a replacement for API review. For each changed endpoint,
compare these manually:

- Swagger request required fields vs. route parsing.
- Swagger response required fields vs. `bff` response shape.
- Swagger enum values vs. TypeScript unions/constants.
- Swagger field names vs. mock data and UI-facing API types.
- Error response shape and timestamp fields.

Do not conclude that an API change is contract-safe only because lint, tests,
build, or contract check passed.
