# Wave 16-D0e - IDC/SDU Docs Cleanup

## Context

D0a-D0d removed active IDC/SDU code. This PR removes active IDC/SDU documentation and updates current-state docs so future resource-model work does not carry IDC/SDU exceptions.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
rg -n "'IDC'|'SDU'|\\bIdc\\b|\\bSdu\\b|\\bidc\\b|\\bsdu\\b" app lib && exit 1 || true
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic wave16-d0e-idc-sdu-docs-cleanup --prefix docs
cd /Users/study/pii-agent-demo-wave16-d0e-idc-sdu-docs-cleanup
```

## Step 2: Required Reading

- `docs/reports/resource-model-separation-plan.md`
- `docs/cloud-provider-states.md`
- `docs/api/common.md`
- `docs/api/core.md`
- `docs/api/scan.md`
- `docs/api/providers/idc.md`
- `docs/api/providers/sdu.md`
- `docs/swagger/idc.yaml`
- `docs/swagger/sdu.yaml`
- `docs/sdu-process-design.md`
- `docs/adr/*.md` files that mention IDC/SDU

## Scope

Delete active provider docs for IDC/SDU and update current-state docs to AWS/Azure/GCP.

Expected deletes:

| Path | Notes |
|---|---|
| `docs/api/providers/idc.md` | Active IDC API spec. |
| `docs/api/providers/sdu.md` | Active SDU API spec. |
| `docs/swagger/idc.yaml` | Active IDC swagger. |
| `docs/swagger/sdu.yaml` | Active SDU swagger. |
| `docs/sdu-process-design.md` | Active SDU process design. |

Expected updates:

| File | Change |
|---|---|
| `docs/cloud-provider-states.md` | Remove IDC/SDU current-state sections and provider tables. Add short note that IDC/SDU were removed by Wave 16-D0 and archive tag exists. |
| `docs/api/common.md` | Shrink provider examples to AWS/Azure/GCP. |
| `docs/api/core.md` | Remove IDC/SDU active metadata examples. |
| `docs/api/scan.md` | Remove IDC/SDU scan exception checklist. |
| `docs/reports/resource-model-separation-plan.md` | Mark D0 complete if all D0 PRs are merged, and keep D1-D4 scope as AWS/Azure/GCP. |

ADR handling:

- Do not rewrite historical ADR decisions just to erase history.
- If an ADR has a "current state" or active guidance section that still says IDC/SDU are supported, update that section with a short removal note.

## Acceptance Criteria

- Active docs no longer describe IDC/SDU as supported providers.
- Historical ADR references either remain clearly historical or include a removal note.
- Resource-model plan no longer requires "IDC/SDU excluded" caveats in D1-D4.

## Verification

```bash
npx tsc --noEmit
npm run lint -- docs
test ! -f docs/api/providers/idc.md
test ! -f docs/api/providers/sdu.md
test ! -f docs/swagger/idc.yaml
test ! -f docs/swagger/sdu.yaml
test ! -f docs/sdu-process-design.md
rg -n "IDC|SDU|idc|sdu" docs
```

Review remaining `rg` hits manually. Only historical notes, archive references, or this wave spec should remain.

## Commit

```bash
git commit -m "docs(provider): remove IDC SDU active documentation (wave16-D0e)"
```

## Return

Report PR URL, deleted docs, updated current-state docs, verification results, and any intentional historical IDC/SDU references left behind.
