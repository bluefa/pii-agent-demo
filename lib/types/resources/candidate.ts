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
  type: string;
  databaseType: DatabaseType;
  integrationCategory: IntegrationCategory;
  behaviorKey: CandidateBehaviorKey;
  endpointConfig?: EndpointConfigDraft;
  metadata: ConfirmResourceMetadata;
}
