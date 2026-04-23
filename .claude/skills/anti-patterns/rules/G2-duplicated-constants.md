# G2. Duplicated constants

Severity: 🟡 important

The same constant (`CREDENTIAL_PREVIEW_COUNT = 3`, `COLLAPSE_THRESHOLD = 5`) defined in multiple files means every change risks a skipped site.

→ centralize in `lib/constants/ui.ts`.
