# C5. Derived state stored as state

Severity: 🟡 important

Values computable from props/state shouldn't live in useState — sync bugs follow.

```tsx
// ❌ Bad
const [fullName, setFullName] = useState(`${user.firstName} ${user.lastName}`);

// ✅ Good
const fullName = `${user.firstName} ${user.lastName}`;  // compute on render
// or useMemo(…, [user.firstName, user.lastName])
```
