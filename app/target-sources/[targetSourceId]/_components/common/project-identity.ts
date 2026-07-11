import type { CloudProvider } from '@/lib/types';

/**
 * One public identifier record for the cloud account that a TargetSource
 * points to — AWS Account ID, Azure Subscription/Tenant ID, GCP Project ID,
 * etc. Distinct from the SecretKey credential.
 */
export interface TargetSourceIdentifier {
  label: string;
  value: string | null;
  /** When true, render the value with mono font and reveal a copy button on hover. */
  mono?: boolean;
}

export interface ProjectIdentity {
  cloudProvider: CloudProvider;
  /** e.g. "AWS Agent", "Azure Agent", "SDU" */
  monitoringMethod: string;
  /** Jira ticket URL. The chip is not rendered when null or undefined. */
  jiraLink?: string | null;
  /** Provider-specific public identifiers (account id, subscription id, tenant id, project id, ...). */
  identifiers: TargetSourceIdentifier[];
}
