import type { TargetSource, SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import type {
  AwsCheckInstallationResult,
  AwsInstallationStatusResponse,
  AwsSetInstallationModeResult,
  AwsTerraformScriptResponse,
  AwsVerifyTfRoleResult,
} from '@/lib/bff/types/aws';
import type {
  AzureCheckInstallationResult,
  AzureInstallationStatusResponse,
  AzureScanAppResponse,
  AzureSettingsResponse,
  AzureSubnetGuideResponse,
  AzureVmCheckInstallationResult,
  AzureVmInstallationStatusResponse,
  AzureVmTerraformScriptResponse,
} from '@/lib/bff/types/azure';
import type {
  GcpCheckInstallationResult,
  GcpInstallationStatusResponse,
  GcpScanServiceAccountResponse,
  GcpTerraformServiceAccountResponse,
} from '@/lib/bff/types/gcp';

interface AwsSetInstallationModeBody {
  mode: 'AUTO' | 'MANUAL';
}

interface AwsVerifyTfRoleBody {
  roleArn?: string;
  accountId?: string;
}

/**
 * BFF 데이터 접근 인터페이스.
 * 순수 도메인 데이터를 반환한다 (NextResponse 아님).
 *
 * - mock: 기존 mock 핸들러를 래핑하여 데이터 추출
 * - http : 실제 BFF API 호출
 */
export interface BffClient {
  targetSources: {
    get: (id: number) => Promise<TargetSource>;
    secrets: (id: number) => Promise<SecretKey[]>;
  };
  users: {
    me: () => Promise<CurrentUser>;
  };
  aws: {
    checkInstallation: (id: number) => Promise<AwsCheckInstallationResult>;
    setInstallationMode: (id: number, body: AwsSetInstallationModeBody) => Promise<AwsSetInstallationModeResult>;
    getInstallationStatus: (id: number) => Promise<AwsInstallationStatusResponse>;
    getTerraformScript: (id: number) => Promise<AwsTerraformScriptResponse>;
    verifyTfRole: (id: number, body?: AwsVerifyTfRoleBody) => Promise<AwsVerifyTfRoleResult>;
  };
  azure: {
    checkInstallation: (id: number) => Promise<AzureCheckInstallationResult>;
    getInstallationStatus: (id: number) => Promise<AzureInstallationStatusResponse>;
    getSettings: (id: number) => Promise<AzureSettingsResponse>;
    getSubnetGuide: (id: number) => Promise<AzureSubnetGuideResponse>;
    getScanApp: (id: number) => Promise<AzureScanAppResponse>;
    vmCheckInstallation: (id: number) => Promise<AzureVmCheckInstallationResult>;
    vmGetInstallationStatus: (id: number) => Promise<AzureVmInstallationStatusResponse>;
    vmGetTerraformScript: (id: number) => Promise<AzureVmTerraformScriptResponse>;
  };
  gcp: {
    checkInstallation: (id: number) => Promise<GcpCheckInstallationResult>;
    getInstallationStatus: (id: number) => Promise<GcpInstallationStatusResponse>;
    getScanServiceAccount: (id: number) => Promise<GcpScanServiceAccountResponse>;
    getTerraformServiceAccount: (id: number) => Promise<GcpTerraformServiceAccountResponse>;
  };
}
