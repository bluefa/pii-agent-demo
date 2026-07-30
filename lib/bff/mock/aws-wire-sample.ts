import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type { MockResource } from '@/lib/types';

/**
 * Real-BFF AWS response capture (owner-provided, 2026-07-30), served verbatim for
 * one demo target source so the app is exercised against the wire as it actually
 * arrives — not against the mock's demo enrichment (which fabricates host/port/
 * resource_name/credential and therefore hides every empty cell).
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
 * - `resource_total_count` (23) is the full scan, not the returned page (9 rows).
 * - timestamps arrive with nanosecond precision and, on the approval request,
 *   with **no timezone offset**.
 */

/** 설치 진행 중(Step 4) 대상 — installation-status 캡처를 그대로 서빙한다. */
export const AWS_WIRE_SAMPLE_TARGET_SOURCE_ID = 1545;

/**
 * 같은 리소스 집합으로 나머지 단계를 보기 위한 대상 — 순서대로
 * [연결 테스트(5), 관리자 승인 대기(6), 완료(7), 대상 선택(1), 승인 대기(2), 반영중(3)].
 * installation-status 캡처는 단계와 모순되므로 이 대상들엔 서빙하지 않는다.
 */
export const AWS_WIRE_SAMPLE_STEP_TARGET_SOURCE_IDS = [1546, 1547, 1548, 1541, 1542, 1543] as const;

const SAMPLE_IDS: readonly number[] = [
  AWS_WIRE_SAMPLE_TARGET_SOURCE_ID,
  ...AWS_WIRE_SAMPLE_STEP_TARGET_SOURCE_IDS,
];

export const isAwsWireSample = (targetSourceId: number): boolean =>
  SAMPLE_IDS.includes(targetSourceId);

export const isAwsWireInstallSample = (targetSourceId: number): boolean =>
  targetSourceId === AWS_WIRE_SAMPLE_TARGET_SOURCE_ID;

const ACCOUNT_ID = '804656952396';

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

// GET …/confirmed-integration
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

// GET …/approval-requests/latest — the pre-approval candidate snapshot for this
// target source. Only 9 of the 23 scanned resources are returned by the BFF.
const APPROVAL_ACCOUNT_ID = '451814760281';

const approvalMetadata = (
  databaseType: string,
  region: string,
): NonNullable<z.infer<typeof schemas.TargetSourceResourceItemDto>['metadata']> => ({
  provider: 'AWS',
  region,
  host: null,
  port: null,
  networkInterfaces: null,
  resource_type: null,
  database_type: databaseType,
  oracle_service_id: null,
  credential_id: null,
  network_interface_id: null,
  ip_configuration: null,
  project_id: null,
  instance_name: null,
  host_network: null,
  host_project: null,
  cloud_sql_type: null,
  subscription_id: null,
  resource_group: null,
  server_name: null,
  idc_host_format: null,
  idc_ips: null,
  idc_host: null,
  idc_source_ips: null,
  nlb_index: null,
});

const approvalItem = (
  selected: boolean,
  resourceId: string,
  resourceName: string,
  databaseType: string,
  region = 'ap-northeast-2',
): z.infer<typeof schemas.TargetSourceResourceItemDto> => ({
  selected,
  metadata: approvalMetadata(databaseType, region),
  resource_id: resourceId,
  resource_name: resourceName,
  resource_type: null,
  integration_category: 'TARGET',
  recommend_fail_reason: null,
  exclusion_reason: null,
});

export const awsWireSampleApprovalLatest: z.infer<
  typeof schemas.ApprovalRequestLatestDto
> = {
  request: {
    id: 34,
    target_source_id: AWS_WIRE_SAMPLE_TARGET_SOURCE_ID,
    status: 'APPROVED',
    requested_by: { user_id: 'admin' },
    requested_at: '2026-07-21T02:09:23.339987',
    resource_total_count: 23,
    resource_selected_count: 4,
  },
  resources: [
    approvalItem(false, `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT_ID}:cluster:raw-mongo-deq-test-1`, 'raw-mongo-deq-test-1', 'mongodb'),
    approvalItem(true, `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT_ID}:cluster:raw-e2e-test-mysql-cluster-cluster`, 'raw-e2e-test-mysql-cluster-cluster', 'mysql'),
    approvalItem(false, `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT_ID}:cluster:raw-test-cluster-deq-cluster`, 'raw-test-cluster-deq-cluster', 'mysql'),
    approvalItem(false, `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT_ID}:cluster:raw-test-cluster-dic-cluster`, 'raw-test-cluster-dic-cluster', 'mysql'),
    approvalItem(false, `arn:aws:rds:ap-northeast-2:${APPROVAL_ACCOUNT_ID}:db:e2e-test-mssql`, 'e2e-test-mssql', 'mssql'),
    approvalItem(false, `arn:aws:redshift:ap-northeast-2:${APPROVAL_ACCOUNT_ID}:namespace:2b7e5028-3b60-47c2-a621-0cf79ea0ad16`, 'redshift-cluster-1', 'redshift'),
    approvalItem(false, `dynamodb:${APPROVAL_ACCOUNT_ID}:ap-northeast-2`, `dynamodb:${APPROVAL_ACCOUNT_ID}:ap-northeast-2`, 'dynamodb'),
    approvalItem(false, `dynamodb:${APPROVAL_ACCOUNT_ID}:ap-northeast-1`, `dynamodb:${APPROVAL_ACCOUNT_ID}:ap-northeast-1`, 'dynamodb', 'ap-northeast-1'),
    approvalItem(false, `athena:${APPROVAL_ACCOUNT_ID}:ap-northeast-2/AwsDataCatalog/test_raw`, 'test_raw', 'athena'),
  ],
  result: {
    request_id: null,
    status: 'APPROVED',
    processed_by: { user_id: 'admin' },
    processed_at: '2026-07-21T02:09:45.921342',
    reason: '승인하도록 하겠습니다.',
  },
};

/**
 * Project seed for the sample target source — the confirmed resource set, so the
 * steps that read the domain store (step 1/3/5/6/7, process status, test
 * connection) stay consistent with the captured `confirmed-integration` rows.
 * `databaseType` keeps the wire's lower-case value on purpose.
 */
export const awsWireSampleResources: MockResource[] = awsWireSampleConfirmedIntegration.resource_infos!.map(
  (info, index) => ({
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
  }),
);
