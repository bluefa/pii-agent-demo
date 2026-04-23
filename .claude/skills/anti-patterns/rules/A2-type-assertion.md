# A2. Type assertion (`as`, especially `as unknown as X`)

Severity: 🔴 critical

Lies to the type checker. External inputs (API responses, `JSON.parse`) need runtime validation.

```tsx
// ❌ Bad
return undefined as T;
const data = await res.json() as ApiResponse;

// ✅ Good
return undefined;  // change return type to `T | undefined`
const raw = await res.json();
const data = ApiResponseSchema.parse(raw);  // zod / valibot
```

**ESLint**: `@typescript-eslint/consistent-type-assertions`
