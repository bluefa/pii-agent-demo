/**
 * 라벨 상수 모음
 *
 * UI에서 사용되는 라벨, 에러 메시지, 상태 텍스트 등을 중앙에서 관리합니다.
 */

import { ProcessStatus, ConnectionStatus, AwsResourceType, AzureResourceType, GcpResourceType, ResourceType, CloudProvider } from '@/lib/types';

/**
 * 연결 에러 타입 라벨
 */
export const ERROR_TYPE_LABELS: Record<string, string> = {
  AUTH_FAILED: '인증 실패',
  PERMISSION_DENIED: '권한 부족',
  NETWORK_ERROR: '네트워크 오류',
  TIMEOUT: '연결 타임아웃',
  UNKNOWN_ERROR: '알 수 없는 오류',
};

/**
 * 프로세스 상태 라벨
 */
export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  [ProcessStatus.WAITING_TARGET_CONFIRMATION]: '연동 대상 확정 대기',
  [ProcessStatus.WAITING_APPROVAL]: '승인 대기',
  [ProcessStatus.APPLYING_APPROVED]: '연동대상 반영 중',
  [ProcessStatus.INSTALLING]: '설치 진행 중',
  [ProcessStatus.WAITING_CONNECTION_TEST]: '연결 테스트 필요',
  [ProcessStatus.CONNECTION_VERIFIED]: '연결 확인 완료',
  [ProcessStatus.INSTALLATION_COMPLETE]: '설치 완료',
};

/**
 * 연결 상태 설정
 */
export const CONNECTION_STATUS_CONFIG: Record<ConnectionStatus, {
  label: string;
  className: string;
  icon: string;
}> = {
  CONNECTED: {
    label: '연결됨',
    className: 'text-green-500',
    icon: '●',
  },
  DISCONNECTED: {
    label: '연결 끊김',
    className: 'text-red-500',
    icon: '●',
  },
  PENDING: {
    label: '대기중',
    className: 'text-gray-400',
    icon: '○',
  },
};

/**
 * AWS 리전 라벨
 */
export const REGION_LABELS: Record<string, string> = {
  'ap-northeast-2': '서울 (ap-northeast-2)',
  'ap-northeast-1': '도쿄 (ap-northeast-1)',
  'us-east-1': '버지니아 (us-east-1)',
  'us-west-2': '오레곤 (us-west-2)',
};

/**
 * 리전 코드로 라벨을 가져옵니다. 없으면 코드를 그대로 반환합니다.
 */
export const getRegionLabel = (region: string): string => {
  return REGION_LABELS[region] || region;
};

/**
 * 에러 타입으로 라벨을 가져옵니다. 없으면 기본 메시지를 반환합니다.
 */
export const getErrorTypeLabel = (errorType: string): string => {
  return ERROR_TYPE_LABELS[errorType] || '알 수 없는 오류';
};

/**
 * 프로세스 상태로 라벨을 가져옵니다.
 */
export const getProcessStatusLabel = (status: ProcessStatus): string => {
  return PROCESS_STATUS_LABELS[status] || '알 수 없는 상태';
};

/**
 * AWS 리전 타입 라벨
 */
export const AWS_REGION_TYPE_LABELS: Record<'global' | 'china', string> = {
  global: 'Global',
  china: 'China',
};

/**
 * 프로바이더별 필드 라벨
 */
export const PROVIDER_FIELD_LABELS: Record<string, Record<string, string>> = {
  AWS: {
    accountId: 'AWS Account ID',
    regionType: '리전 타입',
  },
  Azure: {
    tenantId: 'Tenant ID',
    subscriptionId: 'Subscription ID',
  },
  GCP: {
    projectId: 'GCP Project ID',
  },
};

/**
 * 프로바이더 설명 (프로바이더 선택 카드용)
 */
export const PROVIDER_DESCRIPTIONS: Record<CloudProvider, string> = {
  AWS: 'Amazon Web Services 환경의 RDS, DynamoDB 등 데이터 리소스를 자동 스캔합니다.',
  Azure: 'Microsoft Azure 클라우드 환경의 데이터베이스 리소스를 스캔하고 PII Agent를 연동합니다.',
  GCP: 'Google Cloud Platform의 Cloud SQL, BigQuery 등 데이터 리소스를 관리합니다.',
  IDC: '온프레미스 데이터센터의 데이터베이스 리소스를 수동 등록하여 관리합니다.',
  SDU: '삼성 SDS 데이터 유니버스 환경의 데이터 리소스를 연동합니다.',
};

/**
 * AWS 리소스 타입 라벨
 */
export const AWS_RESOURCE_TYPE_LABELS: Record<AwsResourceType, string> = {
  RDS: 'RDS',
  RDS_CLUSTER: 'RDS Cluster',
  DOCUMENTDB: 'DocumentDB',
  DYNAMODB: 'DynamoDB',
  ATHENA: 'Athena',
  REDSHIFT: 'Redshift',
  EC2: 'EC2',
};

/**
 * AWS 리소스 타입 정렬 순서 (EC2는 항상 마지막)
 */
export const AWS_RESOURCE_TYPE_ORDER: AwsResourceType[] = [
  'RDS',
  'RDS_CLUSTER',
  'DOCUMENTDB',
  'REDSHIFT',
  'DYNAMODB',
  'ATHENA',
  'EC2',
];

export const AZURE_RESOURCE_TYPE_LABELS: Record<AzureResourceType, string> = {
  AZURE_MSSQL: 'Azure SQL Database',
  AZURE_POSTGRESQL: 'Azure Database for PostgreSQL',
  AZURE_MYSQL: 'Azure Database for MySQL',
  AZURE_MARIADB: 'Azure Database for MariaDB',
  AZURE_COSMOS_NOSQL: 'Azure Cosmos DB',
  AZURE_SYNAPSE: 'Azure Synapse Analytics',
  AZURE_VM: 'Azure Virtual Machine',
};

export const AZURE_RESOURCE_TYPE_ORDER: AzureResourceType[] = [
  'AZURE_MSSQL', 'AZURE_POSTGRESQL', 'AZURE_MYSQL',
  'AZURE_MARIADB', 'AZURE_COSMOS_NOSQL', 'AZURE_SYNAPSE', 'AZURE_VM',
];

export const GCP_RESOURCE_TYPE_LABELS: Record<GcpResourceType, string> = {
  CLOUD_SQL: 'Cloud SQL',
  BIGQUERY: 'BigQuery',
};

export const GCP_RESOURCE_TYPE_ORDER: GcpResourceType[] = ['CLOUD_SQL', 'BIGQUERY'];

export const getResourceTypeLabel = (type: ResourceType): string => {
  if (type in AWS_RESOURCE_TYPE_LABELS) return AWS_RESOURCE_TYPE_LABELS[type as AwsResourceType];
  if (type in AZURE_RESOURCE_TYPE_LABELS) return AZURE_RESOURCE_TYPE_LABELS[type as AzureResourceType];
  if (type in GCP_RESOURCE_TYPE_LABELS) return GCP_RESOURCE_TYPE_LABELS[type as GcpResourceType];
  return type;
};

export const RESOURCE_TYPE_ORDER_BY_PROVIDER: Partial<Record<CloudProvider, ResourceType[]>> = {
  AWS: AWS_RESOURCE_TYPE_ORDER,
  Azure: AZURE_RESOURCE_TYPE_ORDER,
  GCP: GCP_RESOURCE_TYPE_ORDER,
};

