import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type { MockResource } from '@/lib/types';

/**
 * Real-BFF AWS response capture (owner-provided, 2026-07-30). These are the seed
 * values for every AWS demo target source — the mock no longer fabricates host /
 * port / resource_name / credential for AWS, because fabricated values hide every
 * cell that actually arrives empty.
 *
 * Two captures, from two accounts, seeding the two halves of the lifecycle:
 * - `confirmed-integration` (804656952396) → the confirmed set, used by the
 *   post-approval steps (설치 · 연결 테스트 · 완료 승인 · 완료).
 * - `approval-requests/latest` (451814760281) → the scan candidate set, used by
 *   the pre-approval steps (대상 선택 · 승인 대기).
 *
 * What the capture makes visible that the synthesized mocks did not:
 * - `installation-status` rows for Athena are **region-level** ids
 *   (`athena:<acct>:<region>/AwsDataCatalog`) while `confirmed-integration` rows
 *   are **database-level** (`athena:<acct>:<region>:AwsDataCatalog/<db>`), so a
 *   plain resource_id join leaves Database Type / Region blank for Athena.
 * - `host` is `""` (RDS) or `null` (Athena), `port`/`credential_id` are null.
 * - `terraform_execution_role_verify.role_arn` is null while IN_PROGRESS.
 * - approval items carry `resource_type: null` and a metadata block whose
 *   host/port/region-specific fields are null.
 * - the approval request reported `resource_total_count` 23 for 9 returned rows.
 * - timestamps arrive with nanosecond precision and, on the approval request,
 *   with **no timezone offset**.
 */

/** 설치 진행(Step 4) 대상 — installation-status 캡처를 그대로 서빙한다. */
export const AWS_WIRE_INSTALL_TARGET_SOURCE_ID = 1008;

export const isAwsWireInstallSample = (targetSourceId: number): boolean =>
  targetSourceId === AWS_WIRE_INSTALL_TARGET_SOURCE_ID;

/** 확정 정보 캡처 계정. */
export const AWS_WIRE_CONFIRMED_ACCOUNT_ID = '804656952396';
/** 승인 요청 캡처 계정. */
export const AWS_WIRE_APPROVAL_ACCOUNT_ID = '451814760281';

const ACCOUNT_ID = AWS_WIRE_CONFIRMED_ACCOUNT_ID;

// GET …/aws/installation-status
export const awsWireSampleInstallationStatus: z.infer<
  typeof schemas.AwsInstallationStatusResponse
> = {
  last_check: {
    status: 'IN_PROGRESS',
    checked_at: '2026-07-30T05:46:38.414200987Z',
    fail_reason: null,
    installation_status_unavailable: false,
  },
  resources: [
    {
      resource_id: `arn:aws:rds:ap-northeast-2:${ACCOUNT_ID}:cluster:rds-aurora-dip-stg-ap-northeast`,
      resource_name: 'rds-aurora-dip-stg-ap-northeast',
      installation_status: 'IN_PROGRESS',
      service_terraform: { status: 'IN_PROGRESS', guide: null },
      bdc_service_terraform: { status: 'IN_PROGRESS', guide: null },
      bdc_common_terraform: { status: 'IN_PROGRESS', guide: null },
    },
    {
      resource_id: `arn:aws:rds:ap-northeast-2:${ACCOUNT_ID}:cluster:database-1`,
      resource_name: 'database-1',
      installation_status: 'IN_PROGRESS',
      service_terraform: { status: 'IN_PROGRESS', guide: null },
      bdc_service_terraform: { status: 'IN_PROGRESS', guide: null },
      bdc_common_terraform: { status: 'IN_PROGRESS', guide: null },
    },
    {
      resource_id: `arn:aws:rds:ap-northeast-2:${ACCOUNT_ID}:cluster:rds-aurora-dip-stg-ap-northeast-2`,
      resource_name: 'rds-aurora-dip-stg-ap-northeast-2',
      installation_status: 'IN_PROGRESS',
      service_terraform: { status: 'IN_PROGRESS', guide: null },
      bdc_service_terraform: { status: 'IN_PROGRESS', guide: null },
      bdc_common_terraform: { status: 'IN_PROGRESS', guide: null },
    },
    {
      resource_id: `athena:${ACCOUNT_ID}:us-east-1/AwsDataCatalog`,
      resource_name: 'us-east-1',
      installation_status: 'IN_PROGRESS',
      service_terraform: { status: 'COMPLETED', guide: null },
      bdc_service_terraform: { status: 'IN_PROGRESS', guide: null },
      bdc_common_terraform: { status: 'IN_PROGRESS', guide: null },
    },
    {
      resource_id: `athena:${ACCOUNT_ID}:ap-northeast-1/AwsDataCatalog`,
      resource_name: 'ap-northeast-1',
      installation_status: 'IN_PROGRESS',
      service_terraform: { status: 'COMPLETED', guide: null },
      bdc_service_terraform: { status: 'IN_PROGRESS', guide: null },
      bdc_common_terraform: { status: 'IN_PROGRESS', guide: null },
    },
  ],
  terraform_execution_role_verify: { status: 'IN_PROGRESS', role_arn: null },
};

// GET …/confirmed-integration — 확정 리소스 seed 의 원본.
export const awsWireSampleConfirmedIntegration: z.infer<
  typeof schemas.ConfirmedIntegrationResponse
> = {
  resource_infos: [
    {
      resource_id: `arn:aws:rds:ap-northeast-2:${ACCOUNT_ID}:cluster:rds-aurora-dip-stg-ap-northeast`,
      resource_type: 'AWS_DB_CLUSTER',
      database_type: 'mysql',
      port: 3306,
      host: '',
      oracle_service_id: null,
      network_interface_id: null,
      ip_configuration: null,
      credential_id: null,
      database_region: 'ap-northeast-2',
      resource_name: 'rds-aurora-dip-stg-ap-northeast',
      agent_id: '75e20b2f-b3bc-4aef-a01d-d8c6e0afd020',
      athena_region_resource_id: null,
      protocol: null,
      secret_info: null,
      db_target_ip_list: null,
      public_domain_name_list: null,
      private_domain_name_list: null,
      idc_host_format: null,
      idc_ips: null,
      idc_host: null,
      idc_source_ips: null,
      nlb_index: null,
    },
    {
      resource_id: `arn:aws:rds:ap-northeast-2:${ACCOUNT_ID}:cluster:database-1`,
      resource_type: 'AWS_DB_CLUSTER',
      database_type: 'mysql',
      port: 3306,
      host: '',
      oracle_service_id: null,
      network_interface_id: null,
      ip_configuration: null,
      credential_id: null,
      database_region: 'ap-northeast-2',
      resource_name: 'database-1',
      agent_id: '1181947a-1f98-420b-8882-f0e09b00248d',
      athena_region_resource_id: null,
      protocol: null,
      secret_info: null,
      db_target_ip_list: null,
      public_domain_name_list: null,
      private_domain_name_list: null,
      idc_host_format: null,
      idc_ips: null,
      idc_host: null,
      idc_source_ips: null,
      nlb_index: null,
    },
    {
      resource_id: `arn:aws:rds:ap-northeast-2:${ACCOUNT_ID}:cluster:rds-aurora-dip-stg-ap-northeast-2`,
      resource_type: 'AWS_DB_CLUSTER',
      database_type: 'mysql',
      port: 3306,
      host: '',
      oracle_service_id: null,
      network_interface_id: null,
      ip_configuration: null,
      credential_id: null,
      database_region: 'ap-northeast-2',
      resource_name: 'rds-aurora-dip-stg-ap-northeast-2',
      agent_id: '4c7be81e-037a-43c1-be40-9bb3384b94c8',
      athena_region_resource_id: null,
      protocol: null,
      secret_info: null,
      db_target_ip_list: null,
      public_domain_name_list: null,
      private_domain_name_list: null,
      idc_host_format: null,
      idc_ips: null,
      idc_host: null,
      idc_source_ips: null,
      nlb_index: null,
    },
    {
      resource_id: `athena:${ACCOUNT_ID}:us-east-1:AwsDataCatalog/default`,
      resource_type: 'AWS_ATHENA_DATABASE',
      database_type: 'athena',
      port: null,
      host: null,
      oracle_service_id: null,
      network_interface_id: null,
      ip_configuration: null,
      credential_id: null,
      database_region: 'us-east-1',
      resource_name: 'default',
      agent_id: '31353335-6174-6875-7365-310000000000',
      athena_region_resource_id: `athena:${ACCOUNT_ID}:us-east-1/AwsDataCatalog`,
      protocol: null,
      secret_info: null,
      db_target_ip_list: null,
      public_domain_name_list: null,
      private_domain_name_list: null,
      idc_host_format: null,
      idc_ips: null,
      idc_host: null,
      idc_source_ips: null,
      nlb_index: null,
    },
    {
      resource_id: `athena:${ACCOUNT_ID}:ap-northeast-1:AwsDataCatalog/sampledb`,
      resource_type: 'AWS_ATHENA_DATABASE',
      database_type: 'athena',
      port: null,
      host: null,
      oracle_service_id: null,
      network_interface_id: null,
      ip_configuration: null,
      credential_id: null,
      database_region: 'ap-northeast-1',
      resource_name: 'sampledb',
      agent_id: '31353335-6174-6861-706e-653100000000',
      athena_region_resource_id: `athena:${ACCOUNT_ID}:ap-northeast-1/AwsDataCatalog`,
      protocol: null,
      secret_info: null,
      db_target_ip_list: null,
      public_domain_name_list: null,
      private_domain_name_list: null,
      idc_host_format: null,
      idc_ips: null,
      idc_host: null,
      idc_source_ips: null,
      nlb_index: null,
    },
    {
      resource_id: `athena:${ACCOUNT_ID}:ap-northeast-1:AwsDataCatalog/integration`,
      resource_type: 'AWS_ATHENA_DATABASE',
      database_type: 'athena',
      port: null,
      host: null,
      oracle_service_id: null,
      network_interface_id: null,
      ip_configuration: null,
      credential_id: null,
      database_region: 'ap-northeast-1',
      resource_name: 'integration',
      agent_id: '31353335-6174-6861-706e-653100000000',
      athena_region_resource_id: `athena:${ACCOUNT_ID}:ap-northeast-1/AwsDataCatalog`,
      protocol: null,
      secret_info: null,
      db_target_ip_list: null,
      public_domain_name_list: null,
      private_domain_name_list: null,
      idc_host_format: null,
      idc_ips: null,
      idc_host: null,
      idc_source_ips: null,
      nlb_index: null,
    },
    {
      resource_id: `athena:${ACCOUNT_ID}:ap-northeast-1:AwsDataCatalog/6lb_fulldump`,
      resource_type: 'AWS_ATHENA_DATABASE',
      database_type: 'athena',
      port: null,
      host: null,
      oracle_service_id: null,
      network_interface_id: null,
      ip_configuration: null,
      credential_id: null,
      database_region: 'ap-northeast-1',
      resource_name: '6lb_fulldump',
      agent_id: '31353335-6174-6861-706e-653100000000',
      athena_region_resource_id: `athena:${ACCOUNT_ID}:ap-northeast-1/AwsDataCatalog`,
      protocol: null,
      secret_info: null,
      db_target_ip_list: null,
      public_domain_name_list: null,
      private_domain_name_list: null,
      idc_host_format: null,
      idc_ips: null,
      idc_host: null,
      idc_source_ips: null,
      nlb_index: null,
    },
  ],
};

/**
 * 확정 리소스 seed — 설치 이후 단계(4·5·6·7) 대상이 그대로 쓴다.
 * host `''`·port/credential 없음까지 캡처 값 그대로 옮긴다.
 */
export const awsWireSampleResources: MockResource[] =
  awsWireSampleConfirmedIntegration.resource_infos!.map((info, index) => ({
    id: `res-wire-${index + 1}`,
    type: info.resource_type!,
    resourceId: info.resource_id!,
    resourceName: info.resource_name!,
    databaseType: info.database_type!,
    connectionStatus: 'PENDING',
    isSelected: true,
    awsType: info.resource_type === 'AWS_ATHENA_DATABASE' ? 'ATHENA' : 'RDS_CLUSTER',
    region: info.database_region!,
    integrationCategory: 'TARGET',
    host: info.host,
    port: info.port,
    athenaRegionResourceId: info.athena_region_resource_id,
  }));

/**
 * 승인 요청 캡처(GET …/approval-requests/latest)의 후보 리소스 9건 — 승인 전
 * 단계(대상 선택·승인 대기)의 seed. 23건 스캔 중 9건만 내려온 응답이라 엔진이
 * 섞여 있다(mongodb·mysql·mssql·redshift·dynamodb·athena). 캡처의 `selected`
 * 를 그대로 옮겨 1건만 연동 대상이다.
 */
const APPROVAL_ACCOUNT = AWS_WIRE_APPROVAL_ACCOUNT_ID;

const approvalCapture: ReadonlyArray<{
  selected: boolean;
  resourceId: string;
  resourceName: string;
  databaseType: string;
  awsType: MockResource['awsType'];
  type: string;
  region: string;
}> = [
  { selected: false, resourceId: `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT}:cluster:raw-mongo-deq-test-1`, resourceName: 'raw-mongo-deq-test-1', databaseType: 'mongodb', awsType: 'DOCUMENTDB', type: 'AWS_DB_CLUSTER', region: 'ap-northeast-2' },
  { selected: true, resourceId: `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT}:cluster:raw-e2e-test-mysql-cluster-cluster`, resourceName: 'raw-e2e-test-mysql-cluster-cluster', databaseType: 'mysql', awsType: 'RDS_CLUSTER', type: 'AWS_DB_CLUSTER', region: 'ap-northeast-2' },
  { selected: false, resourceId: `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT}:cluster:raw-test-cluster-deq-cluster`, resourceName: 'raw-test-cluster-deq-cluster', databaseType: 'mysql', awsType: 'RDS_CLUSTER', type: 'AWS_DB_CLUSTER', region: 'ap-northeast-2' },
  { selected: false, resourceId: `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT}:cluster:raw-test-cluster-dic-cluster`, resourceName: 'raw-test-cluster-dic-cluster', databaseType: 'mysql', awsType: 'RDS_CLUSTER', type: 'AWS_DB_CLUSTER', region: 'ap-northeast-2' },
  { selected: false, resourceId: `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT}:db:e2e-test-mssql`, resourceName: 'e2e-test-mssql', databaseType: 'mssql', awsType: 'RDS', type: 'AWS_DB_INSTANCE', region: 'ap-northeast-2' },
  { selected: false, resourceId: `arn:aws:redshift:ap-northeast-2:${APPROVAL_ACCOUNT}:namespace:2b7e5028-3b60-47c2-a621-0cf79ea0ad16`, resourceName: 'redshift-cluster-1', databaseType: 'redshift', awsType: 'REDSHIFT', type: 'AWS_REDSHIFT_CLUSTER', region: 'ap-northeast-2' },
  { selected: false, resourceId: `dynamodb:${APPROVAL_ACCOUNT}:ap-northeast-2`, resourceName: `dynamodb:${APPROVAL_ACCOUNT}:ap-northeast-2`, databaseType: 'dynamodb', awsType: 'DYNAMODB', type: 'AWS_DYNAMODB_REGION', region: 'ap-northeast-2' },
  { selected: false, resourceId: `dynamodb:${APPROVAL_ACCOUNT}:ap-northeast-1`, resourceName: `dynamodb:${APPROVAL_ACCOUNT}:ap-northeast-1`, databaseType: 'dynamodb', awsType: 'DYNAMODB', type: 'AWS_DYNAMODB_REGION', region: 'ap-northeast-1' },
  { selected: false, resourceId: `athena:${APPROVAL_ACCOUNT}:ap-northeast-2/AwsDataCatalog/test_raw`, resourceName: 'test_raw', databaseType: 'athena', awsType: 'ATHENA', type: 'AWS_ATHENA_DATABASE', region: 'ap-northeast-2' },
];

export const awsWireApprovalResources: MockResource[] = approvalCapture.map((row, index) => ({
  id: `res-wire-cand-${index + 1}`,
  type: row.type,
  resourceId: row.resourceId,
  resourceName: row.resourceName,
  databaseType: row.databaseType,
  connectionStatus: 'PENDING',
  isSelected: row.selected,
  awsType: row.awsType,
  region: row.region,
  integrationCategory: 'TARGET',
  // 캡처의 metadata 는 host/port/credential 이 전부 null 이다.
  host: null,
  port: null,
}));
