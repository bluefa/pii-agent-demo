import { z } from "zod";
const Str = z.string().nullable();
const Num = z.number().nullable();
const Bool = z.boolean().nullable();
const Loose = z.record(z.unknown()).nullable();

const UpdateTestConnectionConfirmationRequest = z
  .object({ confirmed: Bool })
  .partial().passthrough();
const UpdateCredentialRequest = z
  .object({ resourceId: Str, credentialId: Str })
  .partial().passthrough();
const SkipLogicalDatabaseItem = z
  .object({
    database_name: Str,
    schema_name: Str.optional(),
    skip_reason: Str,
    type: Str,
  })
  .partial().passthrough();
const UpdateSkipLogicalDatabaseRequest = z
  .object({ skip_logical_database_list: z.array(SkipLogicalDatabaseItem).nullable() })
  .partial().passthrough();
const GuideContentRequest = z
  .object({
    ko: Loose,
    en: Loose,
  })
  .partial().passthrough();
const GuideUpdateRequest = z
  .object({ contents: GuideContentRequest })
  .partial().passthrough();
const PiiAgentInstallationConfirmRequest = z
  .object({ confirm: Bool })
  .partial().passthrough();
const ApprovalRejectRequestDto = z
  .object({ reason: Str })
  .partial().passthrough();
const NetworkInterfaceDto = z
  .object({
    networkInterfaceId: Str,
    ipConfigurationName: z.array(Str).nullable(),
  })
  .partial().passthrough();
const TargetSourceResourceMetadataDto = z
  .object({
    provider: Str,
    region: Str,
    host: Str,
    port: Num,
    networkInterfaces: z.array(NetworkInterfaceDto).nullable(),
    resource_type: Str,
    database_type: Str,
    oracle_service_id: Str,
    credential_id: Str,
    network_interface_id: Str,
    ip_configuration: Str,
    project_id: Str,
    instance_name: Str,
    host_network: Str,
    host_project: Str,
    cloud_sql_type: Str,
    subscription_id: Str,
    resource_group: Str,
    server_name: Str,
    idc_host_format: Str,
    idc_ips: z.array(Str).nullable(),
    idc_host: Str,
    idc_source_ips: z.array(Str).nullable(),
    nlb_index: Num,
  })
  .partial().passthrough();
const TargetSourceResourceItemDto = z
  .object({
    selected: Bool.optional(),
    metadata: TargetSourceResourceMetadataDto,
    resource_id: Str.optional(),
    resource_name: Str.optional(),
    resource_type: z
      .enum([
        "AWS_ATHENA",
        "AWS_ATHENA_DATABASE",
        "AWS_DB_CLUSTER",
        "AWS_DB_INSTANCE",
        "AWS_REDSHIFT_CLUSTER",
        "AWS_DYNAMO_DB_REGION",
        "AWS_DYNAMO_DB_TABLE",
        "AWS_DYNAMO_DB_GLOBAL_TABLE",
        "AWS_NETWORK_INTERFACE",
        "AWS_SUBNET",
        "AWS_RDS_GLOBAL_CLUSTER",
        "AWS_RDS_SUBNET_GROUP",
        "AWS_RDS_PROXY",
        "AWS_RDS_DB_CLUSTER_PARAMETER_GROUP",
        "AWS_RDS_DB_PARAMETER_GROUP",
        "AWS_REDSHIFT_SUBNET_GROUP",
        "AWS_VPC_ENDPOINT_SERVICE",
        "AWS_VPC_ENDPOINT",
        "AWS_VPC_SECURITY_GROUP",
        "AWS_IAM_ROLE",
        "AWS_GLUE_RESOURCE_POLICY",
        "AWS_ECR_POLICY",
        "AWS_S3_BUCKET_POLICY",
        "AWS_GLUE_TABLE",
        "AWS_EC2_INSTANCE",
        "AWS_EC2_REGION",
        "AWS_OPEN_SEARCH_DOMAIN",
        "AWS_KMS",
        "AWS_AUTO_SCALING_GROUP",
        "AZURE_SQL_SERVER",
        "AZURE_SQL_SERVER_MANAGED_INSTANCE",
        "AZURE_MYSQL_FLEXIBLE_SERVER",
        "AZURE_MYSQL",
        "AZURE_POSTGRESQL",
        "AZURE_POSTGRESQL_FLEXIBLE_SERVER",
        "AZURE_MARIADB",
        "AZURE_COSMOSDB_NOSQL",
        "AZURE_SERVICE_PRINCIPAL",
        "AZURE_PRIVATE_ENDPOINT",
        "AZURE_VIRTUAL_MACHINE",
        "AZURE_VIRTUAL_SUBNET",
        "AZURE_SYNAPSE_WORKSPACE",
        "AZURE_NETWORK_INTERFACE",
        "GCP_SQL",
        "GCP_BIGQUERY_DATASET_REGION",
        "GCP_VPC_NETWORK",
        "IDC_RESOURCE",
      ])
      .optional(),
    integration_category: z
      .enum(["TARGET", "NO_INSTALL_NEEDED", "INSTALL_INELIGIBLE"])
      .optional(),
    recommend_fail_reason: z
      .enum([
        "GCP_CLOUD_SQL_HAS_PUBLIC_IP",
        "GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET",
        "AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED",
      ])
      .optional(),
    exclusion_reason: Str.optional(),
  })
  .partial().passthrough();
const ApprovalRequestInputDto = z
  .object({ resources: z.array(TargetSourceResourceItemDto).nullable() })
  .partial().passthrough();
const ApprovalApproveRequestDto = z
  .object({ comment: Str })
  .partial().passthrough();
const TargetSourceCreationCandidateMetadata = z
  .object({
    aws_account_id: Str,
    tenant_id: Str,
    subscription_id: Str,
    project_id: Str,
    description: Str,
  })
  .partial().passthrough();
const TargetSourceCreationCandidateResponse = z
  .object({
    status: Str,
    cloud_type: Str,
    is_sdu_type: Bool,
    is_china_region: Bool,
    metadata: TargetSourceCreationCandidateMetadata,
    existing_target_source_id: Num.nullish(),
    grant_service_terraform_execution_permission: Bool.nullish(),
  })
  .partial().passthrough();
const TargetSourceCreationCandidateRequest = z
  .object({
    cloud_type: z
      .enum(["aws", "azure", "gcp", "idc", "others"]),
    is_china_region: Bool,
    database_types: z.array(Str).nullable(),
    grant_service_terraform_execution_permission: Bool.optional(),
    metadata: TargetSourceCreationCandidateMetadata,
  })
  .partial().passthrough();
const Link = z
  .object({ href: Str, templated: Bool })
  .partial().passthrough();
const ErrorMessage = z
  .object({
    timestamp: Str,
    status: Str,
    code: Str,
    message: Str,
    path: Str,
  })
  .partial().passthrough();
const TestConnectionConfirmationResponse = z
  .object({
    target_source_id: Num,
    confirmed: Bool,
    confirmed_at: Str,
  })
  .partial().passthrough();
const UpdateCredentialResponse = z
  .object({ success: Bool })
  .partial().passthrough();
const SkipLogicalDatabaseResponse = z
  .object({ skip_logical_database_list: z.array(SkipLogicalDatabaseItem).nullable() })
  .partial().passthrough();
const GuideContents = z
  .object({ ko: Str, en: Str })
  .partial().passthrough();
const GuideDetail = z
  .object({
    name: Str,
    contents: GuideContents,
    updatedAt: Str,
  })
  .partial().passthrough();
const TestConnectionTriggerResponse = z
  .object({ success: Bool })
  .partial().passthrough();
const ScanJobResponse = z
  .object({
    id: Num,
    scan_status: Str,
    target_source_id: Num,
    created_at: Str,
    updated_at: Str,
    scan_version: Num,
    scan_progress: Num,
    duration_seconds: Num,
    resource_count_by_resource_type: z.record(Num).nullable(),
    scan_error: Str,
  })
  .partial().passthrough();
const ServiceInfoRefinedResponse = z
  .object({
    code: Str,
    serviceName: Str,
    abbr: Str,
    installed: Bool,
    isEosService: Bool,
    createdAt: Str,
    updatedAt: Str,
  })
  .partial().passthrough();
const TargetSourceResponse = z
  .object({
    id: Num,
    serviceInfo: ServiceInfoRefinedResponse,
    serviceType: Str,
    division: Str,
    cloudProvider: Str,
    state: Str,
    supportRawData: Bool,
    description: Str,
    cloudResourceAccessList: z.array(
      z.record(Loose).nullable()
    ).nullable(),
    createdAt: Str,
    updatedAt: Str,
    confirmStatus: Str,
    piiAgentInstalledAt: Str,
  })
  .partial().passthrough();
const ActorDto = z.object({ user_id: Str }).partial().passthrough();
const ApprovalUnavailableResponseDto = z
  .object({
    request_id: Num,
    status: Str,
    processed_by: ActorDto,
    processed_at: Str,
    reason: Str,
  })
  .partial().passthrough();
const ApprovalUnavailableConfirmResponseDto = z
  .object({
    target_source_id: Num,
    confirm_status: Str,
    processed_at: Str,
    confirmed_by: Str,
  })
  .partial().passthrough();
const ApprovalRequestSummaryDto = z
  .object({
    id: Num,
    target_source_id: Num,
    status: Str,
    requested_by: ActorDto,
    requested_at: Str,
    resource_total_count: Num,
    resource_selected_count: Num,
  })
  .partial().passthrough();
const ApprovalActionResponseDto = z
  .object({
    request_id: Num,
    status: Str,
    processed_by: ActorDto,
    processed_at: Str,
    reason: Str,
  })
  .partial().passthrough();
const TargetSourceMetadata = z
  .object({
    tenant_id: Str,
    subscription_id: Str,
    gcp_project_id: Str,
    aws_account_id: Str,
    is_sdu_type: Bool,
    is_china_region: Bool,
    grant_service_terraform_execution_permission: Bool,
  })
  .partial().passthrough();
const TargetSourceInfo = z
  .object({
    targetSourceId: Num,
    description: Str,
    cloudProvider: Str,
    createdAt: Str,
    serviceCode: Str,
    serviceName: Str,
    updatedAt: Str,
    metadata: TargetSourceMetadata,
  })
  .partial().passthrough();
const UserInfo = z
  .object({ id: Str, name: Str, email: Str })
  .partial().passthrough();
const UserSearchResponse = z
  .object({ users: z.array(UserInfo).nullable() })
  .partial().passthrough();
const SortObject = z
  .object({
    direction: Str,
    nullHandling: Str,
    ascending: Bool,
    property: Str,
    ignoreCase: Bool,
  })
  .partial().passthrough();
const PageableObject = z
  .object({
    paged: Bool,
    pageNumber: Num,
    pageSize: Num,
    unpaged: Bool,
    offset: Num,
    sort: z.array(SortObject).nullable(),
  })
  .partial().passthrough();
const ServiceItem = z
  .object({ service_code: Str, service_name: Str })
  .partial().passthrough();
const PageServiceItem = z
  .object({
    totalPages: Num,
    totalElements: Num,
    pageable: PageableObject,
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(ServiceItem).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
  })
  .partial().passthrough();
const UserMeResponse = z
  .object({ id: Str, name: Str, email: Str })
  .partial().passthrough();
const AzureServicePrincipalVerificationResponse = z
  .object({
    app_id: Str,
    status: Str,
    fail_reason: Str,
    fail_message: Str,
    last_verified_at: Str,
  })
  .partial().passthrough();
const TargetSourceDetail = z
  .object({
    description: Str,
    target_source_id: Num,
    service_code: Str,
    service_name: Str,
    process_status: Str,
    cloud_provider: Str,
    created_at: Str,
    metadata: TargetSourceMetadata,
  })
  .partial().passthrough();
const TestedLogicalDatabaseItem = z
  .object({
    database_name: Str,
    schema_name: Str,
    type: Str,
  })
  .partial().passthrough();
const TestedLogicalDatabasesResponse = z
  .object({ logical_database_list: z.array(TestedLogicalDatabaseItem).nullable() })
  .partial().passthrough();
const TestConnectionAgentResult = z
  .object({
    agent_id: Str,
    gcp_region: Str,
    resource_id: Str,
    connection_status: Str,
    database_uri_list: z.array(Str).nullable(),
  })
  .partial().passthrough();
const TestConnectionVersionResult = z
  .object({
    target_source_id: Num,
    test_connection_version: Num,
    connection_status: Str,
    requested_at: Str,
    completed_at: Str,
    test_connection_agent_results: z.array(TestConnectionAgentResult).nullable(),
  })
  .partial().passthrough();
const TestConnectionLatestResultSummaryResponse = z
  .object({
    resource_id: Str,
    agent_id: Str,
    logical_database_count: Num,
    excluded_logical_database_count: Num,
  })
  .partial().passthrough();
const TestConnectionCompletionStatusResponse = z
  .object({
    target_source_id: Num,
    latest_test_connection_requested_at: Str,
    logical_database_updated_at: Str,
    latest_test_connection_success: Bool,
    test_connection_status: Str,
    test_connection_confirmed: Bool,
  })
  .partial().passthrough();
const SecretResponse = z
  .object({
    name: Str,
    create_time: Num,
    create_time_str: Str,
  })
  .partial().passthrough();
const PageScanJobResponse = z
  .object({
    totalPages: Num,
    totalElements: Num,
    pageable: PageableObject,
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(ScanJobResponse).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
  })
  .partial().passthrough();
const CloudResourceResponse = z
  .object({
    resources: z.array(TargetSourceResourceItemDto).nullable(),
    total_count: Num,
  })
  .partial().passthrough();
const ProcessStatusResponseDto = z
  .object({
    target_source_id: Num,
    process_status: Str,
    healthy: Str,
    evaluated_at: Str,
  })
  .partial().passthrough();
const IdcResourceInput = z
  .object({
    ips: z.array(Str).nullable(),
    host: Str,
    port: Num,
    selected: Bool,
    input_format: Str,
    database_type: Str,
    service_id: Str,
    credential_id: Str,
    exclusion_reason: Str,
  })
  .partial().passthrough();
const IdcPreviousRequestResponse = z
  .object({ resources: z.array(IdcResourceInput).nullable() })
  .partial().passthrough();
const CloudInstallationStepStatusDto = z
  .object({
    status: Str,
    guide: Str,
  })
  .partial().passthrough();
const IdcLastCheckDto = z
  .object({
    status: Str,
    checked_at: Str,
    fail_reason: Str,
  })
  .partial().passthrough();
const IdcResourceInstallationStatusDto = z
  .object({
    resource_id: Str,
    installation_status: Str,
    bdc_side_cx_terraform_apply: CloudInstallationStepStatusDto,
    bdc_side_bdp_terraform_apply: CloudInstallationStepStatusDto,
    firewall_check: CloudInstallationStepStatusDto,
  })
  .partial().passthrough();
const IdcInstallationStatusResponse = z
  .object({
    last_check: IdcLastCheckDto,
    resources: z.array(IdcResourceInstallationStatusDto).nullable(),
  })
  .partial().passthrough();
const GcpServiceAccountInfoResponse = z
  .object({
    gcp_project_id: Str,
    status: Str,
    fail_reason: Str,
    fail_message: Str,
    last_verified_at: Str,
  })
  .partial().passthrough();
const LastCheckInfoDto = z
  .object({
    status: Str,
    checked_at: Str,
    fail_reason: Str,
  })
  .partial().passthrough();
const GcpResourceInstallationStatusDto = z
  .object({
    resource_id: Str,
    resource_name: Str,
    installation_status: Str,
    service_side_subnet_creation: CloudInstallationStepStatusDto,
    service_side_terraform_apply: CloudInstallationStepStatusDto,
    bdc_side_terraform_apply: CloudInstallationStepStatusDto,
  })
  .partial().passthrough();
const GcpInstallationStatusResponse = z
  .object({
    last_check: LastCheckInfoDto,
    resources: z.array(GcpResourceInstallationStatusDto).nullable(),
  })
  .partial().passthrough();
const ResourceConfigDto = z
  .object({
    resource_id: Str,
    resource_type: Str,
    database_type: Str,
    port: Num,
    host: Str,
    oracle_service_id: Str,
    network_interface_id: Str,
    ip_configuration: Str,
    credential_id: Str,
    database_region: Str,
    resource_name: Str,
    agent_id: Str,
    athena_region_resource_id: Str,
    protocol: Str,
    secret_info: Str,
    db_target_ip_list: z.array(Str).nullable(),
    public_domain_name_list: z.array(Str).nullable(),
    private_domain_name_list: z.array(Str).nullable(),
    idc_host_format: Str,
    idc_ips: z.array(Str).nullable(),
    idc_host: Str,
    idc_source_ips: z.array(Str).nullable(),
    nlb_index: Num,
  })
  .partial().passthrough();
const ConfirmedIntegrationResponse = z
  .object({ resource_infos: z.array(ResourceConfigDto).nullable() })
  .partial().passthrough();
const PrivateEndpointDetail = z
  .object({ id: Str, name: Str, status: Str })
  .partial().passthrough();
const VmInstallationDetail = z
  .object({
    subnet_exists: Bool,
    load_balancer: Loose,
  })
  .partial().passthrough();
const AzureResourceStatus = z
  .object({
    resource_id: Str,
    resource_name: Str,
    resource_type: Str,
    private_endpoint: PrivateEndpointDetail,
    vm_installation: VmInstallationDetail,
  })
  .partial().passthrough();
const AzureInstallationStatusResponse = z
  .object({
    last_check: LastCheckInfoDto,
    resources: z.array(AzureResourceStatus).nullable(),
  })
  .partial().passthrough();
const AwsRoleVerificationResponse = z
  .object({
    status: Str,
    role_arn: Str,
    fail_reason: Str,
    fail_message: Str,
    last_verified_at: Str,
  })
  .partial().passthrough();
const AwsResourceInstallationStatusDto = z
  .object({
    resource_id: Str,
    resource_name: Str,
    installation_status: Str,
    service_terraform: CloudInstallationStepStatusDto,
    bdc_service_terraform: CloudInstallationStepStatusDto,
    bdc_common_terraform: CloudInstallationStepStatusDto,
  })
  .partial().passthrough();
const AwsTerraformExecutionRoleVerifyDto = z
  .object({
    status: Str,
    role_arn: Str,
  })
  .partial().passthrough();
const AwsInstallationStatusResponse = z
  .object({
    last_check: LastCheckInfoDto,
    resources: z.array(AwsResourceInstallationStatusDto).nullable(),
    terraform_execution_role_verify: AwsTerraformExecutionRoleVerifyDto,
  })
  .partial().passthrough();
const ApprovedIntegrationResponseDto = z
  .object({
    id: Num,
    request_id: Num,
    approved_at: Str,
    approved_by: ActorDto,
    resources: z.array(TargetSourceResourceItemDto).nullable(),
  })
  .partial().passthrough();
const ApprovalRequestLatestDto = z
  .object({
    request: ApprovalRequestSummaryDto,
    resources: z.array(TargetSourceResourceItemDto).nullable(),
    result: ApprovalActionResponseDto,
  })
  .partial().passthrough();
const Page = z
  .object({
    totalPages: Num,
    totalElements: Num,
    pageable: PageableObject,
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(Loose).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
  })
  .partial().passthrough();
const AuthorizedUsersResponse = z
  .object({ users: z.array(UserInfo).nullable() })
  .partial().passthrough();
const AzurePrivateLinkHealthResult = z
  .object({
    provisioningState: Str,
    resourceId: Str,
    privateLinkId: Str,
    resourceType: Str,
    healthCheckStatus: Str,
  })
  .partial().passthrough();
const AzureHealthCheckResult = z
  .object({
    healthCheckStatus: Str,
    azurePrivateLinkHealthResultList: z.array(AzurePrivateLinkHealthResult).nullable(),
  })
  .partial().passthrough();
const NlbOccupiedResourceResponse = z
  .object({
    serviceCode: Str,
    serviceName: Str,
    targetSourceId: Num,
    isLatest: Bool,
    ipSet: z.array(Str).nullable(),
    port: Num,
    databaseType: Str,
    databaseName: Str,
  })
  .partial().passthrough();
const NlbTableResponse = z
  .object({
    nlbIndex: Num,
    nlbIpList: z.array(Str).nullable(),
    occupiedListenerCount: Num,
  })
  .partial().passthrough();

export const schemas = {
  UpdateTestConnectionConfirmationRequest,
  UpdateCredentialRequest,
  SkipLogicalDatabaseItem,
  UpdateSkipLogicalDatabaseRequest,
  GuideContentRequest,
  GuideUpdateRequest,
  PiiAgentInstallationConfirmRequest,
  ApprovalRejectRequestDto,
  NetworkInterfaceDto,
  TargetSourceResourceMetadataDto,
  TargetSourceResourceItemDto,
  ApprovalRequestInputDto,
  ApprovalApproveRequestDto,
  TargetSourceCreationCandidateMetadata,
  TargetSourceCreationCandidateResponse,
  TargetSourceCreationCandidateRequest,
  Link,
  ErrorMessage,
  TestConnectionConfirmationResponse,
  UpdateCredentialResponse,
  SkipLogicalDatabaseResponse,
  GuideContents,
  GuideDetail,
  TestConnectionTriggerResponse,
  ScanJobResponse,
  ServiceInfoRefinedResponse,
  TargetSourceResponse,
  ActorDto,
  ApprovalUnavailableResponseDto,
  ApprovalUnavailableConfirmResponseDto,
  ApprovalRequestSummaryDto,
  ApprovalActionResponseDto,
  TargetSourceMetadata,
  TargetSourceInfo,
  UserInfo,
  UserSearchResponse,
  SortObject,
  PageableObject,
  ServiceItem,
  PageServiceItem,
  UserMeResponse,
  AzureServicePrincipalVerificationResponse,
  TargetSourceDetail,
  TestedLogicalDatabaseItem,
  TestedLogicalDatabasesResponse,
  TestConnectionAgentResult,
  TestConnectionVersionResult,
  TestConnectionLatestResultSummaryResponse,
  TestConnectionCompletionStatusResponse,
  SecretResponse,
  PageScanJobResponse,
  CloudResourceResponse,
  ProcessStatusResponseDto,
  IdcResourceInput,
  IdcPreviousRequestResponse,
  CloudInstallationStepStatusDto,
  IdcLastCheckDto,
  IdcResourceInstallationStatusDto,
  IdcInstallationStatusResponse,
  GcpServiceAccountInfoResponse,
  LastCheckInfoDto,
  GcpResourceInstallationStatusDto,
  GcpInstallationStatusResponse,
  ResourceConfigDto,
  ConfirmedIntegrationResponse,
  PrivateEndpointDetail,
  VmInstallationDetail,
  AzureResourceStatus,
  AzureInstallationStatusResponse,
  AwsRoleVerificationResponse,
  AwsResourceInstallationStatusDto,
  AwsTerraformExecutionRoleVerifyDto,
  AwsInstallationStatusResponse,
  ApprovedIntegrationResponseDto,
  ApprovalRequestLatestDto,
  Page,
  AuthorizedUsersResponse,
  AzurePrivateLinkHealthResult,
  AzureHealthCheckResult,
  NlbOccupiedResourceResponse,
  NlbTableResponse,
};
