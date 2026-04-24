import type {
  ConfirmResourceMetadata,
  DatabaseType,
  IntegrationCategory,
  VmDatabaseConfig,
} from '@/lib/types';
import type { AzureVmNic } from '@/lib/types/azure';

export type CandidateConfigKind = 'none' | 'credential' | 'endpoint';
export type CandidateBehaviorKey = 'default' | 'credential' | 'endpoint';

export type EndpointConfigDraft = VmDatabaseConfig;

export interface CandidateResource {
  id: string;
  resourceId: string;
  type: string;
  databaseType: DatabaseType;
  integrationCategory: IntegrationCategory;
  selectedCredentialId?: string;
  configKind: CandidateConfigKind;
  behaviorKey: CandidateBehaviorKey;
  endpointConfig?: EndpointConfigDraft;
  networkInterfaces?: AzureVmNic[];
  metadata: ConfirmResourceMetadata;
  connectionStatus: 'PENDING';
}
