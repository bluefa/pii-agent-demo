# C3. Scattered modal state

Severity: 🟡 important

```tsx
// ❌ Bad
const [rejectModalOpen, setRejectModalOpen] = useState(false);
const [detailModalOpen, setDetailModalOpen] = useState(false);
const [approveModalOpen, setApproveModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);
const [approveTarget, setApproveTarget] = useState(null);

// ✅ Good — discriminated union
type ModalState =
  | { type: 'none' }
  | { type: 'reject'; item: Item }
  | { type: 'detail'; item: Item }
  | { type: 'approve'; item: Item };
const [modal, setModal] = useState<ModalState>({ type: 'none' });
```

See also: **C9** — the discriminated union's payload field names must stay consistent across variants carrying the same entity.
