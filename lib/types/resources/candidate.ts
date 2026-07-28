import type {
  ConfirmResourceMetadata,
  DatabaseType,
  IntegrationCategory,
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
  endpointConfig?: EndpointConfigDraft;
  metadata: ConfirmResourceMetadata;
}
