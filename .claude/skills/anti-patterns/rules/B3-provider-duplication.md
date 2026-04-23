# B3. Per-provider component duplication (Shotgun Surgery)

Severity: 🟡 important

Don't ship 3-4 nearly identical components for AWS/GCP/Azure/IDC.

```
❌ AwsInstallationInline.tsx (419 LOC)
❌ GcpInstallationInline.tsx (similar)
❌ AzureInstallationInline.tsx (similar)

✅ <InstallationInline provider={...} config={...} />
   + providers/{aws,gcp,azure}/config.ts  (only the deltas)
```
