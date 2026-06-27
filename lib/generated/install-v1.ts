import { z } from "zod";

const UpdateTestConnectionConfirmationRequest = z
  .object({ confirmed: z.boolean() })
  .passthrough();
const UpdateCredentialRequest = z
  .object({ resourceId: z.string(), credentialId: z.string() })
  .partial()
  .passthrough();
const SkipLogicalDatabaseItem = z
  .object({
    database_name: z.string(),
    schema_name: z.string().optional(),
    skip_reason: z.enum(["STG", "DEV", "TEMP"]),
    type: z.enum(["DATABASE", "SCHEMA"]),
  })
  .passthrough();
const UpdateSkipLogicalDatabaseRequest = z
  .object({ skip_logical_database_list: z.array(SkipLogicalDatabaseItem) })
  .passthrough();
const GuideContentRequest = z
  .object({
    ko: z.object({}).partial().passthrough(),
    en: z.object({}).partial().passthrough(),
  })
  .passthrough();
const GuideUpdateRequest = z
  .object({ contents: GuideContentRequest })
  .passthrough();
const PiiAgentInstallationConfirmRequest = z
  .object({ confirm: z.boolean() })
  .passthrough();
const ApprovalRejectRequestDto = z
  .object({ reason: z.string().min(0).max(1000) })
  .passthrough();
const NetworkInterfaceDto = z
  .object({
    networkInterfaceId: z.string(),
    ipConfigurationName: z.array(z.string()),
  })
  .partial()
  .passthrough();
const TargetSourceResourceMetadataDto = z
  .object({
    provider: z.enum(["AWS", "GCP", "AZURE", "IDC", "UNKNOWN"]),
    region: z.string(),
    host: z.string(),
    port: z.number().int(),
    networkInterfaces: z.array(NetworkInterfaceDto),
    resource_type: z.enum([
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
    ]),
    database_type: z.string(),
    oracle_service_id: z.string(),
    credential_id: z.string(),
    network_interface_id: z.string(),
    ip_configuration: z.string(),
    project_id: z.string(),
    instance_name: z.string(),
    host_network: z.string(),
    host_project: z.string(),
    cloud_sql_type: z.string(),
    subscription_id: z.string(),
    resource_group: z.string(),
    server_name: z.string(),
    idc_host_format: z.enum(["IP", "HOST"]),
    idc_ips: z.array(z.string()),
    idc_host: z.string(),
    idc_source_ips: z.array(z.string()),
    nlb_index: z.number().int(),
  })
  .partial()
  .passthrough();
const TargetSourceResourceItemDto = z
  .object({
    selected: z.boolean().optional(),
    metadata: TargetSourceResourceMetadataDto,
    resource_id: z.string().optional(),
    resource_name: z.string().optional(),
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
    exclusion_reason: z.string().optional(),
  })
  .passthrough();
const ApprovalRequestInputDto = z
  .object({ resources: z.array(TargetSourceResourceItemDto) })
  .partial()
  .passthrough();
const ApprovalApproveRequestDto = z
  .object({ comment: z.string() })
  .partial()
  .passthrough();
const TargetSourceCreationCandidateMetadata = z
  .object({
    aws_account_id: z.string().regex(/^[0-9]{12}$/),
    tenant_id: z.string(),
    subscription_id: z.string(),
    project_id: z.string(),
    description: z.string(),
  })
  .partial()
  .passthrough();
const TargetSourceCreationCandidateResponse = z
  .object({
    status: z.enum(["ADD", "DUPLICATE"]),
    cloud_type: z.enum(["AWS", "GCP", "AZURE", "IDC", "UNKNOWN"]),
    is_sdu_type: z.boolean(),
    is_china_region: z.boolean(),
    metadata: TargetSourceCreationCandidateMetadata,
    existing_target_source_id: z.number().int().nullish(),
    grant_service_terraform_execution_permission: z.boolean().nullish(),
  })
  .passthrough();
const TargetSourceCreationCandidateRequest = z
  .object({
    cloud_type: z
      .enum(["aws", "azure", "gcp", "idc", "others"]),
    is_china_region: z.boolean(),
    database_types: z.array(z.string()),
    grant_service_terraform_execution_permission: z.boolean().optional(),
    metadata: TargetSourceCreationCandidateMetadata,
  })
  .passthrough();
const Link = z
  .object({ href: z.string(), templated: z.boolean() })
  .partial()
  .passthrough();
const ErrorMessage = z
  .object({
    timestamp: z.string().datetime({ offset: true }),
    status: z.enum([
      "100 CONTINUE",
      "101 SWITCHING_PROTOCOLS",
      "102 PROCESSING",
      "103 EARLY_HINTS",
      "103 CHECKPOINT",
      "200 OK",
      "201 CREATED",
      "202 ACCEPTED",
      "203 NON_AUTHORITATIVE_INFORMATION",
      "204 NO_CONTENT",
      "205 RESET_CONTENT",
      "206 PARTIAL_CONTENT",
      "207 MULTI_STATUS",
      "208 ALREADY_REPORTED",
      "226 IM_USED",
      "300 MULTIPLE_CHOICES",
      "301 MOVED_PERMANENTLY",
      "302 FOUND",
      "302 MOVED_TEMPORARILY",
      "303 SEE_OTHER",
      "304 NOT_MODIFIED",
      "305 USE_PROXY",
      "307 TEMPORARY_REDIRECT",
      "308 PERMANENT_REDIRECT",
      "400 BAD_REQUEST",
      "401 UNAUTHORIZED",
      "402 PAYMENT_REQUIRED",
      "403 FORBIDDEN",
      "404 NOT_FOUND",
      "405 METHOD_NOT_ALLOWED",
      "406 NOT_ACCEPTABLE",
      "407 PROXY_AUTHENTICATION_REQUIRED",
      "408 REQUEST_TIMEOUT",
      "409 CONFLICT",
      "410 GONE",
      "411 LENGTH_REQUIRED",
      "412 PRECONDITION_FAILED",
      "413 PAYLOAD_TOO_LARGE",
      "413 REQUEST_ENTITY_TOO_LARGE",
      "414 URI_TOO_LONG",
      "414 REQUEST_URI_TOO_LONG",
      "415 UNSUPPORTED_MEDIA_TYPE",
      "416 REQUESTED_RANGE_NOT_SATISFIABLE",
      "417 EXPECTATION_FAILED",
      "418 I_AM_A_TEAPOT",
      "419 INSUFFICIENT_SPACE_ON_RESOURCE",
      "420 METHOD_FAILURE",
      "421 DESTINATION_LOCKED",
      "422 UNPROCESSABLE_ENTITY",
      "423 LOCKED",
      "424 FAILED_DEPENDENCY",
      "425 TOO_EARLY",
      "426 UPGRADE_REQUIRED",
      "428 PRECONDITION_REQUIRED",
      "429 TOO_MANY_REQUESTS",
      "431 REQUEST_HEADER_FIELDS_TOO_LARGE",
      "451 UNAVAILABLE_FOR_LEGAL_REASONS",
      "500 INTERNAL_SERVER_ERROR",
      "501 NOT_IMPLEMENTED",
      "502 BAD_GATEWAY",
      "503 SERVICE_UNAVAILABLE",
      "504 GATEWAY_TIMEOUT",
      "505 HTTP_VERSION_NOT_SUPPORTED",
      "506 VARIANT_ALSO_NEGOTIATES",
      "507 INSUFFICIENT_STORAGE",
      "508 LOOP_DETECTED",
      "509 BANDWIDTH_LIMIT_EXCEEDED",
      "510 NOT_EXTENDED",
      "511 NETWORK_AUTHENTICATION_REQUIRED",
    ]),
    code: z.string(),
    message: z.string(),
    path: z.string(),
  })
  .partial()
  .passthrough();
const TestConnectionConfirmationResponse = z
  .object({
    target_source_id: z.number().int(),
    confirmed: z.boolean(),
    confirmed_at: z.string().datetime({ offset: true }),
  })
  .partial()
  .passthrough();
const UpdateCredentialResponse = z
  .object({ success: z.boolean() })
  .partial()
  .passthrough();
const SkipLogicalDatabaseResponse = z
  .object({ skip_logical_database_list: z.array(SkipLogicalDatabaseItem) })
  .partial()
  .passthrough();
const GuideContents = z
  .object({ ko: z.string(), en: z.string() })
  .partial()
  .passthrough();
const GuideDetail = z
  .object({
    name: z.string(),
    contents: GuideContents,
    updatedAt: z.string().datetime({ offset: true }),
  })
  .partial()
  .passthrough();
const TestConnectionTriggerResponse = z
  .object({ success: z.boolean() })
  .partial()
  .passthrough();
const ScanJobResponse = z
  .object({
    id: z.number().int(),
    scan_status: z.enum(["SCANNING", "FAIL", "CANCELED", "SUCCESS", "TIMEOUT"]),
    target_source_id: z.number().int(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
    scan_version: z.number().int(),
    scan_progress: z.number().int(),
    duration_seconds: z.number(),
    resource_count_by_resource_type: z.record(z.number().int()),
    scan_error: z.enum([
      "AUTH_PERMISSION_ERROR",
      "RATE_LIMIT",
      "NETWORK_ERROR",
      "SERVICE_ERROR",
      "UNKNOWN",
    ]),
  })
  .partial()
  .passthrough();
const ServiceInfoRefinedResponse = z
  .object({
    code: z.string(),
    serviceName: z.string(),
    abbr: z.string(),
    installed: z.boolean(),
    isEosService: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .partial()
  .passthrough();
const TargetSourceResponse = z
  .object({
    id: z.number().int(),
    serviceInfo: ServiceInfoRefinedResponse,
    serviceType: z.string(),
    division: z.string(),
    cloudProvider: z.enum(["AWS", "GCP", "AZURE", "IDC", "UNKNOWN"]),
    state: z.enum([
      "CREATED",
      "CONFIRMED",
      "PROVISIONING",
      "ACTIVE",
      "CONFIRM_FAILED",
      "PROVISION_FAILED",
      "DESTROY_FAILED",
    ]),
    supportRawData: z.boolean(),
    description: z.string(),
    cloudResourceAccessList: z.array(
      z.record(z.object({}).partial().passthrough())
    ),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    confirmStatus: z.enum([
      "IDLE",
      "PENDING",
      "UNAVAILABLE",
      "CONFIRMING",
      "RESOURCE_CLEANING",
      "RESOURCE_CLEAN_FAILED",
      "CONFIRMED",
    ]),
    piiAgentInstalledAt: z.string().datetime({ offset: true }),
  })
  .partial()
  .passthrough();
const ActorDto = z.object({ user_id: z.string() }).partial().passthrough();
const ApprovalUnavailableResponseDto = z
  .object({
    request_id: z.number().int(),
    status: z.enum([
      "PENDING",
      "APPROVED",
      "AUTO_APPROVED",
      "REJECTED",
      "CANCELLED",
      "UNAVAILABLE",
      "UNAVAILABLE_ACKNOWLEDGED",
    ]),
    processed_by: ActorDto,
    processed_at: z.string().datetime({ offset: true }),
    reason: z.string(),
  })
  .partial()
  .passthrough();
const ApprovalUnavailableConfirmResponseDto = z
  .object({
    target_source_id: z.number().int(),
    confirm_status: z.enum([
      "IDLE",
      "PENDING",
      "UNAVAILABLE",
      "CONFIRMING",
      "RESOURCE_CLEANING",
      "RESOURCE_CLEAN_FAILED",
      "CONFIRMED",
    ]),
    processed_at: z.string().datetime({ offset: true }),
    confirmed_by: z.string(),
  })
  .partial()
  .passthrough();
const ApprovalRequestSummaryDto = z
  .object({
    id: z.number().int(),
    target_source_id: z.number().int(),
    status: z.enum([
      "PENDING",
      "APPROVED",
      "AUTO_APPROVED",
      "REJECTED",
      "CANCELLED",
      "UNAVAILABLE",
      "UNAVAILABLE_ACKNOWLEDGED",
    ]),
    requested_by: ActorDto,
    requested_at: z.string().datetime({ offset: true }),
    resource_total_count: z.number().int(),
    resource_selected_count: z.number().int(),
  })
  .partial()
  .passthrough();
const ApprovalActionResponseDto = z
  .object({
    request_id: z.number().int(),
    status: z.enum([
      "PENDING",
      "APPROVED",
      "AUTO_APPROVED",
      "REJECTED",
      "CANCELLED",
      "UNAVAILABLE",
      "UNAVAILABLE_ACKNOWLEDGED",
    ]),
    processed_by: ActorDto,
    processed_at: z.string().datetime({ offset: true }),
    reason: z.string(),
  })
  .partial()
  .passthrough();
const TargetSourceMetadata = z
  .object({
    tenant_id: z.string(),
    subscription_id: z.string(),
    gcp_project_id: z.string(),
    aws_account_id: z.string(),
    is_sdu_type: z.boolean(),
    is_china_region: z.boolean(),
    grant_service_terraform_execution_permission: z.boolean(),
  })
  .partial()
  .passthrough();
const TargetSourceInfo = z
  .object({
    targetSourceId: z.number().int(),
    description: z.string(),
    cloudProvider: z.enum(["AWS", "GCP", "AZURE", "IDC", "UNKNOWN"]),
    createdAt: z.string().datetime({ offset: true }),
    serviceCode: z.string(),
    serviceName: z.string(),
    updatedAt: z.string().datetime({ offset: true }),
    metadata: TargetSourceMetadata,
  })
  .partial()
  .passthrough();
const UserInfo = z
  .object({ id: z.string(), name: z.string(), email: z.string() })
  .partial()
  .passthrough();
const UserSearchResponse = z
  .object({ users: z.array(UserInfo) })
  .partial()
  .passthrough();
const SortObject = z
  .object({
    direction: z.string(),
    nullHandling: z.string(),
    ascending: z.boolean(),
    property: z.string(),
    ignoreCase: z.boolean(),
  })
  .partial()
  .passthrough();
const PageableObject = z
  .object({
    paged: z.boolean(),
    pageNumber: z.number().int(),
    pageSize: z.number().int(),
    unpaged: z.boolean(),
    offset: z.number().int(),
    sort: z.array(SortObject),
  })
  .partial()
  .passthrough();
const ServiceItem = z
  .object({ service_code: z.string(), service_name: z.string() })
  .partial()
  .passthrough();
const PageServiceItem = z
  .object({
    totalPages: z.number().int(),
    totalElements: z.number().int(),
    pageable: PageableObject,
    first: z.boolean(),
    last: z.boolean(),
    size: z.number().int(),
    content: z.array(ServiceItem),
    number: z.number().int(),
    sort: z.array(SortObject),
    numberOfElements: z.number().int(),
    empty: z.boolean(),
  })
  .partial()
  .passthrough();
const UserMeResponse = z
  .object({ id: z.string(), name: z.string(), email: z.string() })
  .partial()
  .passthrough();
const AzureServicePrincipalVerificationResponse = z
  .object({
    app_id: z.string(),
    status: z.string(),
    fail_reason: z.string(),
    fail_message: z.string(),
    last_verified_at: z.string().datetime({ offset: true }),
  })
  .partial()
  .passthrough();
const TargetSourceDetail = z
  .object({
    description: z.string(),
    target_source_id: z.number().int(),
    service_code: z.string(),
    service_name: z.string(),
    process_status: z.enum([
      "IDLE",
      "PENDING",
      "CONFIRMING",
      "CONFIRMED",
      "INSTALLED",
      "CONNECTED",
      "COMPLETED",
    ]),
    cloud_provider: z.enum(["AWS", "GCP", "AZURE", "IDC", "UNKNOWN"]),
    created_at: z.string().datetime({ offset: true }),
    metadata: TargetSourceMetadata,
  })
  .partial()
  .passthrough();
const TestedLogicalDatabaseItem = z
  .object({
    database_name: z.string(),
    schema_name: z.string(),
    type: z.enum(["DATABASE", "SCHEMA"]),
  })
  .partial()
  .passthrough();
const TestedLogicalDatabasesResponse = z
  .object({ logical_database_list: z.array(TestedLogicalDatabaseItem) })
  .partial()
  .passthrough();
const TestConnectionAgentResult = z
  .object({
    agent_id: z.string(),
    gcp_region: z.string(),
    resource_id: z.string(),
    connection_status: z.enum(["PENDING", "RUNNING", "SUCCESS", "FAIL"]),
    database_uri_list: z.array(z.string()),
  })
  .partial()
  .passthrough();
const TestConnectionVersionResult = z
  .object({
    target_source_id: z.number().int(),
    test_connection_version: z.number().int(),
    connection_status: z.enum(["PENDING", "RUNNING", "SUCCESS", "FAIL"]),
    requested_at: z.string().datetime({ offset: true }),
    completed_at: z.string().datetime({ offset: true }),
    test_connection_agent_results: z.array(TestConnectionAgentResult),
  })
  .partial()
  .passthrough();
const TestConnectionLatestResultSummaryResponse = z
  .object({
    resource_id: z.string(),
    agent_id: z.string(),
    logical_database_count: z.number().int(),
    excluded_logical_database_count: z.number().int(),
  })
  .partial()
  .passthrough();
const TestConnectionCompletionStatusResponse = z
  .object({
    target_source_id: z.number().int(),
    latest_test_connection_requested_at: z.string().datetime({ offset: true }),
    logical_database_updated_at: z.string().datetime({ offset: true }),
    latest_test_connection_success: z.boolean(),
    test_connection_status: z.enum([
      "CONFIRMED",
      "LATEST_TEST_CONNECTION_SUCCESS",
      "TEST_CONNECTION_REQUIRED",
      "LOGICAL_DATABASE_RECENTLY_UPDATED",
    ]),
    test_connection_confirmed: z.boolean(),
  })
  .partial()
  .passthrough();
const SecretResponse = z
  .object({
    name: z.string(),
    create_time: z.number().int(),
    create_time_str: z.string(),
  })
  .partial()
  .passthrough();
const PageScanJobResponse = z
  .object({
    totalPages: z.number().int(),
    totalElements: z.number().int(),
    pageable: PageableObject,
    first: z.boolean(),
    last: z.boolean(),
    size: z.number().int(),
    content: z.array(ScanJobResponse),
    number: z.number().int(),
    sort: z.array(SortObject),
    numberOfElements: z.number().int(),
    empty: z.boolean(),
  })
  .partial()
  .passthrough();
const CloudResourceResponse = z
  .object({
    resources: z.array(TargetSourceResourceItemDto),
    total_count: z.number().int(),
  })
  .partial()
  .passthrough();
const ProcessStatusResponseDto = z
  .object({
    target_source_id: z.number().int(),
    process_status: z.enum([
      "IDLE",
      "PENDING",
      "CONFIRMING",
      "CONFIRMED",
      "INSTALLED",
      "CONNECTED",
      "COMPLETED",
    ]),
    healthy: z.enum(["UNKNOWN", "HEALTHY", "UNHEALTHY", "DEGRADED"]),
    evaluated_at: z.string().datetime({ offset: true }),
  })
  .partial()
  .passthrough();
const IdcResourceInput = z
  .object({
    ips: z.array(z.string()),
    host: z.string(),
    port: z.number().int(),
    selected: z.boolean(),
    input_format: z.enum(["IP", "HOST"]),
    database_type: z.string(),
    service_id: z.string(),
    credential_id: z.string(),
    exclusion_reason: z.string(),
  })
  .partial()
  .passthrough();
const IdcPreviousRequestResponse = z
  .object({ resources: z.array(IdcResourceInput) })
  .partial()
  .passthrough();
const CloudInstallationStepStatusDto = z
  .object({
    status: z.enum(["COMPLETED", "FAIL", "IN_PROGRESS", "SKIP", "UNKNOWN"]),
    guide: z.string(),
  })
  .partial()
  .passthrough();
const IdcLastCheckDto = z
  .object({
    status: z.enum(["COMPLETED", "FAIL", "IN_PROGRESS", "SKIP", "UNKNOWN"]),
    checked_at: z.string().datetime({ offset: true }),
    fail_reason: z.string(),
  })
  .partial()
  .passthrough();
const IdcResourceInstallationStatusDto = z
  .object({
    resource_id: z.string(),
    installation_status: z.enum([
      "COMPLETED",
      "FAIL",
      "IN_PROGRESS",
      "SKIP",
      "UNKNOWN",
    ]),
    bdc_side_cx_terraform_apply: CloudInstallationStepStatusDto,
    bdc_side_bdp_terraform_apply: CloudInstallationStepStatusDto,
    firewall_check: CloudInstallationStepStatusDto,
  })
  .partial()
  .passthrough();
const IdcInstallationStatusResponse = z
  .object({
    last_check: IdcLastCheckDto,
    resources: z.array(IdcResourceInstallationStatusDto),
  })
  .partial()
  .passthrough();
const GcpServiceAccountInfoResponse = z
  .object({
    gcp_project_id: z.string(),
    status: z.enum(["VALID", "INVALID", "UNVERIFIED"]),
    fail_reason: z.enum([
      "SA_NOT_CONFIGURED",
      "SA_NOT_FOUND",
      "SA_INSUFFICIENT_PERMISSIONS",
      "SCAN_SA_UNAVAILABLE",
    ]),
    fail_message: z.string(),
    last_verified_at: z.string().datetime({ offset: true }),
  })
  .partial()
  .passthrough();
const LastCheckInfoDto = z
  .object({
    status: z.enum([
      "NEVER_CHECKED",
      "IN_PROGRESS",
      "COMPLETED",
      "FAILED",
      "SUCCESS",
    ]),
    checked_at: z.string().datetime({ offset: true }),
    fail_reason: z.string(),
  })
  .partial()
  .passthrough();
const GcpResourceInstallationStatusDto = z
  .object({
    resource_id: z.string(),
    resource_name: z.string(),
    installation_status: z.enum([
      "COMPLETED",
      "FAIL",
      "IN_PROGRESS",
      "SKIP",
      "UNKNOWN",
    ]),
    service_side_subnet_creation: CloudInstallationStepStatusDto,
    service_side_terraform_apply: CloudInstallationStepStatusDto,
    bdc_side_terraform_apply: CloudInstallationStepStatusDto,
  })
  .partial()
  .passthrough();
const GcpInstallationStatusResponse = z
  .object({
    last_check: LastCheckInfoDto,
    resources: z.array(GcpResourceInstallationStatusDto),
  })
  .partial()
  .passthrough();
const ResourceConfigDto = z
  .object({
    resource_id: z.string(),
    resource_type: z.string(),
    database_type: z.string(),
    port: z.number().int(),
    host: z.string(),
    oracle_service_id: z.string(),
    network_interface_id: z.string(),
    ip_configuration: z.string(),
    credential_id: z.string(),
    database_region: z.string(),
    resource_name: z.string(),
    agent_id: z.string(),
    athena_region_resource_id: z.string(),
    protocol: z.string(),
    secret_info: z.string(),
    db_target_ip_list: z.array(z.string()),
    public_domain_name_list: z.array(z.string()),
    private_domain_name_list: z.array(z.string()),
    idc_host_format: z.enum(["IP", "HOST"]),
    idc_ips: z.array(z.string()),
    idc_host: z.string(),
    idc_source_ips: z.array(z.string()),
    nlb_index: z.number().int(),
  })
  .partial()
  .passthrough();
const ConfirmedIntegrationResponse = z
  .object({ resource_infos: z.array(ResourceConfigDto) })
  .partial()
  .passthrough();
const PrivateEndpointDetail = z
  .object({ id: z.string(), name: z.string(), status: z.string() })
  .partial()
  .passthrough();
const VmInstallationDetail = z
  .object({
    subnet_exists: z.boolean(),
    load_balancer: z.object({}).partial().passthrough(),
  })
  .partial()
  .passthrough();
const AzureResourceStatus = z
  .object({
    resource_id: z.string(),
    resource_name: z.string(),
    resource_type: z.string(),
    private_endpoint: PrivateEndpointDetail,
    vm_installation: VmInstallationDetail,
  })
  .partial()
  .passthrough();
const AzureInstallationStatusResponse = z
  .object({
    last_check: LastCheckInfoDto,
    resources: z.array(AzureResourceStatus),
  })
  .partial()
  .passthrough();
const AwsRoleVerificationResponse = z
  .object({
    status: z.string(),
    role_arn: z.string(),
    fail_reason: z.string(),
    fail_message: z.string(),
    last_verified_at: z.string().datetime({ offset: true }),
  })
  .partial()
  .passthrough();
const AwsResourceInstallationStatusDto = z
  .object({
    resource_id: z.string(),
    resource_name: z.string(),
    installation_status: z.enum([
      "COMPLETED",
      "FAIL",
      "IN_PROGRESS",
      "SKIP",
      "UNKNOWN",
    ]),
    service_terraform: CloudInstallationStepStatusDto,
    bdc_service_terraform: CloudInstallationStepStatusDto,
    bdc_common_terraform: CloudInstallationStepStatusDto,
  })
  .partial()
  .passthrough();
const AwsTerraformExecutionRoleVerifyDto = z
  .object({
    status: z.enum(["COMPLETED", "FAIL", "IN_PROGRESS", "SKIP", "UNKNOWN"]),
    role_arn: z.string(),
  })
  .partial()
  .passthrough();
const AwsInstallationStatusResponse = z
  .object({
    last_check: LastCheckInfoDto,
    resources: z.array(AwsResourceInstallationStatusDto),
    terraform_execution_role_verify: AwsTerraformExecutionRoleVerifyDto,
  })
  .partial()
  .passthrough();
const ApprovedIntegrationResponseDto = z
  .object({
    id: z.number().int(),
    request_id: z.number().int(),
    approved_at: z.string().datetime({ offset: true }),
    approved_by: ActorDto,
    resources: z.array(TargetSourceResourceItemDto),
  })
  .partial()
  .passthrough();
const ApprovalRequestLatestDto = z
  .object({
    request: ApprovalRequestSummaryDto,
    resources: z.array(TargetSourceResourceItemDto),
    result: ApprovalActionResponseDto,
  })
  .partial()
  .passthrough();
const Page = z
  .object({
    totalPages: z.number().int(),
    totalElements: z.number().int(),
    pageable: PageableObject,
    first: z.boolean(),
    last: z.boolean(),
    size: z.number().int(),
    content: z.array(z.object({}).partial().passthrough()),
    number: z.number().int(),
    sort: z.array(SortObject),
    numberOfElements: z.number().int(),
    empty: z.boolean(),
  })
  .partial()
  .passthrough();
const AuthorizedUsersResponse = z
  .object({ users: z.array(UserInfo) })
  .partial()
  .passthrough();
const AzurePrivateLinkHealthResult = z
  .object({
    provisioningState: z.string(),
    resourceId: z.string(),
    privateLinkId: z.string(),
    resourceType: z.enum([
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
    ]),
    healthCheckStatus: z.enum([
      "HEALTHY",
      "UPDATING",
      "UNHEALTHY",
      "UNHEALTHY_NEED_SERVICE_ACTION",
      "UNHEALTHY_NEED_BDC_SIDE_ACTION",
      "NEED_TERRAFORM_EXECUTION",
      "NEED_SCAN_PERMISSION",
      "INTERNAL_SERVER_ERROR",
      "EMPTY",
    ]),
  })
  .partial()
  .passthrough();
const AzureHealthCheckResult = z
  .object({
    healthCheckStatus: z.enum([
      "HEALTHY",
      "UPDATING",
      "UNHEALTHY",
      "UNHEALTHY_NEED_SERVICE_ACTION",
      "UNHEALTHY_NEED_BDC_SIDE_ACTION",
      "NEED_TERRAFORM_EXECUTION",
      "NEED_SCAN_PERMISSION",
      "INTERNAL_SERVER_ERROR",
      "EMPTY",
    ]),
    azurePrivateLinkHealthResultList: z.array(AzurePrivateLinkHealthResult),
  })
  .partial()
  .passthrough();
const NlbOccupiedResourceResponse = z
  .object({
    serviceCode: z.string(),
    serviceName: z.string(),
    targetSourceId: z.number().int(),
    isLatest: z.boolean(),
    ipSet: z.array(z.string()),
    port: z.number().int(),
    databaseType: z.string(),
    databaseName: z.string(),
  })
  .partial()
  .passthrough();
const NlbTableResponse = z
  .object({
    nlbIndex: z.number().int(),
    nlbIpList: z.array(z.string()),
    occupiedListenerCount: z.number().int(),
  })
  .partial()
  .passthrough();

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
