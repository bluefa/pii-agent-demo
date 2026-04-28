# BFF API Docs

> Confluence: 5.2.3.5.5.10.0 (overview)
> Status: Draft
> Created: 2026-04-27
> Last updated: 2026-04-28

This directory holds the per-Tag guides, shared catalogs, and change-discussion log for the BFF API. Each Tag guide embeds a Tag-scoped Swagger excerpt directly so that frontend, backend, QA, and operations can read the contract and its operational meaning side by side.

> **Note on language.** This `README.md` is the directory entry point and is written in English per project rules (`CLAUDE.md` ⛔ #5 — every `README.md`, `CLAUDE.md`, `AGENTS.md` is English-only). The detailed strategy, plan, and Tag content live in Korean under `strategy.md`, `management-plan.md`, and the `tag-guides/` / `catalogs/` / `discussions/` subdirectories. The Confluence pages mirror those Korean docs.

## 1. Layout

```text
docs/bff-api/
├── README.md             # This file. English entry point.
├── strategy.md           # Why we manage docs this way (Korean).
├── management-plan.md    # How we manage day-to-day, incl. ErrorCode flow (Korean).
├── tag-guides/           # One file per BFF API Tag. Inline Swagger excerpt + ops notes.
├── catalogs/             # Cross-Tag catalogs: error-codes today; enums/states later.
└── discussions/          # API change-log: per-change discussion docs.
```

The Confluence numbering (`5.2.3.5.5.10.x`) is preserved on each file's `> Confluence:` metadata line. Filenames intentionally do **not** carry the numbers, so re-numbering on the Confluence side never requires renaming repo files.

## 2. Tag guides

| API Tag | File | Status |
| --- | --- | --- |
| Target Sources | [tag-guides/target-sources.md](./tag-guides/target-sources.md) | Draft |
| Scan Jobs | [tag-guides/scan-jobs.md](./tag-guides/scan-jobs.md) | Draft |
| Resource Recommendations | [tag-guides/resource-recommendations.md](./tag-guides/resource-recommendations.md) | Draft |
| Approval Requests | [tag-guides/approval-requests.md](./tag-guides/approval-requests.md) | Draft |
| Installation Status | [tag-guides/installation-status.md](./tag-guides/installation-status.md) | Draft |
| Database Credentials | [tag-guides/database-credentials.md](./tag-guides/database-credentials.md) | Draft |
| Cloud Permission | [tag-guides/cloud-permission.md](./tag-guides/cloud-permission.md) | Draft |
| Users | [tag-guides/users.md](./tag-guides/users.md) | Draft |
| Services | [tag-guides/services.md](./tag-guides/services.md) | Draft |
| Test Connection | [tag-guides/test-connection.md](./tag-guides/test-connection.md) | Draft |
| Admin Guides | [tag-guides/admin-guides.md](./tag-guides/admin-guides.md) | Implemented |

## 3. Catalogs

| Catalog | File | Note |
| --- | --- | --- |
| Error codes | [catalogs/error-codes.md](./catalogs/error-codes.md) | Per-code meaning, retry policy, user/operator action |
| Enums / states | _TBD_ | Will land when first cross-Tag enum is captured |

## 4. Discussions

API additions, contract changes, error-code changes, and deprecations are tracked as one Markdown file per change under [discussions/](./discussions/). See [discussions/README.md](./discussions/README.md) for the filename convention and the per-doc template.

## 5. How to navigate

| Goal | Start here | Then |
| --- | --- | --- |
| Latest API for a Tag | the Tag guide | inline Swagger section |
| Request/response schema | the Tag guide | inline Swagger excerpt |
| Operational meaning of a response field | the Tag guide | the response-meaning section (`response 설명`) |
| What changed in a Tag, and why | the Tag guide's change-log table | linked discussion file |
| Meaning of an error code | [catalogs/error-codes.md](./catalogs/error-codes.md) | the Tag guide that emits it |
| Status definitions | [management-plan.md §3](./management-plan.md) | — |

## 6. For maintainers

- Day-to-day workflow (new Tag, contract change, error code update, status transition): see [management-plan.md](./management-plan.md). The `/bff-api-docs` skill (planned) automates and validates these flows.
- Strategic rationale and non-goals: see [strategy.md](./strategy.md).
- Hard rules that bind these docs (English-only paths, Korean-allowed paths, etc.): see project root [`CLAUDE.md`](../../CLAUDE.md).
