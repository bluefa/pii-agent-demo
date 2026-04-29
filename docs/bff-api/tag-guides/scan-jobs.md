# Scan Jobs

> Confluence: 5.2.3.5.5.10.1.2
> 상태: Draft
> API Tag: `Scan Jobs`
> 담당: TBD
> 마지막 수정일: 2026-04-29

## 1. 목적

Cloud resource scan job 실행, 최신 상태 조회, 이력 조회를 담당하는 BFF API Tag다.

## 2. BFF Swagger

> Swagger 상태: Draft / Reviewing / Accepted / Implemented / Released / Deprecated

```yaml
openapi: 3.0.1
info:
  title: BFF API - Scan Jobs
  version: v0
servers:
- url: https://dip-stg.di.atlas.samsung.com
  description: Generated server url
tags:
- name: Scan Jobs
  description: Cloud resource scan job APIs
paths:
  /install/v1/target-sources/{targetSourceId}/scan:
    post:
      tags:
      - Scan Jobs
      summary: Start cloud resource scan
      description: Initiates an asynchronous scan of cloud resources for the specified target source ID
      operationId: startScan
      parameters:
      - name: targetSourceId
        in: path
        description: Target source ID
        required: true
        schema:
          type: integer
          format: int64
      responses:
        '202':
          description: Accepted
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ScanJobResponse'
        '400':
          description: Bad Request
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '403':
          description: Forbidden
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '404':
          description: Not Found
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '409':
          description: Conflict
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '501':
          description: Not Implemented
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '502':
          description: Bad Gateway
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '503':
          description: Service Unavailable
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/target-sources/{targetSourceId}/scanJob/latest:
    get:
      tags:
      - Scan Jobs
      summary: Get latest scan status
      description: Retrieves the status of the most recent scan job for the specified target source ID
      operationId: getLatestScan
      parameters:
      - name: targetSourceId
        in: path
        description: Target source ID
        required: true
        schema:
          type: integer
          format: int64
      responses:
        '200':
          description: OK
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ScanJobResponse'
        '400':
          description: Bad Request
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '403':
          description: Forbidden
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '404':
          description: Not Found
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '409':
          description: Conflict
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '501':
          description: Not Implemented
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '502':
          description: Bad Gateway
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '503':
          description: Service Unavailable
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
  /install/v1/target-sources/{targetSourceId}/scan/history:
    get:
      tags:
      - Scan Jobs
      summary: Get scan history
      description: Retrieves the scan history for the specified target source ID
      operationId: getScanHistory
      parameters:
      - name: targetSourceId
        in: path
        description: Target source ID
        required: true
        schema:
          type: integer
          format: int64
      - name: page
        in: query
        description: Page number (0-based)
        required: false
        schema:
          type: integer
          format: int32
          default: 0
      - name: size
        in: query
        description: Page size
        required: false
        schema:
          type: integer
          format: int32
          default: 10
      responses:
        '200':
          description: OK
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/PageScanJobResponse'
        '400':
          description: Bad Request
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '403':
          description: Forbidden
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '404':
          description: Not Found
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '409':
          description: Conflict
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '500':
          description: Internal Server Error
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '501':
          description: Not Implemented
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '502':
          description: Bad Gateway
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
        '503':
          description: Service Unavailable
          content:
            '*/*':
              schema:
                $ref: '#/components/schemas/ErrorMessage'
components:
  schemas:
    ErrorMessage:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
          description: UTC 기준 ISO-8601 timestamp 문자열. 화면 표시가 필요하면 클라이언트 로컬 timezone 기준으로 변환한다.
          example: "2026-04-29T02:27:09.123Z"
        status:
          type: string
          enum:
          - 100 CONTINUE
          - 101 SWITCHING_PROTOCOLS
          - 102 PROCESSING
          - 103 EARLY_HINTS
          - 103 CHECKPOINT
          - 200 OK
          - 201 CREATED
          - 202 ACCEPTED
          - 203 NON_AUTHORITATIVE_INFORMATION
          - 204 NO_CONTENT
          - 205 RESET_CONTENT
          - 206 PARTIAL_CONTENT
          - 207 MULTI_STATUS
          - 208 ALREADY_REPORTED
          - 226 IM_USED
          - 300 MULTIPLE_CHOICES
          - 301 MOVED_PERMANENTLY
          - 302 FOUND
          - 302 MOVED_TEMPORARILY
          - 303 SEE_OTHER
          - 304 NOT_MODIFIED
          - 305 USE_PROXY
          - 307 TEMPORARY_REDIRECT
          - 308 PERMANENT_REDIRECT
          - 400 BAD_REQUEST
          - 401 UNAUTHORIZED
          - 402 PAYMENT_REQUIRED
          - 403 FORBIDDEN
          - 404 NOT_FOUND
          - 405 METHOD_NOT_ALLOWED
          - 406 NOT_ACCEPTABLE
          - 407 PROXY_AUTHENTICATION_REQUIRED
          - 408 REQUEST_TIMEOUT
          - 409 CONFLICT
          - 410 GONE
          - 411 LENGTH_REQUIRED
          - 412 PRECONDITION_FAILED
          - 413 PAYLOAD_TOO_LARGE
          - 413 REQUEST_ENTITY_TOO_LARGE
          - 414 URI_TOO_LONG
          - 414 REQUEST_URI_TOO_LONG
          - 415 UNSUPPORTED_MEDIA_TYPE
          - 416 REQUESTED_RANGE_NOT_SATISFIABLE
          - 417 EXPECTATION_FAILED
          - 418 I_AM_A_TEAPOT
          - 419 INSUFFICIENT_SPACE_ON_RESOURCE
          - 420 METHOD_FAILURE
          - 421 DESTINATION_LOCKED
          - 422 UNPROCESSABLE_ENTITY
          - 423 LOCKED
          - 424 FAILED_DEPENDENCY
          - 425 TOO_EARLY
          - 426 UPGRADE_REQUIRED
          - 428 PRECONDITION_REQUIRED
          - 429 TOO_MANY_REQUESTS
          - 431 REQUEST_HEADER_FIELDS_TOO_LARGE
          - 451 UNAVAILABLE_FOR_LEGAL_REASONS
          - 500 INTERNAL_SERVER_ERROR
          - 501 NOT_IMPLEMENTED
          - 502 BAD_GATEWAY
          - 503 SERVICE_UNAVAILABLE
          - 504 GATEWAY_TIMEOUT
          - 505 HTTP_VERSION_NOT_SUPPORTED
          - 506 VARIANT_ALSO_NEGOTIATES
          - 507 INSUFFICIENT_STORAGE
          - 508 LOOP_DETECTED
          - 509 BANDWIDTH_LIMIT_EXCEEDED
          - 510 NOT_EXTENDED
          - 511 NETWORK_AUTHENTICATION_REQUIRED
        message:
          type: string
        path:
          type: string
    UpdateCredentialRequest:
      type: object
      properties:
        resourceId:
          type: string
        credentialId:
          type: string
    UpdateCredentialResponse:
      type: object
      properties:
        success:
          type: boolean
    ScanJobResponse:
      type: object
      properties:
        id:
          type: integer
          format: int64
        scan_status:
          type: string
          enum:
          - SCANNING
          - FAIL
          - CANCELED
          - SUCCESS
          - TIMEOUT
        target_source_id:
          type: integer
          format: int64
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        scan_version:
          type: integer
          format: int32
        scan_progress:
          type: integer
          format: int32
        duration_seconds:
          type: number
          format: float
        resource_count_by_resource_type:
          type: object
          additionalProperties:
            type: integer
            format: int64
        scan_error:
          type: string
          enum:
          - AUTH_PERMISSION_ERROR
          - RATE_LIMIT
          - NETWORK_ERROR
          - SERVICE_ERROR
          - UNKNOWN
    PiiAgentInstallationConfirmRequest:
      required:
      - confirm
      type: object
      properties:
        confirm:
          type: boolean
    ServiceInfoRefinedResponse:
      type: object
      properties:
        code:
          type: string
        serviceName:
          type: string
        abbr:
          type: string
        installed:
          type: boolean
        isEosService:
          type: boolean
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    TargetSourceResponse:
      type: object
      properties:
        id:
          type: integer
          format: int64
        serviceInfo:
          $ref: '#/components/schemas/ServiceInfoRefinedResponse'
        serviceType:
          type: string
        division:
          type: string
        cloudProvider:
          type: string
          enum:
          - AWS
          - GCP
          - AZURE
          - IDC
          - UNKNOWN
        state:
          type: string
          enum:
          - CREATED
          - CONFIRMED
          - PROVISIONING
          - ACTIVE
          - CONFIRM_FAILED
          - PROVISION_FAILED
          - DESTROY_FAILED
        supportRawData:
          type: boolean
        description:
          type: string
        cloudResourceAccessList:
          type: array
          items:
            type: object
            additionalProperties:
              type: object
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
        confirmStatus:
          type: string
          enum:
          - IDLE
          - PENDING
          - UNAVAILABLE
          - CONFIRMING
          - RESOURCE_CLEANING
          - RESOURCE_CLEAN_FAILED
          - CONFIRMED
        piiAgentInstalledAt:
          type: string
          format: date-time
    ApprovalRequestInputDto:
      type: object
      properties:
        resource_inputs:
          type: array
          items:
            $ref: '#/components/schemas/ResourceInputDto'
      description: Approval request input data
    ResourceConfigDto:
      type: object
      properties:
        resource_id:
          type: string
        resource_type:
          type: string
        database_type:
          type: string
        port:
          type: integer
          format: int32
        host:
          type: string
        oracle_service_id:
          type: string
        network_interface_id:
          type: string
        ip_configuration:
          type: string
        credential_id:
          type: string
        database_region:
          type: string
        resource_name:
          type: string
        scan_status:
          type: string
          enum:
          - UNCHANGED
          - NEW_SCAN
        integration_status:
          type: string
          enum:
          - INTEGRATED
          - NOT_INTEGRATED
    ResourceInputDto:
      type: object
      properties:
        resource_id:
          type: string
        selected:
          type: boolean
        resource_input:
          $ref: '#/components/schemas/ResourceConfigDto'
        exclusion_reason:
          type: string
    ActorDto:
      type: object
      properties:
        user_id:
          type: string
    ApprovalRequestSummaryDto:
      type: object
      properties:
        id:
          type: integer
          format: int64
        target_source_id:
          type: integer
          format: int64
        status:
          type: string
          enum:
          - PENDING
          - APPROVED
          - AUTO_APPROVED
          - REJECTED
          - CANCELLED
          - UNAVAILABLE
          - CONFIRMED
        requested_by:
          $ref: '#/components/schemas/ActorDto'
        requested_at:
          type: string
          format: date-time
        resource_total_count:
          type: integer
          format: int32
        resource_selected_count:
          type: integer
          format: int32
    ApprovalRejectRequestDto:
      required:
      - reason
      type: object
      properties:
        reason:
          type: string
      description: Rejection reason
    ApprovalActionResponseDto:
      type: object
      properties:
        request_id:
          type: integer
          format: int64
        status:
          type: string
          enum:
          - PENDING
          - APPROVED
          - AUTO_APPROVED
          - REJECTED
          - CANCELLED
          - UNAVAILABLE
          - CONFIRMED
        processed_by:
          $ref: '#/components/schemas/ActorDto'
        processed_at:
          type: string
          format: date-time
        reason:
          type: string
    ApprovalApproveRequestDto:
      type: object
      properties:
        comment:
          type: string
      description: Approval comment (optional)
    CreateTargetSourceRequest:
      type: object
      properties:
        description:
          type: string
        cloudProvider:
          type: string
        awsAccountId:
          type: string
        awsRegionType:
          type: string
        tenantId:
          type: string
        subscriptionId:
          type: string
        gcpProjectId:
          type: string
    CreateTargetSourceWithInfraRequest:
      type: object
      properties:
        description:
          type: string
        provider_type:
          type: string
          enum:
          - AWS
          - Azure
          - GCP
          - IDC
          - On-prem
          - Other_Cloud
          - SaaS
        provider_details:
          $ref: '#/components/schemas/ProviderDetails'
        database_type_list:
          type: array
          items:
            type: string
        cloud_provider:
          type: string
          enum:
          - AWS
          - GCP
          - AZURE
          - IDC
          - SDU
        auto_install:
          type: boolean
    TargetSourceInfo:
      type: object
      properties:
        targetSourceId:
          type: integer
          format: int64
        description:
          type: string
        cloudProvider:
          type: string
          enum:
          - AWS
          - GCP
          - AZURE
          - IDC
          - UNKNOWN
        createdAt:
          type: string
          format: date-time
        serviceCode:
          type: string
        updatedAt:
          type: string
          format: date-time
        metadata:
          $ref: '#/components/schemas/TargetSourceMetadata'
    TargetSourceMetadata:
      type: object
      properties:
        tenant_id:
          type: string
        subscription_id:
          type: string
        gcp_project_id:
          type: string
        aws_account_id:
          type: string
    UserInfo:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        email:
          type: string
    UserSearchResponse:
      type: object
      properties:
        users:
          type: array
          items:
            $ref: '#/components/schemas/UserInfo'
    PageServiceItem:
      type: object
      properties:
        totalPages:
          type: integer
          format: int32
        totalElements:
          type: integer
          format: int64
        size:
          type: integer
          format: int32
        content:
          type: array
          items:
            $ref: '#/components/schemas/ServiceItem'
        number:
          type: integer
          format: int32
        sort:
          type: array
          items:
            $ref: '#/components/schemas/SortObject'
        first:
          type: boolean
        last:
          type: boolean
        numberOfElements:
          type: integer
          format: int32
        pageable:
          $ref: '#/components/schemas/PageableObject'
        empty:
          type: boolean
    PageableObject:
      type: object
      properties:
        offset:
          type: integer
          format: int64
        sort:
          type: array
          items:
            $ref: '#/components/schemas/SortObject'
        paged:
          type: boolean
        pageNumber:
          type: integer
          format: int32
        pageSize:
          type: integer
          format: int32
        unpaged:
          type: boolean
    ServiceItem:
      type: object
      properties:
        service_code:
          type: string
        service_name:
          type: string
        division:
          type: string
        business_entity:
          type: string
        related_systems:
          type: array
          items:
            type: string
        managers:
          type: array
          items:
            type: string
        database_type_list:
          type: array
          items:
            type: string
    SortObject:
      type: object
      properties:
        direction:
          type: string
        nullHandling:
          type: string
        ascending:
          type: boolean
        property:
          type: string
        ignoreCase:
          type: boolean
    UserMeResponse:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        email:
          type: string
    TargetSourceDetail:
      type: object
      properties:
        description:
          type: string
        target_source_id:
          type: integer
          format: int64
        service_code:
          type: string
        process_status:
          type: string
          enum:
          - IDLE
          - PENDING
          - CONFIRMING
          - CONFIRMED
          - INSTALLED
          - CONNECTED
          - COMPLETED
        cloud_provider:
          type: string
          enum:
          - AWS
          - GCP
          - AZURE
          - IDC
          - UNKNOWN
        auto_install:
          type: boolean
        created_at:
          type: string
          format: date-time
        division:
          type: string
        business_entity:
          type: string
        related_systems:
          type: array
          items:
            type: string
        managers:
          type: array
          items:
            type: string
        metadata:
          $ref: '#/components/schemas/TargetSourceMetadata'
    SecretResponse:
      type: object
      properties:
        name:
          type: string
        create_time:
          type: integer
          format: int64
        create_time_str:
          type: string
    PageScanJobResponse:
      type: object
      properties:
        totalPages:
          type: integer
          format: int32
        totalElements:
          type: integer
          format: int64
        size:
          type: integer
          format: int32
        content:
          type: array
          items:
            $ref: '#/components/schemas/ScanJobResponse'
        number:
          type: integer
          format: int32
        sort:
          type: array
          items:
            $ref: '#/components/schemas/SortObject'
        first:
          type: boolean
        last:
          type: boolean
        numberOfElements:
          type: integer
          format: int32
        pageable:
          $ref: '#/components/schemas/PageableObject'
        empty:
          type: boolean
    CloudResourceResponse:
      type: object
      properties:
        resources:
          type: array
          items:
            $ref: '#/components/schemas/RecommendationResourceDto'
        total_count:
          type: integer
          format: int32
    RecommendationResourceDto:
      type: object
      properties:
        name:
          type: string
        metadata:
          type: object
        resource_id:
          type: string
        resource_type:
          type: string
          enum:
          - AWS_ATHENA
          - AWS_DB_CLUSTER
          - AWS_DB_INSTANCE
          - AWS_REDSHIFT_CLUSTER
          - AWS_DYNAMO_DB_TABLE
          - AWS_DYNAMO_DB_GLOBAL_TABLE
          - AWS_NETWORK_INTERFACE
          - AWS_SUBNET
          - AWS_RDS_GLOBAL_CLUSTER
          - AWS_RDS_SUBNET_GROUP
          - AWS_RDS_PROXY
          - AWS_RDS_DB_CLUSTER_PARAMETER_GROUP
          - AWS_RDS_DB_PARAMETER_GROUP
          - AWS_REDSHIFT_SUBNET_GROUP
          - AWS_VPC_ENDPOINT_SERVICE
          - AWS_VPC_ENDPOINT
          - AWS_VPC_SECURITY_GROUP
          - AWS_IAM_ROLE
          - AWS_GLUE_RESOURCE_POLICY
          - AWS_ECR_POLICY
          - AWS_S3_BUCKET_POLICY
          - AWS_GLUE_TABLE
          - AWS_EC2_INSTANCE
          - AWS_EC2_REGION
          - AWS_OPEN_SEARCH_DOMAIN
          - AWS_KMS
          - AWS_AUTO_SCALING_GROUP
          - AZURE_SQL_SERVER
          - AZURE_SQL_SERVER_MANAGED_INSTANCE
          - AZURE_MYSQL_FLEXIBLE_SERVER
          - AZURE_MYSQL
          - AZURE_POSTGRESQL
          - AZURE_POSTGRESQL_FLEXIBLE_SERVER
          - AZURE_MARIADB
          - AZURE_COSMOSDB_NOSQL
          - AZURE_SERVICE_PRINCIPAL
          - AZURE_PRIVATE_ENDPOINT
          - AZURE_VIRTUAL_MACHINE
          - AZURE_VIRTUAL_SUBNET
          - AZURE_SYNAPSE_WORKSPACE
          - AZURE_NETWORK_INTERFACE
          - GCP_SQL
          - GCP_BIGQUERY_DATASET_REGION
          - GCP_VPC_NETWORK
        integration_category:
          type: string
          enum:
          - TARGET
          - NO_INSTALL_NEEDED
          - INSTALL_INELIGIBLE
        recommend_fail_reason:
          type: string
          enum:
          - GCP_CLOUD_SQL_HAS_PUBLIC_IP
          - GCP_CLOUD_SQL_HAS_INTERNAL_HTTP_LOAD_BALANCER_SUBNET
          - AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED
        exclusion_reason:
          type: string
        scan_status:
          type: string
          enum:
          - ADDED
          - UNCHANGED
          - DELETED
        integration_status:
          type: string
          enum:
          - INTEGRATED
          - NOT_INTEGRATED
        is_integration_target:
          type: boolean
    ProcessStatusResponseDto:
      type: object
      properties:
        target_source_id:
          type: integer
          format: int64
        process_status:
          type: string
          enum:
          - IDLE
          - PENDING
          - CONFIRMING
          - CONFIRMED
          - INSTALLED
          - CONNECTED
          - COMPLETED
        healthy:
          type: string
          enum:
          - UNKNOWN
          - HEALTHY
          - UNHEALTHY
          - DEGRADED
        evaluated_at:
          type: string
          format: date-time
    GcpServiceAccountInfoResponse:
      type: object
      properties:
        gcpProjectId:
          type: string
        status:
          type: string
          enum:
          - VALID
          - INVALID
          - UNVERIFIED
        failReason:
          type: string
          enum:
          - SA_NOT_CONFIGURED
          - SA_NOT_FOUND
          - SA_INSUFFICIENT_PERMISSIONS
          - SCAN_SA_UNAVAILABLE
        failMessage:
          type: string
        lastVerifiedAt:
          type: string
          format: date-time
    GcpInstallationStatusResponse:
      type: object
      properties:
        last_check:
          $ref: '#/components/schemas/GcpLastCheckInfoDto'
        resources:
          type: array
          items:
            $ref: '#/components/schemas/GcpResourceInstallationStatusDto'
    GcpInstallationStepStatusDto:
      type: object
      properties:
        status:
          type: string
          enum:
          - COMPLETED
          - FAIL
          - IN_PROGRESS
          - SKIP
        guide:
          type: string
    GcpLastCheckInfoDto:
      type: object
      properties:
        status:
          type: string
          enum:
          - NEVER_CHECKED
          - IN_PROGRESS
          - COMPLETED
          - FAILED
        checked_at:
          type: string
          format: date-time
        fail_reason:
          type: string
    GcpResourceInstallationStatusDto:
      type: object
      properties:
        resource_id:
          type: string
        resource_name:
          type: string
        installation_status:
          type: string
          enum:
          - COMPLETED
          - FAIL
          - IN_PROGRESS
        service_side_subnet_creation:
          $ref: '#/components/schemas/GcpInstallationStepStatusDto'
        service_side_terraform_apply:
          $ref: '#/components/schemas/GcpInstallationStepStatusDto'
        bdc_side_terraform_apply:
          $ref: '#/components/schemas/GcpInstallationStepStatusDto'
    ConfirmedIntegrationResponse:
      type: object
      properties:
        resource_infos:
          type: array
          items:
            $ref: '#/components/schemas/ResourceConfigDto'
    AzureServicePrincipalVerificationResponse:
      type: object
      properties:
        app_id:
          type: string
        status:
          type: string
        fail_reason:
          type: string
        fail_message:
          type: string
        last_verified_at:
          type: string
          format: date-time
    AzureInstallationStatusResponse:
      type: object
      properties:
        last_check:
          $ref: '#/components/schemas/LastCheckInfo'
        resources:
          type: array
          items:
            $ref: '#/components/schemas/AzureResourceStatus'
    AzureResourceStatus:
      type: object
      properties:
        resource_id:
          type: string
        resource_name:
          type: string
        resource_type:
          type: string
        private_endpoint:
          $ref: '#/components/schemas/PrivateEndpointDetail'
        vm_installation:
          $ref: '#/components/schemas/VmInstallationDetail'
    LastCheckInfo:
      type: object
      properties:
        status:
          type: string
          enum:
          - SUCCESS
          - IN_PROGRESS
          - FAILED
        checked_at:
          type: string
          format: date-time
        fail_reason:
          type: string
    PrivateEndpointDetail:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        status:
          type: string
    VmInstallationDetail:
      type: object
      properties:
        subnet_exists:
          type: boolean
        load_balancer:
          type: object
    ApprovedIntegrationResponseDto:
      type: object
      properties:
        id:
          type: integer
          format: int64
        request_id:
          type: integer
          format: int64
        approved_at:
          type: string
          format: date-time
        approved_by:
          $ref: '#/components/schemas/ActorDto'
        resource_infos:
          type: array
          items:
            $ref: '#/components/schemas/ResourceConfigDto'
        excluded_resource_infos:
          type: array
          items:
            $ref: '#/components/schemas/ExcludedResourceInfo'
    ExcludedResourceInfo:
      type: object
      properties:
        resource_id:
          type: string
        exclusion_reason:
          type: string
        resource_name:
          type: string
        database_type:
          type: string
        database_region:
          type: string
        scan_status:
          type: string
          enum:
          - UNCHANGED
          - NEW_SCAN
        integration_status:
          type: string
          enum:
          - INTEGRATED
          - NOT_INTEGRATED
    ApprovalHistoryItemDto:
      type: object
      properties:
        request:
          $ref: '#/components/schemas/ApprovalRequestSummaryDto'
        result:
          $ref: '#/components/schemas/ApprovalActionResponseDto'
    Page:
      type: object
      properties:
        totalPages:
          type: integer
          format: int32
        totalElements:
          type: integer
          format: int64
        size:
          type: integer
          format: int32
        content:
          type: array
          items:
            type: object
        number:
          type: integer
          format: int32
        sort:
          type: array
          items:
            $ref: '#/components/schemas/SortObject'
        first:
          type: boolean
        last:
          type: boolean
        numberOfElements:
          type: integer
          format: int32
        pageable:
          $ref: '#/components/schemas/PageableObject'
        empty:
          type: boolean
    AuthorizedUsersResponse:
      type: object
      properties:
        users:
          type: array
          items:
            $ref: '#/components/schemas/UserInfo'
    AzureHealthCheckResult:
      type: object
      properties:
        healthCheckStatus:
          type: string
          enum:
          - HEALTHY
          - UPDATING
          - UNHEALTHY
          - UNHEALTHY_NEED_SERVICE_ACTION
          - UNHEALTHY_NEED_BDC_SIDE_ACTION
          - NEED_TERRAFORM_EXECUTION
          - NEED_SCAN_PERMISSION
          - INTERNAL_SERVER_ERROR
          - EMPTY
        azurePrivateLinkHealthResultList:
          type: array
          items:
            $ref: '#/components/schemas/AzurePrivateLinkHealthResult'
    AzurePrivateLinkHealthResult:
      type: object
      properties:
        provisioningState:
          type: string
        resourceId:
          type: string
        privateLinkId:
          type: string
        resourceType:
          type: string
          enum:
          - AWS_ATHENA
          - AWS_DB_CLUSTER
          - AWS_DB_INSTANCE
          - AWS_REDSHIFT_CLUSTER
          - AWS_DYNAMO_DB_TABLE
          - AWS_DYNAMO_DB_GLOBAL_TABLE
          - AWS_NETWORK_INTERFACE
          - AWS_SUBNET
          - AWS_RDS_GLOBAL_CLUSTER
          - AWS_RDS_SUBNET_GROUP
          - AWS_RDS_PROXY
          - AWS_RDS_DB_CLUSTER_PARAMETER_GROUP
          - AWS_RDS_DB_PARAMETER_GROUP
          - AWS_REDSHIFT_SUBNET_GROUP
          - AWS_VPC_ENDPOINT_SERVICE
          - AWS_VPC_ENDPOINT
          - AWS_VPC_SECURITY_GROUP
          - AWS_IAM_ROLE
          - AWS_GLUE_RESOURCE_POLICY
          - AWS_ECR_POLICY
          - AWS_S3_BUCKET_POLICY
          - AWS_GLUE_TABLE
          - AWS_EC2_INSTANCE
          - AWS_EC2_REGION
          - AWS_OPEN_SEARCH_DOMAIN
          - AWS_KMS
          - AWS_AUTO_SCALING_GROUP
          - AZURE_SQL_SERVER
          - AZURE_SQL_SERVER_MANAGED_INSTANCE
          - AZURE_MYSQL_FLEXIBLE_SERVER
          - AZURE_MYSQL
          - AZURE_POSTGRESQL
          - AZURE_POSTGRESQL_FLEXIBLE_SERVER
          - AZURE_MARIADB
          - AZURE_COSMOSDB_NOSQL
          - AZURE_SERVICE_PRINCIPAL
          - AZURE_PRIVATE_ENDPOINT
          - AZURE_VIRTUAL_MACHINE
          - AZURE_VIRTUAL_SUBNET
          - AZURE_SYNAPSE_WORKSPACE
          - AZURE_NETWORK_INTERFACE
          - GCP_SQL
          - GCP_BIGQUERY_DATASET_REGION
          - GCP_VPC_NETWORK
        healthCheckStatus:
          type: string
          enum:
          - HEALTHY
          - UPDATING
          - UNHEALTHY
          - UNHEALTHY_NEED_SERVICE_ACTION
          - UNHEALTHY_NEED_BDC_SIDE_ACTION
          - NEED_TERRAFORM_EXECUTION
          - NEED_SCAN_PERMISSION
          - INTERNAL_SERVER_ERROR
          - EMPTY
    Link:
      type: object
      properties:
        href:
          type: string
        templated:
          type: boolean
    InfrastructureInfo:
      type: object
      properties:
        id:
          type: string
        cloud_provider:
          type: string
          enum:
          - AWS_AUTO_AGENT
          - AWS_MANUAL_AGENT
          - GCP
          - AZURE
          - SDU
          - IDC
          - OTHER
        provider_details:
          $ref: '#/components/schemas/ProviderDetails'
        database_type_list:
          type: array
          items:
            type: string
        monitoring_module:
          type: string
          enum:
          - AWS_AGENT_AUTO
          - AWS_AGENT_MANUAL
          - AZURE_AGENT
          - GCP_AGENT
          - IDC_AGENT
          - SDU
        created_at:
          type: string
          format: date-time
    ProviderDetails:
      type: object
      properties:
        aws_payer_account:
          type: string
        aws_linked_account:
          type: string
        azure_tenant_id:
          type: string
        azure_subscription_id:
          type: string
        gcp_project_id:
          type: string
        other_cloud_provider_name:
          type: string
    ResourceHealthDto:
      type: object
      properties:
        resource_id:
          type: string
        health_status:
          type: string
          enum:
          - HEALTHY
          - UNHEALTHY
    UpdateExcludedLogicalDatabasesRequest:
      type: object
      required:
      - skip_logical_database_list
      properties:
        skip_logical_database_list:
          type: array
          items:
            type: object
            required:
            - database_name
            - reason
            - type
            properties:
              database_name:
                type: string
              schema_name:
                type: string
              reason:
                type: string
                enum:
                - TMP
                - STG
                - DEV
              type:
                type: string
                enum:
                - DATABASE
                - SCHEMA
    ExcludedLogicalDatabasesResponse:
      type: object
      required:
      - skip_logical_database_list
      properties:
        skip_logical_database_list:
          type: array
          items:
            type: object
            required:
            - database_name
            - reason
            - type
            properties:
              database_name:
                type: string
              schema_name:
                type: string
              reason:
                type: string
                enum:
                - TMP
                - STG
                - DEV
              type:
                type: string
                enum:
                - DATABASE
                - SCHEMA
    TestedLogicalDatabasesResponse:
      type: object
      required:
      - logical_database_list
      properties:
        logical_database_list:
          type: array
          items:
            type: object
            required:
            - database_name
            - type
            properties:
              database_name:
                type: string
              schema_name:
                type: string
              type:
                type: string
                enum:
                - DATABASE
                - SCHEMA
    UpdateTestConnectionConfirmationRequest:
      type: object
      required:
      - confirmed
      properties:
        confirmed:
          type: boolean
    TestConnectionConfirmationResponse:
      type: object
      required:
      - target_source_id
      - confirmed
      properties:
        target_source_id:
          type: integer
          format: int64
        confirmed:
          type: boolean
        confirmed_at:
          type: string
          format: date-time
          nullable: true
    ScanStatus:
      type: string
      enum:
      - ADDED
      - UNCHANGED
      - DELETED
    IntegrationStatus:
      type: string
      enum:
      - INTEGRATED
      - NOT_INTEGRATED
    ErrorResponse:
      type: object
      required:
      - error
      properties:
        error:
          type: object
          required:
          - code
          - message
          properties:
            code:
              type: string
            message:
              type: string
    TestConnectionTriggerResponse:
      type: object
      required:
      - success
      - id
      properties:
        success:
          type: boolean
          description: 요청 수락 여부
        id:
          type: string
          description: 생성된 연결 테스트 작업 ID. polling 시 사용
    TestConnectionJob:
      type: object
      description: 연결 테스트 작업의 전체 정보.
      required:
      - id
      - target_source_id
      - status
      - requested_at
      properties:
        id:
          type: string
          description: 연결 테스트 작업 고유 ID
          example: tc-20260218-001
        target_source_id:
          type: integer
          format: int64
        status:
          $ref: '#/components/schemas/TestConnectionStatus'
        requested_at:
          type: string
          format: date-time
          nullable: true
          description: 요청 시각. 아직 기록되지 않은 경우 null
        completed_at:
          type: string
          format: date-time
          nullable: true
          description: 테스트 완료 시각. PENDING 상태에서는 null
        requested_by:
          type: string
          description: 요청자 ID
        resource_test_results:
          type: array
          items:
            $ref: '#/components/schemas/ResourceTestResult'
    ResourceTestResult:
      type: object
      required:
      - resource_id
      - test_connection_status
      properties:
        resource_id:
          type: string
          description: 리소스 고유 식별자
        test_connection_status:
          $ref: '#/components/schemas/TestConnectionStatus'
          description: 해당 리소스의 테스트 연결 상태
    TestConnectionStatus:
      type: string
      enum:
      - PENDING
      - SUCCESS
      - FAIL
      description: '연결 테스트 상태:

        - PENDING: 테스트 진행 중 (= Running)

        - SUCCESS: 모든 리소스 연결 성공

        - FAIL: 1개 이상의 리소스 연결 실패

        '
    TestConnectionErrorStatus:
      type: string
      enum:
      - AUTH_FAIL
      - CONNECTION_FAIL
      - PERMISSION_DENIED
      description: '연결 테스트 실패 유형:

        - AUTH_FAIL: 인증 실패 (credential 오류)

        - CONNECTION_FAIL: 연결 실패 (네트워크/호스트 접근 불가)

        - PERMISSION_DENIED: 권한 부족 (접근 가능하나 권한 없음)

        '
    TestConnectionResultsResponse:
      type: object
      required:
      - content
      - page
      properties:
        content:
          type: array
          items:
            $ref: '#/components/schemas/TestConnectionJob'
        page:
          $ref: '#/components/schemas/PageInfo'
    PageInfo:
      type: object
      required:
      - totalElements
      - totalPages
      - number
      - size
      properties:
        totalElements:
          type: integer
          example: 5
        totalPages:
          type: integer
          example: 1
        number:
          type: integer
          description: 현재 페이지 번호 (0-based)
        size:
          type: integer
          description: 요청한 페이지 당 항목 수
    PiiAgentCommentDto:
      type: object
      properties:
        id:
          type: string
        targetSourceId:
          type: integer
          format: int64
        comment:
          type: string
        createdBy:
          type: string
        createdAt:
          type: string
          format: date-time
      required:
      - id
      - targetSourceId
      - comment
      - createdBy
      - createdAt
    PiiAgentCommentRequestDto:
      type: object
      properties:
        comment:
          type: string
      required:
      - comment
  parameters:
    TargetSourceId:
      name: targetSourceId
      in: path
      required: true
      schema:
        type: integer
        format: int64
        example: 1
    ResourceId:
      name: resourceId
      in: query
      required: true
      description: 리소스 고유 식별자
      schema:
        type: string
        example: resource-abc-123
  responses:
    NotFound:
      description: 리소스를 찾을 수 없음
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    TestedLogicalDatabaseNotFound:
      description: TC 결과 없음
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    Unauthorized:
      description: 인증 실패
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: UNAUTHORIZED
              message: 인증이 필요합니다.
    PermissionDenied:
      description: 인가 실패
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: FORBIDDEN
              message: 해당 리소스에 접근할 권한이 없습니다.
    TargetSourceNotFound:
      description: 대상 소스를 찾을 수 없음
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: TARGET_SOURCE_NOT_FOUND
              message: 해당 ID의 Target Source가 존재하지 않습니다.
```

## 2.1 실제 구현 대비 차이

> 검토 기준: 2026-04-27, `data-integration-platform/servers/api/self-installation-tool` Controller + `servers/api/core`/`self-installation-tool` DTO와 본 문서 Swagger 비교

### 1. 현재 BFF API에 구현되지 않았음

해당 없음.

### 2. Response Type 변경이 필요함

해당 없음.

## 3. API 목록

| Method | Path | 설명 | 상태 |
| --- | --- | --- | --- |
| POST | `/install/v1/target-sources/{targetSourceId}/scan` | scan job 시작 | Draft |
| GET | `/install/v1/target-sources/{targetSourceId}/scanJob/latest` | 최신 scan job 상태 조회 | Draft |
| GET | `/install/v1/target-sources/{targetSourceId}/scan/history` | scan job 이력 조회 | Draft |

## 4. Response 설명

| Response 항목 | 설명 | 관련 기준 |
| --- | --- | --- |
| `status` | Scan job의 진행 상태 의미를 작성 | Enum / 상태 카탈로그 |
| `history` | scan 이력 정렬, 표시 기준을 작성 | 공통 규칙 |

## 5. 주요 동작 규칙

- scan job 시작 가능 조건을 설명한다.
- 진행 중, 성공, 실패 상태의 화면 표시 기준을 설명한다.
- scan history 조회 기준과 pagination 정책을 설명한다.
