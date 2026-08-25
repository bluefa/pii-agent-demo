/**
 * TargetSourceDetail (snake wire) → TargetSource domain model.
 *
 * ADR-019: bff.targetSources.get returns raw snake TargetSourceDetail.
 * extractTargetSourceFromSnake is the single boundary for SSR pages that call
 * the BFF directly. CSR callers use getProject in app/lib/api/index.ts.
 *
 * process_status is no longer carried by the target-source payload — the caller
 * fetches it from the process-status endpoint and passes the raw wire value in.
 */
import type { CloudProvider, TargetSource } from '@/lib/types';
import { ProcessStatus, isSduProvider, normalizeCloudProvider } from '@/lib/types';
import type { schemas } from '@/lib/generated/install-v1';
import type { z } from 'zod';

type TargetSourceDetailWire = z.infer<typeof schemas.TargetSourceDetail>;

/**
 * 프로바이더별 스캔 주체를 담은 metadata 키. 계약은 셋을 각각 선언한다
 * (`TargetSourceMetadata`) — 같은 사실을 다른 이름으로 부르는 것뿐이다.
 * IDC 는 클라우드 스캔이 없어 주체도 없다.
 */
const SCAN_PRINCIPAL_KEYS: Record<CloudProvider, string | null> = {
  AWS: 'aws_scan_role_arn',
  GCP: 'gcp_scan_service_account',
  Azure: 'azure_scan_app_id',
  IDC: null,
};

/**
 * metadata → 이 대상을 스캔하는 주체 하나.
 *
 * ⛔ `??` 체인으로 쓰지 마라 — 세 키가 한 응답에 같이 실릴 수 있고(SDU 계정처럼 CSP 가
 * 겹치는 대상), 그러면 GCP 화면이 AWS ARN 을 제 것처럼 그린다. 프로바이더가 키를 고른다.
 */
export const pickScanPrincipal = (
  provider: CloudProvider,
  metadata: Record<string, unknown> | null | undefined,
): string | undefined => {
  const key = SCAN_PRINCIPAL_KEYS[provider];
  if (!key) return undefined;
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};

export const normalizeTargetSourceProcessStatus = (value: unknown): ProcessStatus => {
  switch (String(value).trim().toUpperCase()) {
    case 'WAITING_APPROVAL':
    case 'PENDING':
      return ProcessStatus.WAITING_APPROVAL;
    case 'APPLYING_APPROVED':
    case 'CONFIRMING':
      return ProcessStatus.APPLYING_APPROVED;
    case 'CONFIRMED':
      return ProcessStatus.INSTALLING;
    case 'INSTALLED':
      return ProcessStatus.WAITING_CONNECTION_TEST;
    case 'CONNECTED':
      return ProcessStatus.CONNECTION_VERIFIED;
    case 'TARGET_CONFIRMED':
    case 'COMPLETED':
      return ProcessStatus.INSTALLATION_COMPLETE;
    case 'REQUEST_REQUIRED':
    case 'IDLE':
    default:
      return ProcessStatus.WAITING_TARGET_CONFIRMATION;
  }
};

/**
 * SSR adapter: snake TargetSourceDetail (from bff.targetSources.get) → TargetSource.
 * processStatusWire is the raw `process_status` from the process-status endpoint.
 */
export const extractTargetSourceFromSnake = (
  raw: TargetSourceDetailWire,
  processStatusWire: unknown,
): TargetSource => {
  const item = raw as Record<string, unknown>;
  const asStr = (v: unknown): string | undefined => typeof v === 'string' ? v : undefined;
  const asBool = (v: unknown): boolean | undefined => typeof v === 'boolean' ? v : undefined;

  const id = typeof item.target_source_id === 'number' ? item.target_source_id : 0;
  const fallbackCode = `TS-${id}`;
  const serviceCode = asStr(item.service_code)?.trim() ?? '';
  const processStatus = normalizeTargetSourceProcessStatus(processStatusWire);
  const metadata = (typeof item.metadata === 'object' && item.metadata !== null)
    ? item.metadata as Record<string, unknown>
    : null;

  const tenantId = asStr(metadata?.tenant_id);
  const subscriptionId = asStr(metadata?.subscription_id);
  const awsAccountId = asStr(metadata?.aws_account_id);
  // 등록된 Terraform 실행 Role — Step 4 권한 패널의 유일한 출처. 설치 상태/검증 응답의
  // 같은 이름 필드는 '검증이 본 값'이라 검증 전에는 비어 있다(CloudTargetSource 주석).
  const awsTerraformExecutionRoleArn = asStr(metadata?.aws_terraform_execution_role_arn);
  const gcpProjectId = asStr(metadata?.gcp_project_id);
  const cloudProvider = normalizeCloudProvider(asStr(item.cloud_provider));
  const scanPrincipal = pickScanPrincipal(cloudProvider, metadata);
  // Both readings of SDU, and the same two-state collapse the CSR adapter makes —
  // this is the SSR path for the detail page, and the two must not disagree.
  const isSduType = asBool(metadata?.is_sdu_type) || isSduProvider(item.cloud_provider);
  const isTerraformExecutionGranted =
    metadata?.grant_service_terraform_execution_permission === true;
  const createdAt = asStr(item.created_at) ?? new Date().toISOString();

  return {
    id: fallbackCode,
    targetSourceId: id,
    projectCode: serviceCode || fallbackCode,
    serviceCode,
    serviceName: asStr(item.service_name)?.trim() || serviceCode,
    processStatus,
    cloudProvider,
    createdAt,
    updatedAt: asStr(item.updated_at) ?? createdAt,
    name: fallbackCode,
    description: asStr(item.description) ?? '',
    isRejected: false,
    // Unconditional, unlike the optional identity fields below it: the install mode is
    // two-state, so there is no "absent" to preserve — omitting the key IS the false.
    isTerraformExecutionGranted,
    ...(tenantId ? { tenantId } : {}),
    ...(subscriptionId ? { subscriptionId } : {}),
    ...(awsAccountId ? { awsAccountId } : {}),
    ...(awsTerraformExecutionRoleArn ? { awsTerraformExecutionRoleArn } : {}),
    ...(gcpProjectId ? { gcpProjectId } : {}),
    ...(scanPrincipal ? { scanPrincipal } : {}),
    ...(isSduType !== undefined ? { isSduType } : {}),
  };
};
