# C8. Missing lazy initializer in `useState`

Severity: 🟢 nice-to-have

Expensive initial values need a lazy initializer.

```tsx
// ❌ Bad — JSON.parse on every render
const [state, setState] = useState(JSON.parse(localStorage.getItem('x') ?? '{}'));

// ✅ Good
const [state, setState] = useState(() => JSON.parse(localStorage.getItem('x') ?? '{}'));
```
