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
  /** Provider-specific public identifiers (account id, subscription id, tenant id, project id, ...). */
  identifiers: TargetSourceIdentifier[];
  /**
   * AWS 설치 모드 (metadata.grant_service_terraform_execution_permission).
   * auto = BDC installs via delegated Terraform, manual = the customer runs the
   * install script. Omitted when the provider has no such concept — the header
   * hides the row entirely.
   */
  installMode?: 'auto' | 'manual';
}
