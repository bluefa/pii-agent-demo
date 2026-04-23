# G9. Comments narrating past bugs or refactor history

Severity: 🟢 nice-to-have

Comments should describe **invariants** (why code must stay this way) — not history (what used to be wrong, what a reviewer flagged, what a previous PR fixed). History rots fast: readers months later hit a mention of "this refactor" with no idea which refactor, and the comment becomes noise that competes with real invariants.

```ts
// ❌ Bad — narrates the fix history
// Iterate the original array so `ip_${index}` error keys line up with the
// JSX `ips.map((_, index) => ...)` read — extracting to filtered-index
// here was the pre-existing bug flagged during review of this refactor.
ips.forEach((ip, index) => { /* ... */ });

// ✅ Good — same invariant, no history
// Index must match the JSX map index (`ips.map((_, i) => ...)`),
// so iterate the full array even when some entries are blank.
ips.forEach((ip, index) => { /* ... */ });

// ❌ Bad
// Added in PR #311 to handle the Oracle case we missed earlier.
if (state.databaseType === 'ORACLE') { /* ... */ }

// ✅ Good — delete the comment; git blame has the PR.
if (state.databaseType === 'ORACLE') { /* ... */ }
```

**Forbidden phrases**: "this refactor", "the fix", "previously", "was flagged", "PR #NNN", "the reviewer noted". If you need to remember the context, put it in the commit message or PR description — both are preserved by git history, neither rots in the source.

Aligned with `CLAUDE.md`: *"Don't reference the current task, fix, or callers — those belong in the PR description and rot as the codebase evolves."*
