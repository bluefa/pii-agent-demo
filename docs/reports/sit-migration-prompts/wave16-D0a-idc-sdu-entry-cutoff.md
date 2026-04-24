# Wave 16-D0a - IDC/SDU Entry Cutoff

## Context

PR358 makes IDC/SDU removal a prerequisite for resource-model separation. This first PR must be safe and build-green: block new IDC/SDU entry points and detach `ProjectDetail` from IDC/SDU page imports, but do not shrink provider types yet.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git show --quiet --format='%H %s' origin/main
test -f docs/reports/resource-model-separation-plan.md
```

Before implementation, create the archive tag if it does not exist:

```bash
git ls-remote --tags origin archive/idc-sdu-pre-removal
```

If no tag is returned:

```bash
git tag -a archive/idc-sdu-pre-removal origin/main -m "archive IDC/SDU before Wave 16 D0 removal"
git push origin archive/idc-sdu-pre-removal
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic wave16-d0a-idc-sdu-entry-cutoff --prefix refactor
cd /Users/study/pii-agent-demo-wave16-d0a-idc-sdu-entry-cutoff
```

## Step 2: Required Reading

- `docs/reports/resource-model-separation-plan.md` sections 6-7
- `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx`
- `lib/constants/provider-mapping.ts`
- Project creation UI files that consume `provider-mapping.ts`

## Scope

Update only entry/routing-level files. Do not delete IDC/SDU component trees, API routes, mock clients, provider types, or docs in this PR.

Expected files:

| File | Change |
|---|---|
| `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx` | Remove `IdcProjectPage` and `SduProjectPage` imports. For `IDC`/`SDU`, render a small unsupported/removed-provider notice or route-safe fallback. |
| `lib/constants/provider-mapping.ts` | Remove IDC/SDU creation options and stale `other` wording that still advertises IDC. Keep type changes minimal. |
| Project create modal/chip files | Adjust only if they directly reference removed provider keys. |

## Acceptance Criteria

- New IDC/SDU target-source creation is no longer exposed.
- Visiting an existing IDC/SDU target source does not import or render IDC/SDU-specific page code.
- `CloudProvider` union still includes IDC/SDU in this PR. Type shrink happens in D0d.
- No IDC/SDU UI/API file is deleted yet.

## Verification

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/[targetSourceId]/_components/ lib/constants/provider-mapping.ts
rg -n "IdcProjectPage|SduProjectPage" app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx
```

The final `rg` command must return no hits.

## Commit

```bash
git commit -m "refactor(provider): block IDC SDU entry points (wave16-D0a)"
```

## Return

Report PR URL, tag status, `tsc` result, lint result, and any remaining IDC/SDU entry points intentionally deferred to D0b-D0e.
