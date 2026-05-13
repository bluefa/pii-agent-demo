import type { ApprovedResource } from '@/lib/types/resources';
import type { ScanPillState } from '@/app/components/ui/ScanPill';

/**
 * Pick the scan-pill state for a Step 3 row.
 *
 * ApprovedIntegrationTable only receives approved (selected) resources;
 * ApprovedResource carries no `selected` field. The 'none' state is unused
 * here and lives on the shared ScanPill primitive for surfaces that mix
 * selected and excluded rows.
 *
 * Default is 'pending'. This helper is the hook point a future signal
 * source (terraform-status per resource or a new `integrated_at` response
 * field) plugs into. No such signal exists today, so every row is Pending.
 */
export const deriveScanPill = (resource: ApprovedResource): ScanPillState => {
  // Future signal source (terraform-status per resource or `integrated_at`)
  // will key off `resource`; today every row is Pending.
  void resource;
  return 'pending';
};
