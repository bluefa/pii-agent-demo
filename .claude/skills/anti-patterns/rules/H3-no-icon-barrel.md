# H3. No shared icon barrel

Severity: 🟡 important

Even when icons are extracted, scattering them across `app/components/ui/*.tsx` as individual files without an `icons/index.ts` barrel forces every consumer to pick the correct path, and makes the inventory invisible. An icon module should have a single import surface:

```ts
// ✅ app/components/ui/icons/index.ts
export type { IconProps } from './types';
export { GuideIcon } from './GuideIcon';
export { ExpandIcon } from './ExpandIcon';
export { WarningIcon } from './WarningIcon';
// ... etc. Sorted alphabetically, grouped by concern.
```

**Consequences of skipping the barrel**:

- Inventory drift — duplicate icons sneak in because nobody sees the list
- Bundle bloat — multiple definitions of the same glyph
- Refactor tax — name/path changes require multi-file edits

(This is one of the few places the "avoid barrel files" rule from bundler guidance is outweighed. Next.js tree-shakes named re-exports well; the governance benefit wins.)
