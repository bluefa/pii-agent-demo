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
const NlbIndexAssignmentDto = z
  .object({ resource_id: Str, nlb_index: Num })
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
const TestConnectionRejectRequest = z
  .object({ reason: Str })
  .partial().passthrough();
const TargetSourceResetRequestDto = z
  .object({ reason: Str })
  .partial().passthrough();
const CreatePipelineRequest = z
  .object({ type: Str })
  .partial().passthrough();
const RestartPipelineRequest = z
  .object({ from_sequence: Num })
  .partial().passthrough();
const CustomTaskRequest = z
  .object({ name: Str, description: Str.optional() })
  .partial().passthrough();
const CustomPipelineRequest = z
  .object({ tasks: z.array(CustomTaskRequest).nullable() })
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
    metadata: TargetSourceResourceMetadataDto.nullable(),
    resource_id: Str.optional(),
    resource_name: Str.optional(),
    resource_type: Str
      .optional(),
    integration_category: Str
      .optional(),
    recommend_fail_reason: Str
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
    metadata: TargetSourceCreationCandidateMetadata.nullable(),
    existing_target_source_id: Num.nullish(),
    grant_service_terraform_execution_permission: Bool.nullish(),
  })
  .partial().passthrough();
const TargetSourceCreationCandidateRequest = z
  .object({
    cloud_type: Str,
    is_china_region: Bool,
    database_types: z.array(Str).nullable(),
    grant_service_terraform_execution_permission: Bool.optional(),
    metadata: TargetSourceCreationCandidateMetadata.nullable(),
  })
  .partial().passthrough();
const JiraTicketAttachRequest = z
  .object({ issueKey: Str })
  .partial().passthrough();
const Link = z
  .object({ href: Str, templated: Bool })
  .partial().passthrough();
const TerraformTaskStatusResponse = z
  .object({
    terraform_target: Str,
    terraform_execution_side: Str,
    terraform_task_name: Str,
    state: Str,
    destroy_required: Bool,
    completed_at: Str,
  })
  .partial().passthrough();
const TerraformStatusResponse = z
  .object({
    target_source_id: Num,
    cloud_provider: Str,
    is_sdu_type: Bool,
    has_confirmed_infra: Bool,
    latest_confirmed_at: Str,
    checked_at: Str,
    overall_state: Str,
    destroy_required: Bool,
    tasks: z.array(TerraformTaskStatusResponse).nullable(),
  })
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
const ActorDto = z.object({ user_id: Str }).partial().passthrough();
const ApprovalActionResponseDto = z
  .object({
    request_id: Num,
    status: Str,
    processed_by: ActorDto.nullable(),
    processed_at: Str,
    reason: Str,
  })
  .partial().passthrough();
const ApprovalRequestDetailDto = z
  .object({
    id: Num,
    target_source_id: Num,
    status: Str,
    requested_by: ActorDto.nullable(),
    requested_at: Str,
    resources: z.array(TargetSourceResourceItemDto).nullable(),
    result: ApprovalActionResponseDto.nullable(),
  })
  .partial().passthrough();
const GuideContents = z
  .object({ ko: Str, en: Str })
  .partial().passthrough();
const GuideDetail = z
  .object({
    name: Str,
    contents: GuideContents.nullable(),
    updatedAt: Str,
  })
  .partial().passthrough();
const TestConnectionRejectResponse = z
  .object({
    target_source_id: Num,
    test_connection_rejected: Bool,
    test_connection_reject_reason: Str,
    test_connection_rejected_at: Str,
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
const TaskSummary = z
  .object({
    task_id: Num,
    sequence: Num,
    kind: Str,
    task_definition: Str,
    operation: Str,
    terraform_action: Str,
    status: Str,
    fail_count: Num,
    error_code: Str,
    consumes_terraform_slot: Bool,
    started_at: Str,
    finished_at: Str,
    description: Str,
    origin_task_id: Num,
  })
  .partial().passthrough();
const RestartOriginView = z
  .object({
    pipeline_id: Num,
    type: Str,
    recipe_definition: Str,
    status: Str,
    total_task_count: Num,
    done_task_count: Num,
    resumed_from_sequence: Num,
  })
  .partial().passthrough();
const PipelineDetail = z
  .object({
    pipeline_id: Num,
    type: Str,
    target_source_id: Str,
    cloud_provider: Str,
    recipe_definition: Str,
    status: Str,
    created_at: Str,
    last_activity_at: Str,
    next_due_at: Str,
    leased: Bool,
    cancel_requested: Bool,
    due_lag_millis: Num,
    current_task_sequence: Num,
    final_task_sequence: Num,
    current_fail_count: Num,
    current_max_fail_count: Num,
    done_task_count: Num,
    total_task_count: Num,
    tasks: z.array(TaskSummary).nullable(),
    origin_pipeline_id: Num,
    origin: RestartOriginView.nullable(),
    restarted_by_pipeline_id: Num,
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
    serviceInfo: ServiceInfoRefinedResponse.nullable(),
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
    isSduType: Bool,
  })
  .partial().passthrough();
const ApprovalUnavailableResponseDto = z
  .object({
    request_id: Num,
    status: Str,
    processed_by: ActorDto.nullable(),
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
    requested_by: ActorDto.nullable(),
    requested_at: Str,
    resource_total_count: Num,
    resource_selected_count: Num,
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
const TestConnectionRejectStatusResponse = z
  .object({
    target_source_id: Num,
    target_source_exists: Bool,
    status: Str,
    service_name: Str,
    service_code: Str,
    cloud_provider: Str,
    reject_reason: Str,
    rejected_at: Str,
    completed_at: Str,
    metadata: TargetSourceMetadata.nullable(),
  })
  .partial().passthrough();
const TestConnectionRejectStatusBatchResponse = z
  .object({ items: z.array(TestConnectionRejectStatusResponse).nullable() })
  .partial().passthrough();
const LatestApprovalRequestSummaryDto = z
  .object({
    request_id: Num,
    status: Str,
    requested_by: ActorDto.nullable(),
    requested_at: Str,
    processed_by: ActorDto.nullable(),
    processed_at: Str,
    reason: Str,
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
    confirmStatus: Str,
    metadata: TargetSourceMetadata.nullable(),
    latest_approval_request: LatestApprovalRequestSummaryDto.nullable(),
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
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
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
  .object({
    id: Str,
    name: Str,
    email: Str,
    source: Str,
  })
  .partial().passthrough();
const TaskCatalogEntry = z
  .object({
    name: Str,
    display_name: Str,
    description: Str,
    provider: Str,
    kind: Str,
    terraform_action: Str,
    consumes_terraform_slot: Bool,
  })
  .partial().passthrough();
const TaskCatalogResponse = z
  .object({ task_definitions: z.array(TaskCatalogEntry).nullable() })
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
    cloud_provider: Str,
    created_at: Str,
    metadata: TargetSourceMetadata.nullable(),
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
const TestConnectionHistoryItemResponse = z
  .object({
    target_source_id: Num,
    status: Str,
    reason: Str,
    created_at: Str,
  })
  .partial().passthrough();
const PageTestConnectionHistoryItemResponse = z
  .object({
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(TestConnectionHistoryItemResponse).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
  })
  .partial().passthrough();
const TestConnectionExecutionHistoryResponse = z
  .object({
    target_source_id: Num,
    test_connection_version: Num,
    status: Str,
    requested_at: Str,
    completed_at: Str,
  })
  .partial().passthrough();
const PageTestConnectionExecutionHistoryResponse = z
  .object({
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(TestConnectionExecutionHistoryResponse).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
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
    last_updated_time: Str,
  })
  .partial().passthrough();
const PageScanJobResponse = z
  .object({
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
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
    target_source_exists: Bool,
    process_status: Str,
    healthy: Str,
    evaluated_at: Str,
  })
  .partial().passthrough();
const PipelineSummary = z
  .object({
    pipeline_id: Num,
    type: Str,
    target_source_id: Str,
    service_code: Str,
    service_name: Str,
    cloud_provider: Str,
    recipe_definition: Str,
    status: Str,
    done_task_count: Num,
    total_task_count: Num,
    created_at: Str,
    last_activity_at: Str,
    origin_pipeline_id: Num,
  })
  .partial().passthrough();
const PagePipelineSummary = z
  .object({
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(PipelineSummary).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
  })
  .partial().passthrough();
const OriginSummary = z
  .object({
    pipeline_id: Num,
    type: Str,
    recipe_definition: Str,
    status: Str,
    total_task_count: Num,
    done_task_count: Num,
  })
  .partial().passthrough();
const SkippedTask = z
  .object({
    sequence: Num,
    task_definition: Str,
    status: Str,
  })
  .partial().passthrough();
const TaskToRun = z
  .object({
    sequence: Num,
    task_definition: Str,
    kind: Str,
    terraform_action: Str,
    origin_task_id: Num,
    origin_status: Str,
    origin_error_code: Str,
    origin_fail_count: Num,
  })
  .partial().passthrough();
const RestartPreview = z
  .object({
    origin: OriginSummary.nullable(),
    resume_from_sequence: Num,
    skipped_tasks: z.array(SkippedTask).nullable(),
    tasks_to_run: z.array(TaskToRun).nullable(),
    warnings: z.array(Str).nullable(),
  })
  .partial().passthrough();
const TaskDefinitionView = z
  .object({
    name: Str,
    display_name: Str,
    description: Str,
    dispatch_api: Str,
    status_api: Str,
    result_api: Str,
    success_policy: Str,
    result_storage: Str,
  })
  .partial().passthrough();
const RecipePreviewStep = z
  .object({
    sequence: Num,
    task_definition: Str,
    kind: Str,
    operation: Str,
    terraform_action: Str,
    display_name: Str,
    consumes_terraform_slot: Bool,
    definition: TaskDefinitionView.nullable(),
  })
  .partial().passthrough();
const RecipePreview = z
  .object({
    type: Str,
    provider: Str,
    recipe_definition: Str,
    display_name: Str,
    description: Str,
    steps: z.array(RecipePreviewStep).nullable(),
  })
  .partial().passthrough();
const JiraTicketResponse = z
  .object({
    id: Num,
    targetSourceId: Num,
    serviceCode: Str,
    issueKey: Str,
    cloudProvider: Str,
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
const LastCheckInfoDto = z
  .object({
    status: Str,
    checked_at: Str,
    fail_reason: Str,
    installation_status_unavailable: Bool,
  })
  .partial().passthrough();
const IdcResourceInstallationStatusDto = z
  .object({
    resource_id: Str,
    installation_status: Str,
    bdc_side_cx_terraform_apply: CloudInstallationStepStatusDto.nullable(),
    bdc_side_bdp_terraform_apply: CloudInstallationStepStatusDto.nullable(),
    firewall_check: CloudInstallationStepStatusDto.nullable(),
  })
  .partial().passthrough();
const IdcInstallationStatusResponse = z
  .object({
    last_check: LastCheckInfoDto.nullable(),
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
const GcpResourceInstallationStatusDto = z
  .object({
    resource_id: Str,
    resource_name: Str,
    installation_status: Str,
    service_side_subnet_creation: CloudInstallationStepStatusDto.nullable(),
    service_side_terraform_apply: CloudInstallationStepStatusDto.nullable(),
    bdc_side_terraform_apply: CloudInstallationStepStatusDto.nullable(),
  })
  .partial().passthrough();
const GcpInstallationStatusResponse = z
  .object({
    last_check: LastCheckInfoDto.nullable(),
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
const AzurePrivateEndpointApprovalStepDto = z
  .object({
    id: Str,
    name: Str,
    status: Str,
    guide: Str,
  })
  .partial().passthrough();
const AzureResourceInstallationStatusDto = z
  .object({
    resource_id: Str,
    resource_name: Str,
    resource_type: Str,
    installation_status: Str,
    bdc_side_terraform_apply: CloudInstallationStepStatusDto.nullable(),
    service_side_private_endpoint_approval: AzurePrivateEndpointApprovalStepDto.nullable(),
    azure_virtual_machine_subnet_creation: CloudInstallationStepStatusDto.nullable(),
    azure_virtual_machine_terraform_apply: CloudInstallationStepStatusDto.nullable(),
  })
  .partial().passthrough();
const AzureInstallationStatusResponse = z
  .object({
    last_check: LastCheckInfoDto.nullable(),
    resources: z.array(AzureResourceInstallationStatusDto).nullable(),
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
    service_terraform: CloudInstallationStepStatusDto.nullable(),
    bdc_service_terraform: CloudInstallationStepStatusDto.nullable(),
    bdc_common_terraform: CloudInstallationStepStatusDto.nullable(),
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
    last_check: LastCheckInfoDto.nullable(),
    resources: z.array(AwsResourceInstallationStatusDto).nullable(),
    terraform_execution_role_verify: AwsTerraformExecutionRoleVerifyDto.nullable(),
  })
  .partial().passthrough();
const ApprovedIntegrationResponseDto = z
  .object({
    id: Num,
    request_id: Num,
    approved_at: Str,
    approved_by: ActorDto.nullable(),
    resources: z.array(TargetSourceResourceItemDto).nullable(),
  })
  .partial().passthrough();
const ApprovalRequestLatestDto = z
  .object({
    request: ApprovalRequestSummaryDto.nullable(),
    resources: z.array(TargetSourceResourceItemDto).nullable(),
    result: ApprovalActionResponseDto.nullable(),
  })
  .partial().passthrough();
const NlbIndexMappingDto = z
  .object({ service_code: Str, nlb_index: Num })
  .partial().passthrough();
const ResourceNlbIndexMappingDto = z
  .object({
    resource_id: Str,
    nlb_index_mapping_list: z.array(NlbIndexMappingDto).nullable(),
  })
  .partial().passthrough();
const Page = z
  .object({
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
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
const PageTestConnectionRejectStatusResponse = z
  .object({
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(TestConnectionRejectStatusResponse).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
  })
  .partial().passthrough();
const PageTargetSourceInfo = z
  .object({
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(TargetSourceInfo).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
  })
  .partial().passthrough();
const AuthorizedUsersResponse = z
  .object({ users: z.array(UserInfo).nullable() })
  .partial().passthrough();
const TargetSourceServiceInfoResponse = z
  .object({
    code: Str,
    serviceName: Str,
    abbr: Str,
    is_eos_service: Bool,
  })
  .partial().passthrough();
const TargetSourceMetadataResponse = z
  .object({
    id: Num,
    serviceType: Str,
    division: Str,
    cloudProvider: Str,
    state: Str,
    supportRawData: Bool,
    description: Str,
    createdAt: Str,
    updatedAt: Str,
    confirmStatus: Str,
    service_info: TargetSourceServiceInfoResponse.nullable(),
  })
  .partial().passthrough();
const ProcessStatusCurrentResponse = z
  .object({
    target_source_id: Num,
    process_status: Str,
    status_changed_at: Str,
    last_calculated_at: Str,
    delay_seconds: Num,
    evaluated_at: Str,
    target_source: TargetSourceMetadataResponse.nullable(),
  })
  .partial().passthrough();
const PageProcessStatusCurrentResponse = z
  .object({
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(ProcessStatusCurrentResponse).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
  })
  .partial().passthrough();
const ProcessStatusHistoryResponse = z
  .object({
    id: Num,
    target_source_id: Num,
    process_status: Str,
    changed_at: Str,
    target_source: TargetSourceMetadataResponse.nullable(),
  })
  .partial().passthrough();
const PageProcessStatusHistoryResponse = z
  .object({
    totalElements: Num,
    totalPages: Num,
    pageable: PageableObject.nullable(),
    first: Bool,
    last: Bool,
    size: Num,
    content: z.array(ProcessStatusHistoryResponse).nullable(),
    number: Num,
    sort: z.array(SortObject).nullable(),
    numberOfElements: Num,
    empty: Bool,
  })
  .partial().passthrough();
const TaskCheckView = z
  .object({
    call_count: Num,
    not_met_count: Num,
    api_error_count: Num,
    call_timeout_count: Num,
    last_external_status: Str,
    last_checked_at: Str,
  })
  .partial().passthrough();
const TerraformResultSummary = z
  .object({
    job_id: Str,
    succeeded: Bool,
    truncated: Bool,
    has_body: Bool,
    created_at: Str,
  })
  .partial().passthrough();
const TerraformJobStateSummary = z
  .object({
    job_id: Str,
    last_state: Str,
    last_fail_reason: Str,
    last_error: Str,
    poll_count: Num,
    last_polled_at: Str,
  })
  .partial().passthrough();
const TaskAttemptView = z
  .object({
    attempt_number: Num,
    status: Str,
    error_code: Str,
    failure_detail: Str,
    response: Str,
    started_at: Str,
    finished_at: Str,
    check: TaskCheckView.nullable(),
    terraform_results: z.array(TerraformResultSummary).nullable(),
    job_states: z.array(TerraformJobStateSummary).nullable(),
  })
  .partial().passthrough();
const TaskDetail = z
  .object({
    task_id: Num,
    pipeline_id: Num,
    sequence: Num,
    kind: Str,
    task_definition: Str,
    definition: TaskDefinitionView.nullable(),
    operation: Str,
    terraform_action: Str,
    status: Str,
    fail_count: Num,
    error_code: Str,
    consumes_terraform_slot: Bool,
    started_at: Str,
    ready_at: Str,
    finished_at: Str,
    next_check_at: Str,
    effective_polling_interval: z
      .object({
        seconds: Num,
        zero: Bool,
        nano: Num,
        negative: Bool,
        positive: Bool,
        units: z.array(
          z
            .object({
              durationEstimated: Bool,
              duration: z
                .object({
                  seconds: Num,
                  zero: Bool,
                  nano: Num,
                  negative: Bool,
                  positive: Bool,
                })
                .passthrough(),
              timeBased: Bool,
              dateBased: Bool,
            })
            .passthrough()
        ).nullable(),
      })
      .passthrough(),
    effective_execution_timeout: z
      .object({
        seconds: Num,
        zero: Bool,
        nano: Num,
        negative: Bool,
        positive: Bool,
        units: z.array(
          z
            .object({
              durationEstimated: Bool,
              duration: z
                .object({
                  seconds: Num,
                  zero: Bool,
                  nano: Num,
                  negative: Bool,
                  positive: Bool,
                })
                .passthrough(),
              timeBased: Bool,
              dateBased: Bool,
            })
            .passthrough()
        ).nullable(),
      })
      .passthrough(),
    effective_max_fail_count: Num,
    attempts: z.array(TaskAttemptView).nullable(),
    description: Str,
    origin_task_id: Num,
  })
  .partial().passthrough();
const TerraformJobStateDetail = z
  .object({
    task_id: Num,
    attempt_number: Num,
    job_id: Str,
    last_state: Str,
    last_fail_reason: Str,
    last_error: Str,
    last_response: Str,
    poll_count: Num,
    last_polled_at: Str,
  })
  .partial().passthrough();
const TerraformResultDetail = z
  .object({
    task_id: Num,
    attempt_number: Num,
    job_id: Str,
    succeeded: Bool,
    truncated: Bool,
    created_at: Str,
    content: Str,
  })
  .partial().passthrough();
const PipelineStatistics = z
  .object({
    period: Str,
    since: Str,
    pending_count: Num,
    running_count: Num,
    failed_count: Num,
    done_count: Num,
    cancelled_count: Num,
    total_count: Num,
  })
  .partial().passthrough();
const LivePipelineStatistics = z
  .object({
    running_pipeline_count: Num,
    pending_pipeline_count: Num,
    in_progress_terraform_task_count: Num,
    terraform_slot_cap: Num,
    running_pipeline_cap: Num,
    active_claim_count: Num,
  })
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
const DashboardSummaryResponse = z
  .object({
    pending_approval_count: Num,
    rejected_approval_count: Num,
    test_connection_completed_count: Num,
    test_connection_rejection_count: Num,
    evaluated_at: Str,
  })
  .partial().passthrough();
const JiraTicketDetachResponse = z
  .object({ issueKey: Str })
  .partial().passthrough();

export const schemas = {
  UpdateTestConnectionConfirmationRequest,
  UpdateCredentialRequest,
  SkipLogicalDatabaseItem,
  UpdateSkipLogicalDatabaseRequest,
  NlbIndexAssignmentDto,
  GuideContentRequest,
  GuideUpdateRequest,
  TestConnectionRejectRequest,
  TargetSourceResetRequestDto,
  CreatePipelineRequest,
  RestartPipelineRequest,
  CustomTaskRequest,
  CustomPipelineRequest,
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
  JiraTicketAttachRequest,
  Link,
  TerraformTaskStatusResponse,
  TerraformStatusResponse,
  ErrorMessage,
  TestConnectionConfirmationResponse,
  UpdateCredentialResponse,
  SkipLogicalDatabaseResponse,
  ActorDto,
  ApprovalActionResponseDto,
  ApprovalRequestDetailDto,
  GuideContents,
  GuideDetail,
  TestConnectionRejectResponse,
  TestConnectionTriggerResponse,
  ScanJobResponse,
  TaskSummary,
  RestartOriginView,
  PipelineDetail,
  ServiceInfoRefinedResponse,
  TargetSourceResponse,
  ApprovalUnavailableResponseDto,
  ApprovalUnavailableConfirmResponseDto,
  ApprovalRequestSummaryDto,
  TargetSourceMetadata,
  TestConnectionRejectStatusResponse,
  TestConnectionRejectStatusBatchResponse,
  LatestApprovalRequestSummaryDto,
  TargetSourceInfo,
  UserInfo,
  UserSearchResponse,
  SortObject,
  PageableObject,
  ServiceItem,
  PageServiceItem,
  UserMeResponse,
  TaskCatalogEntry,
  TaskCatalogResponse,
  AzureServicePrincipalVerificationResponse,
  TargetSourceDetail,
  TestedLogicalDatabaseItem,
  TestedLogicalDatabasesResponse,
  TestConnectionAgentResult,
  TestConnectionVersionResult,
  TestConnectionLatestResultSummaryResponse,
  TestConnectionHistoryItemResponse,
  PageTestConnectionHistoryItemResponse,
  TestConnectionExecutionHistoryResponse,
  PageTestConnectionExecutionHistoryResponse,
  TestConnectionCompletionStatusResponse,
  SecretResponse,
  PageScanJobResponse,
  CloudResourceResponse,
  ProcessStatusResponseDto,
  PipelineSummary,
  PagePipelineSummary,
  OriginSummary,
  SkippedTask,
  TaskToRun,
  RestartPreview,
  TaskDefinitionView,
  RecipePreviewStep,
  RecipePreview,
  JiraTicketResponse,
  IdcResourceInput,
  IdcPreviousRequestResponse,
  CloudInstallationStepStatusDto,
  LastCheckInfoDto,
  IdcResourceInstallationStatusDto,
  IdcInstallationStatusResponse,
  GcpServiceAccountInfoResponse,
  GcpResourceInstallationStatusDto,
  GcpInstallationStatusResponse,
  ResourceConfigDto,
  ConfirmedIntegrationResponse,
  AzurePrivateEndpointApprovalStepDto,
  AzureResourceInstallationStatusDto,
  AzureInstallationStatusResponse,
  AwsRoleVerificationResponse,
  AwsResourceInstallationStatusDto,
  AwsTerraformExecutionRoleVerifyDto,
  AwsInstallationStatusResponse,
  ApprovedIntegrationResponseDto,
  ApprovalRequestLatestDto,
  NlbIndexMappingDto,
  ResourceNlbIndexMappingDto,
  Page,
  PageTestConnectionRejectStatusResponse,
  PageTargetSourceInfo,
  AuthorizedUsersResponse,
  TargetSourceServiceInfoResponse,
  TargetSourceMetadataResponse,
  ProcessStatusCurrentResponse,
  PageProcessStatusCurrentResponse,
  ProcessStatusHistoryResponse,
  PageProcessStatusHistoryResponse,
  TaskCheckView,
  TerraformResultSummary,
  TerraformJobStateSummary,
  TaskAttemptView,
  TaskDetail,
  TerraformJobStateDetail,
  TerraformResultDetail,
  PipelineStatistics,
  LivePipelineStatistics,
  AzurePrivateLinkHealthResult,
  AzureHealthCheckResult,
  NlbOccupiedResourceResponse,
  NlbTableResponse,
  DashboardSummaryResponse,
  JiraTicketDetachResponse,
};
