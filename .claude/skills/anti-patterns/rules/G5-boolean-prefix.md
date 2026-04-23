# G5. Booleans without an `is/has/should/can` prefix

Severity: 🟢 nice-to-have

```ts
// ❌ Bad
interface Props {
  confirmed: boolean;
  success: boolean;
  firewallOpened: boolean;
}

// ✅ Good
interface Props {
  isConfirmed: boolean;
  hasSucceeded: boolean;
  isFirewallOpen: boolean;
}
```
