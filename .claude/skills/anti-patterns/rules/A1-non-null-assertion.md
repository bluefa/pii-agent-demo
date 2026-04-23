# A1. Non-null assertion (`!`)

Severity: 🔴 critical

`!` asserts "the type system is wrong". If it's wrong at runtime → crash.

```tsx
// ❌ Bad
const item = groups.get(type)!.push(resource);  // undefined.push() when key missing
const role = auth.user!.role;
const reason = r.exclusion!.reason;

// ✅ Good
const item = groups.get(type);
if (!item) return;
item.push(resource);

if (!auth.user) throw new Error('unauthenticated');
const role = auth.user.role;
```

**ESLint**: `@typescript-eslint/no-non-null-assertion: error`
