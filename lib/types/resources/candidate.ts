import type {
  ConfirmResourceMetadata,
  DatabaseType,
  IntegrationCategory,
  ResourceScanStatus,
  VmDatabaseConfig,
} from '@/lib/types';

export type CandidateConfigKind = 'none' | 'credential' | 'endpoint';
export type CandidateBehaviorKey = 'default' | 'credential' | 'endpoint';

export type EndpointConfigDraft = VmDatabaseConfig;

export interface CandidateResource {
  id: string;
  resourceId: string;
  /** Original `resource_name` from the `/resources` response; sent as the approval payload's resource_name. */
  resourceName: string;
  type: string;
  databaseType: DatabaseType;
  integrationCategory: IntegrationCategory;
  behaviorKey: CandidateBehaviorKey;
  /** Backend's default target choice from the `/resources` response. Seeds Step-1 selection. */
  selected: boolean;
  /** Reason attached to an already-excluded resource by the backend (null when none). */
  exclusionReason: string | null;
  /**
   * Why the scan judged this resource install-ineligible (`recommend_fail_reason`).
   * Null unless `integrationCategory === 'INSTALL_INELIGIBLE'`, and null for the
   * ineligible cases the enum does not cover (AWS, IDC).
   */
  recommendFailReason: string | null;
  endpointConfig?: EndpointConfigDraft;
  /** Step-1 scan-status tag — 직전 스캔 대비 본 리소스의 발견 상태 (신규/변경). */
  scanStatus?: ResourceScanStatus;
  metadata: ConfirmResourceMetadata;
}
