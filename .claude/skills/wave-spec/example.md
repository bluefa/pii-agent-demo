# Wave-Task Spec — Working Example

The following is a deliberately tiny spec illustrating every required
section from [template.md](./template.md). Real specs are 100–600 lines;
this skeleton is ~80.

Use this as a sanity reference: if your draft cannot be reduced to this
shape, it's missing something.

---

````markdown
# Wave 17 — Detail page subtitle eyebrow (audit G9)

## Context

The audit (`docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`)
flags **G9 / D7**: the prototype renders an eyebrow above the page title
on the target-source detail page, using `cardStyles.eyebrow`. The current
detail page omits it.

| File | Change |
|---|---|
| `app/integration/target-sources/[targetSourceId]/page.tsx` | mount `<PageMeta eyebrow=...>` prop |

Out of scope: any other page, eyebrow on cards, theme additions. Wave 9
already ships `cardStyles.eyebrow`.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "cardStyles.eyebrow" lib/theme.ts && echo "✓ Wave 9 merged"
```

If the check fails, stop. Wave 9 must follow before Wave 17.

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step-polish-wave17-eyebrow --prefix feat
cd /Users/study/pii-agent-demo-sit-step-polish-wave17-eyebrow
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` — search `.eyebrow`. The
   prototype renders `대상 시스템` above the page title at 12 / 600 /
   uppercase.
2. `docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md` §3
   G9 — the audit prescription.
3. `app/integration/target-sources/[targetSourceId]/page.tsx` — current
   page shell; the `<PageMeta>` mount is at line ~42.
4. `app/components/ui/PageMeta.tsx` — confirms `eyebrow?: string` prop
   exists and renders with `cardStyles.eyebrow`.

## Step 3: Implementation

### 3-1. `page.tsx` — add `eyebrow` prop

Current state (line 42): `<PageMeta title={...} subtitle={...} />` — no
`eyebrow` prop.

Change shape:

```tsx
<PageMeta
  eyebrow="대상 시스템"
  title={project.name}
  subtitle={...}
/>
```

The literal `'대상 시스템'` is Korean UI copy per the prototype. No
constant extraction (single call site).

## Step 4: Do NOT touch

- `PageMeta.tsx` — already ships the `eyebrow` prop. Wave 17 only mounts.
- `lib/theme.ts` — `cardStyles.eyebrow` exists; no token change.
- ADR-014 R3 stepper four files — unrelated; freeze.
- Any other page consuming `<PageMeta>` — out of scope.

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/'[targetSourceId]'/page.tsx
```

Browser smoke:
- Azure × WAITING_APPROVAL: eyebrow `대상 시스템` renders above the
  page title in uppercase 12 px.
- AWS × WAITING_APPROVAL: same.
- GCP × WAITING_APPROVAL: same.

Out-of-scope guard:

```bash
git diff --name-only origin/main -- \
  app/components/ui/PageMeta.tsx \
  lib/theme.ts \
  | (read -r line && echo "✗ out-of-scope file modified: $line" || echo "✓ untouched")
```

## Step 6: Commit + push + PR

```bash
git add app/integration/target-sources/'[targetSourceId]'/page.tsx
git commit -m "$(cat <<'EOF'
feat(detail): eyebrow on target-source detail page (wave17)

Closes audit G9. Mounts the existing PageMeta eyebrow prop with the
prototype's '대상 시스템' label.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin feat/sit-step-polish-wave17-eyebrow
```

PR body:

```
## Summary
Wave 17. Closes audit G9 by mounting the existing PageMeta `eyebrow`
prop on the target-source detail page.

## Changes
- `page.tsx` — adds `eyebrow="대상 시스템"` to the `<PageMeta>` mount.

## Out of scope
- `PageMeta.tsx` (already ships the prop, Wave 9).
- `lib/theme.ts` (`cardStyles.eyebrow` exists).
- Any other page or card eyebrow.

## Test plan
- [x] Detail page renders the eyebrow on all three providers
- [x] tsc / lint clean
- [x] Out-of-scope guard passes
```

## Step 7: Self-review checklist

- [ ] `eyebrow="대상 시스템"` literal is Korean per the prototype, not translated.
- [ ] No new import added (PageMeta already imported).
- [ ] No `lib/theme.ts` edit.
- [ ] No other page touched in the diff.
- [ ] No `any`. No relative import. No raw hex.
- [ ] Stepper guard passes.
- [ ] `tsc --noEmit` clean.

## Acceptance for this wave

Wave 17 is correct when:
- The target-source detail page renders `대상 시스템` above the page title
  for every provider.
- `PageMeta.tsx`, `lib/theme.ts`, and the stepper four files are untouched.
- `tsc --noEmit` exits 0; lint introduces 0 new warnings.
- Audit punch-list G9 is closed for the detail page (G9 on other pages,
  if any, remains under their own waves).
````
