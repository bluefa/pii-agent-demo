# B5. Functions with 4+ parameters

Severity: 🟢 nice-to-have

Bundle them into an object. Component props already do this — apply the same rule to plain functions.

```ts
// ❌ Bad
fetchData(tab, page, type, query);

// ✅ Good
fetchData({ tab, page, type, query });
```
