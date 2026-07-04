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
  /** `/resources` 응답의 원본 `resource_name`. 승인 요청 payload의 resource_name 으로 사용. */
  resourceName: string;
  type: string;
  databaseType: DatabaseType;
  integrationCategory: IntegrationCategory;
  behaviorKey: CandidateBehaviorKey;
  endpointConfig?: EndpointConfigDraft;
  /** Step-1 scan-status tag — 직전 스캔 대비 본 리소스의 발견 상태 (신규/변경). */
  scanStatus?: ResourceScanStatus;
  metadata: ConfirmResourceMetadata;
}
