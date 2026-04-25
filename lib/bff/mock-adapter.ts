/**
 * 기존 mock 핸들러(NextResponse 반환)를 BffClient 인터페이스로 래핑한다.
 * mock 비즈니스 로직(인증, 상태 전이, 검증)을 그대로 재사용하면서
 * NextResponse → 순수 데이터로 변환만 수행한다.
 */
import type { NextResponse } from 'next/server';
import type { BffClient } from '@/lib/bff/types';
import type { SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import { BffError } from '@/lib/bff/errors';
import { extractBffError, type BffErrorBody } from '@/app/api/_lib/problem';
import { mockTargetSources } from '@/lib/api-client/mock/target-sources';
import { mockProjects } from '@/lib/api-client/mock/projects';
import { mockUsers } from '@/lib/api-client/mock/users';
import { mockAws } from '@/lib/api-client/mock/aws';
import { mockAzure } from '@/lib/api-client/mock/azure';
import { mockGcp } from '@/lib/api-client/mock/gcp';
import { extractTargetSource, type TargetSourceDetailResponse } from '@/lib/target-source-response';
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

async function unwrap<T>(response: NextResponse): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    // Use shared extractBffError so nested { error: { code, message } } and
    // flat shapes parity-match transformLegacyError (problem.ts).
    const { code, message } = extractBffError(data as BffErrorBody);
    throw new BffError(
      response.status,
      code || 'INTERNAL_ERROR',
      message || `HTTP ${response.status}`,
    );
  }
  return data as T;
}

export const mockBff: BffClient = {
  targetSources: {
    get: async (id) => {
      const res = await mockTargetSources.get(String(id));
      const data = await unwrap<TargetSourceDetailResponse>(res);
      return extractTargetSource(data);
    },

    secrets: async (id) => {
      const res = await mockProjects.credentials(String(id));
      const data = await unwrap<{
        credentials: Array<{ name: string; databaseType?: string; createdAt: string }>;
      }>(res);
      return data.credentials.map((c): SecretKey => ({
        name: c.name,
        createTimeStr: c.createdAt,
      }));
    },
  },

  users: {
    me: async () => {
      const res = await mockUsers.getMe();
      const data = await unwrap<{ user: CurrentUser }>(res);
      return data.user;
    },
  },

  aws: {
    checkInstallation: async (id) =>
      unwrap<AwsCheckInstallationResult>(await mockAws.checkInstallation(String(id))),
    setInstallationMode: async (id, body) =>
      unwrap<AwsSetInstallationModeResult>(await mockAws.setInstallationMode(String(id), body)),
    getInstallationStatus: async (id) =>
      unwrap<AwsInstallationStatusResponse>(await mockAws.getInstallationStatus(String(id))),
    getTerraformScript: async (id) =>
      unwrap<AwsTerraformScriptResponse>(await mockAws.getTerraformScript(String(id))),
    verifyTfRole: async (id, body) =>
      unwrap<AwsVerifyTfRoleResult>(await mockAws.verifyTfRole(String(id), body)),
  },

  azure: {
    checkInstallation: async (id) =>
      unwrap<AzureCheckInstallationResult>(await mockAzure.checkInstallation(String(id))),
    getInstallationStatus: async (id) =>
      unwrap<AzureInstallationStatusResponse>(await mockAzure.getInstallationStatus(String(id))),
    getSettings: async (id) =>
      unwrap<AzureSettingsResponse>(await mockAzure.getSettings(String(id))),
    getSubnetGuide: async (id) =>
      unwrap<AzureSubnetGuideResponse>(await mockAzure.getSubnetGuide(String(id))),
    getScanApp: async (id) =>
      unwrap<AzureScanAppResponse>(await mockAzure.getScanApp(String(id))),
    vmCheckInstallation: async (id) =>
      unwrap<AzureVmCheckInstallationResult>(await mockAzure.vmCheckInstallation(String(id))),
    vmGetInstallationStatus: async (id) =>
      unwrap<AzureVmInstallationStatusResponse>(await mockAzure.vmGetInstallationStatus(String(id))),
    vmGetTerraformScript: async (id) =>
      unwrap<AzureVmTerraformScriptResponse>(await mockAzure.vmGetTerraformScript(String(id))),
  },

  gcp: {
    checkInstallation: async (id) =>
      unwrap<GcpCheckInstallationResult>(await mockGcp.checkInstallation(String(id))),
    getInstallationStatus: async (id) =>
      unwrap<GcpInstallationStatusResponse>(await mockGcp.getInstallationStatus(String(id))),
    getScanServiceAccount: async (id) =>
      unwrap<GcpScanServiceAccountResponse>(await mockGcp.getScanServiceAccount(String(id))),
    getTerraformServiceAccount: async (id) =>
      unwrap<GcpTerraformServiceAccountResponse>(await mockGcp.getTerraformServiceAccount(String(id))),
  },
};
