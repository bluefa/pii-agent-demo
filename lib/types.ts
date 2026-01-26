// ===== Enums & Constants =====

export enum ProcessStatus {
  WAITING_TARGET_CONFIRMATION = 1,  // 연동 대상 확정 대기
  WAITING_APPROVAL = 2,              // 승인 대기
  INSTALLING = 3,                    // 설치 진행 중
  WAITING_CONNECTION_TEST = 4,       // 연결 테스트 필요
  INSTALLATION_COMPLETE = 5          // 설치 완료
}

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NEW';

export type TerraformStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';

export type UserRole = 'SERVICE_MANAGER' | 'ADMIN';

export type CloudProvider = 'AWS' | 'IDC';

export type AwsResourceType = 'RDS' | 'RDS_CLUSTER' | 'DYNAMODB' | 'ATHENA' | 'REDSHIFT';

export type AwsRegion =
  | 'ap-northeast-2'
  | 'ap-northeast-1'
  | 'us-east-1'
  | 'us-west-2'
  | string;

export type ResourceLifecycleStatus =
  | 'DISCOVERED'        // 스캔됨(기본)
  | 'TARGET'            // 연동 대상으로 선택됨
  | 'PENDING_APPROVAL'  // 승인 요청 진행중
  | 'INSTALLING'        // 설치 진행중
  | 'READY_TO_TEST'     // 연결 테스트 필요 단계 대응
  | 'ACTIVE';           // 설치/연결 완료

// ===== Core Entities =====

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  serviceCodePermissions: string[];
}

export interface ServiceCode {
  code: string;
  name: string;
  description?: string;
}

export interface Resource {
  id: string;
  type: string;
  resourceId: string;
  connectionStatus: ConnectionStatus;
  isSelected: boolean;


  // --- 추가 (AWS 표시/상태 확장용) ---
  awsType?: AwsResourceType;              // AWS일 때만
  region?: AwsRegion;                     // AWS일 때만
  lifecycleStatus: ResourceLifecycleStatus; // UI 상태(필수)
  isNew?: boolean;                        // NEW 라벨 고정용(선택)
  note?: string;                          // 비고(선택)
}

export interface TerraformState {
  serviceTf: TerraformStatus;
  bdcCommonTf: TerraformStatus;
  bdcServiceTf: TerraformStatus;
}

export interface Project {
  id: string;
  projectCode: string;
  serviceCode: string;
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
  resources: Resource[];
  terraformState: TerraformState;
  createdAt: string;
  updatedAt: string;

  name: string;
  description: string;
}

// ===== API Response Types =====

export interface ProjectSummary {
  id: string;
  projectCode: string;
  processStatus: ProcessStatus;
  cloudProvider: CloudProvider;
  resourceCount: number;
  hasDisconnected: boolean;
  hasNew: boolean;
}

export interface ErrorResponse {
  error: string;
  message: string;
}
