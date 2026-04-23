# G1. Magic numbers

Severity: 🟡 important

```tsx
// ❌ Bad
setInterval(poll, 10_000);
setTimeout(() => setCopied(false), 1500);

// ✅ Good
// lib/constants/timings.ts
export const TIMINGS = {
  PROCESS_STATUS_POLL_MS: 10_000,
  COPY_FEEDBACK_MS: 1500,
  TOAST_HIDE_MS: 2000,
} as const;
```
