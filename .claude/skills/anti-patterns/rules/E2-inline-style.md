# E2. Inline style objects

Severity: 🟡 important

```tsx
// ❌ Bad — new object every render
<div style={{ width: `${percent}%` }} />

// ✅ Good — CSS variable
<div style={{ '--w': `${percent}%` } as CSSProperties} className="w-[var(--w)]" />
// or Tailwind arbitrary value
<div className={`w-[${percent}%]`} />
```
