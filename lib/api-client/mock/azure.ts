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

  const project = await mockData.getProjectById(projectId);
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

    return handleResult(await azureFns.checkAzureInstallation(projectId));
  },

  getInstallationStatus: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(await azureFns.getAzureInstallationStatus(projectId));
  },

  getSubnetGuide: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(await azureFns.getAzureSubnetGuide(projectId));
  },

  vmCheckInstallation: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(await azureFns.checkAzureVmInstallation(projectId));
  },

  vmGetInstallationStatus: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(await azureFns.getAzureVmInstallationStatus(projectId));
  },

  getSettings: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(await azureFns.getAzureServiceSettings(auth.project!.serviceCode));
  },

  vmGetTerraformScript: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(await azureFns.getAzureVmTerraformScript(projectId));
  },
};
