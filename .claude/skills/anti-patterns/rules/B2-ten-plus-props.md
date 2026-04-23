# B2. 10+ props

Severity: 🟡 important

Ten-plus props means runaway coupling — the child ends up knowing the parent's internal state.

```tsx
// ❌ Bad
<ResourceTable
  externalSelectedIds={...} onSelectionChange={...}
  credentials={...} onCredentialChange={...}
  expandedVmId={...} onVmConfigToggle={...} onVmConfigSave={...}
  onEditModeChange={...} onRequestApproval={...}
  /* +10 more */
/>

// ✅ Good — split via Context
<TableSelectionProvider>
  <TableEditModeProvider>
    <ResourceTable />
  </TableEditModeProvider>
</TableSelectionProvider>
```
