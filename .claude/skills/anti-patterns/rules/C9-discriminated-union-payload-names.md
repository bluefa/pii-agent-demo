# C9. Discriminated union variants with inconsistent payload field names

Severity: 🟡 important

When variants carry the **same entity** (e.g., the row being acted on), use the **same field name** across variants. Mixing `item` in one variant and `target` in another forces every reader to reopen the type to decide which field to destructure, and invites bugs when a handler copied from one variant is pasted into another.

```ts
// ❌ Bad — same entity, different field names per variant
type ModalState =
  | { type: 'none' }
  | { type: 'reject';   item: ApprovalRequestQueueItem }
  | { type: 'detail';   item: ApprovalRequestQueueItem }
  | { type: 'approve';  target: ApprovalRequestQueueItem };  // why 'target' here?

// Callers must branch on the name, not just the type:
if (modal.type === 'approve') use(modal.target);
if (modal.type === 'reject')  use(modal.item);

// ✅ Good — one payload name, one mental model
type ModalState =
  | { type: 'none' }
  | { type: 'reject';  item: ApprovalRequestQueueItem }
  | { type: 'detail';  item: ApprovalRequestQueueItem }
  | { type: 'approve'; item: ApprovalRequestQueueItem };
```

**Rule of thumb**: if two variants carry the same type, they should use the same field name. A divergent field name is a signal the payload is actually different — rename only when the role truly differs (`source` vs `target` in a copy operation, for instance).

Related: **C3** (scattered modal state) — the discriminated-union refactor that fixes C3 introduces C9 risk if payloads aren't normalized.
