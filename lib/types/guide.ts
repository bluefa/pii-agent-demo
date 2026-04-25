/**
 * Guide CMS — type system for identity, placement, and stored content.
 *
 * Spec: docs/reports/guide-cms/spec.md §3.
 */

export const GUIDE_NAMES = [
  // AWS (8) — AUTO/MANUAL share every step except step 4.
  'AWS_TARGET_CONFIRM',
  'AWS_APPROVAL_PENDING',
  'AWS_APPLYING',
  'AWS_AUTO_INSTALLING',
  'AWS_MANUAL_INSTALLING',
  'AWS_CONNECTION_TEST',
  'AWS_ADMIN_APPROVAL',
  'AWS_COMPLETED',
  // AZURE (7)
  'AZURE_TARGET_CONFIRM',
  'AZURE_APPROVAL_PENDING',
  'AZURE_APPLYING',
  'AZURE_INSTALLING',
  'AZURE_CONNECTION_TEST',
  'AZURE_ADMIN_APPROVAL',
  'AZURE_COMPLETED',
  // GCP (7)
  'GCP_TARGET_CONFIRM',
  'GCP_APPROVAL_PENDING',
  'GCP_APPLYING',
  'GCP_INSTALLING',
  'GCP_CONNECTION_TEST',
  'GCP_ADMIN_APPROVAL',
  'GCP_COMPLETED',
] as const;

export type GuideName = (typeof GUIDE_NAMES)[number];

/**
 * Placement describes where a guide appears. Current scope uses only
 * `process-step`; other kinds reserve the extension surface.
 */
export type GuidePlacement =
  | {
      kind: 'process-step';
      provider: 'AWS' | 'AZURE' | 'GCP';
      variant?: 'AUTO' | 'MANUAL';
      step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      stepLabel: string;
    }
  | { kind: 'side-panel'; surface: string }
  | { kind: 'tooltip'; surface: string; field: string }
  | { kind: 'faq'; section: string; order: number };

export interface GuideSlot {
  guideName: GuideName;
  placement: GuidePlacement;
  component: 'GuideCard' | 'TooltipGuide' | 'SidePanelGuide';
}

export interface GuideContents {
  ko: string;
  en: string;
}

/**
 * Stored guide detail. `updatedAt` is ISO 8601 and always non-null.
 * Drift case (registry name with no store entry) uses the epoch
 * `'1970-01-01T00:00:00Z'` rather than null — Swagger contract mandates
 * a non-null date-time.
 */
export interface GuideDetail {
  name: GuideName;
  contents: GuideContents;
  updatedAt: string;
}

export interface GuideUpdateInput {
  contents: GuideContents;
}
