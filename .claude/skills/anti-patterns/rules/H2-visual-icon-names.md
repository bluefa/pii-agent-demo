# H2. Visual-based icon names

Severity: 🟡 important

Name icons by **intent**, not by **appearance**. Intent-based names survive design changes; visual-based names become lies the moment the icon is replaced with a different shape.

```tsx
// ❌ Bad — describes the picture
<LightbulbIcon />   // what is the lightbulb for?
<CheckIcon />       // checking off, or "correct"?
<XIcon />           // close, or "wrong"?
<ChevronDownIcon /> // menu, dropdown, collapse, or expand?

// ✅ Good — describes the role
<GuideIcon />       // a tip/guide cue (could be lightbulb, speech bubble, etc.)
<SuccessIcon />     // positive outcome
<CloseIcon />       // dismiss action
<ExpandIcon />      // open a collapsible section
```

**Rule of thumb**: if a designer swapped the SVG for a different glyph that conveys the same meaning, would the component name still be accurate? If not, rename.

**Exceptions**: brand/product icons (`AwsIcon`, `AzureIcon`, `GcpIcon`) are correctly visual — those *are* the brand.
