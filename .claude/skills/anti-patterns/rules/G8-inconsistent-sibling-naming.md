# G8. Inconsistent naming convention within a sibling cluster

Severity: 🟡 important

A "sibling cluster" is a set of variables/fields that serve the same role in the same scope — all callback refs in a hook, all error variables in a validator, all modal states in a component. When one sibling breaks the cluster's convention, the reader loses the "I can skim this group" property and has to re-read each name to find out what's different.

```ts
// ❌ Bad — three role-noun refs, one Fn-suffix ref
const fetchRef    = useRef(fetchOnce);
const updateRef   = useRef(onUpdate);
const completeRef = useRef(onComplete);
const stopFnRef   = useRef(shouldStop);   // odd one out — Fn suffix

// ✅ Good — every ref is named by role
const fetchRef      = useRef(fetchOnce);
const updateRef     = useRef(onUpdate);
const completeRef   = useRef(onComplete);
const shouldStopRef = useRef(shouldStop); // predicate-style role name
```

```ts
// ❌ Bad — three full field names, one abbreviation
const nameErr = validateName(state.name);
const hostErr = validateHost(state.host);
const portErr = validatePort(state.port);
const sidErr  = validateServiceId(state.serviceId);  // 'sid' ≠ the field 'serviceId'

// ✅ Good — suffix derived from the field, consistently
const nameErr      = validateName(state.name);
const hostErr      = validateHost(state.host);
const portErr      = validatePort(state.port);
const serviceIdErr = validateServiceId(state.serviceId);
```

**Rule of thumb**: pick a rule per cluster ("ref name = role-noun + Ref", "local err var = fieldName + Err") and apply it to *every* member. If one sibling can't follow the rule, the rule is probably wrong — change it for all, not for one.

Related: **G4** (non-verb function names) and **G7** (vague parameter names). G8 is specifically about *consistency inside one group*, even when each individual name is acceptable in isolation.
