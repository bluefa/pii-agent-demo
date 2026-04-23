# B1. God component (300+ LOC)

Severity: 🔴 critical

A single file mixing the main component + inner subcomponents + business logic.

- When the file exceeds 300 LOC, split into a folder (`ComponentName/index.ts` + `sub/*`)
- Inner modal components go to `./modals/*.tsx`
- Even under 300 LOC, split when concerns are tangled

See also: **C1** (scattered form state) often overlaps with this.
