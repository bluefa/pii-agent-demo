import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as azureFns from '@/lib/mock-azure';
import { AZURE_ERROR_CODES } from '@/lib/constants/azure';

const authorize = async (projectId: string) => {
  const user = await mockData.getCurrentUser();
  if (!user) {
    return { error: NextResponse.json(
      { error: AZURE_ERROR_CODES.UNAUTHORIZED.code, message: AZURE_ERROR_CODES.UNAUTHORIZED.message },
      { status: AZURE_ERROR_CODES.UNAUTHORIZED.status }
    ) };
  }

  const project = mockData.getProjectByTargetSourceId(Number(projectId));
  if (!project) {
    return { error: NextResponse.json(
      { error: AZURE_ERROR_CODES.NOT_FOUND.code, message: AZURE_ERROR_CODES.NOT_FOUND.message },
      { status: AZURE_ERROR_CODES.NOT_FOUND.status }
    ) };
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return { error: NextResponse.json(
      { error: AZURE_ERROR_CODES.FORBIDDEN.code, message: AZURE_ERROR_CODES.FORBIDDEN.message },
      { status: AZURE_ERROR_CODES.FORBIDDEN.status }
    ) };
  }

  return { project };
};

const handleResult = (result: { error?: { code: string; message: string; status: number }; data?: unknown }) => {
  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }
  return NextResponse.json(result.data);
};

export const mockAzure = {
  checkInstallation: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(azureFns.checkAzureInstallation(Number(projectId)));
  },

  getInstallationStatus: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(azureFns.getAzureInstallationStatus(Number(projectId)));
  },

  getSubnetGuide: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(azureFns.getAzureSubnetGuide(Number(projectId)));
  },

  vmCheckInstallation: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(azureFns.checkAzureVmInstallation(Number(projectId)));
  },

  vmGetInstallationStatus: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(azureFns.getAzureVmInstallationStatus(Number(projectId)));
  },

  getScanApp: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    const result = azureFns.getAzureServiceSettings(auth.project!.serviceCode);
    if (result.error) return handleResult(result);

    const scanApp = result.data!.scanApp;
    const data = scanApp.registered
      ? { app_id: scanApp.appId, status: scanApp.status ?? 'HEALTHY', fail_reason: null, fail_message: null, last_verified_at: scanApp.lastVerifiedAt ?? new Date().toISOString() }
      : { app_id: null, status: 'UNREGISTERED', fail_reason: null, fail_message: null, last_verified_at: null };

    return NextResponse.json(data);
  },

  vmGetTerraformScript: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(azureFns.getAzureVmTerraformScript(Number(projectId)));
  },
};
