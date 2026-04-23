# F2. `try/catch` silent swallow

Severity: 🟡 important

```tsx
// ❌ Bad
try { await fetch(); } catch {}
try { await fetch(); } catch { console.log('fail'); }

// ✅ Good
try {
  await fetch();
} catch (err) {
  logger.error('fetch failed', { err });
  setError(err instanceof Error ? err : new Error(String(err)));
}
```
