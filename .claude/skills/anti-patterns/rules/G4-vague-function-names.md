# G4. Non-verb or vague function names

Severity: 🟢 nice-to-have

```tsx
// ❌ Bad
const fetch = async () => …;   // fetch what?
const poll = async () => …;    // poll what?
const handle = () => …;        // handle what?

// ✅ Good
const fetchTestConnectionHistory = async () => …;
const pollProcessStatus = async () => …;
const handleApproveClick = () => …;
```

See also: **G7** (vague parameter names) and **G8** (inconsistent sibling naming). G4 covers top-level function names; G7 covers callback parameters; G8 covers intra-cluster consistency.
