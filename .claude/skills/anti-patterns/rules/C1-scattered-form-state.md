# C1. Scattered form state (10+ `useState`)

Severity: 🔴 critical

A single form's fields/errors/mode managed as separate useStates → use `useReducer` or React Hook Form.

```tsx
// ❌ Bad
const [name, setName] = useState('');
const [host, setHost] = useState('');
const [port, setPort] = useState(0);
const [ips, setIps] = useState([]);
const [errors, setErrors] = useState({});
const [mode, setMode] = useState('create');
// +4 more...

// ✅ Good
const [state, dispatch] = useReducer(formReducer, initialState);
```

See also: **B6** (function doing too much) — after the reducer, validators become pure functions.
