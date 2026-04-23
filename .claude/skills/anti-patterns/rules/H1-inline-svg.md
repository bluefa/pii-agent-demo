# H1. Inline SVG markup in feature components

Severity: 🔴 critical

Pasting `<svg><path d="..." /></svg>` inside a feature component mixes raw visual data with layout, kills reuse, and makes icon swaps a find-and-replace hazard.

```tsx
// ❌ Bad — inline SVG, defined locally
const lightbulbIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707..." />
  </svg>
);
const GuideCard = () => <div>{lightbulbIcon} 가이드</div>;

// ❌ Bad — scattered per-icon files with no shared surface
// app/components/ui/LightbulbIcon.tsx
// app/components/ui/ChevronDownIcon.tsx
// app/components/ui/WarningIcon.tsx
// Each consumer guesses the path and re-invents props.

// ✅ Good — single icon module with a uniform API
// app/components/ui/icons/index.ts
export { GuideIcon } from './GuideIcon';
export { ExpandIcon } from './ExpandIcon';
export { WarningIcon } from './WarningIcon';

// app/components/ui/icons/GuideIcon.tsx
interface IconProps {
  className?: string;
  'aria-label'?: string;
}
export const GuideIcon = ({ className, ...rest }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={!rest['aria-label']} {...rest}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
  </svg>
);

// Consumer
import { GuideIcon } from '@/app/components/ui/icons';
<GuideIcon className="w-3.5 h-3.5" />
```

**Why a module (not per-file)**:

- One import path (`@/app/components/ui/icons`), one uniform props contract (`IconProps`)
- Swapping a design system (e.g., adopting lucide-react or heroicons) is a one-file change in `icons/index.ts`
- ESLint/grep for "which icon lives where" is trivial

**When inline is OK**: truly one-off brand assets (full-page logos, hero illustrations) that are unambiguously not icons.

**ESLint**: custom `no-restricted-syntax` matching `JSXElement[openingElement.name.name='svg']` outside `app/components/ui/icons/**`.
