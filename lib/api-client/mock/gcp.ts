import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as gcpFns from '@/lib/mock-gcp';
import { GCP_ERROR_CODES } from '@/lib/constants/gcp';
import type { GcpConnectionType } from '@/lib/types/gcp';

const authorize = async (projectId: string) => {
  const user = await mockData.getCurrentUser();
  if (!user) {
    return { error: NextResponse.json(
      { error: GCP_ERROR_CODES.UNAUTHORIZED.code, message: GCP_ERROR_CODES.UNAUTHORIZED.message },
      { status: GCP_ERROR_CODES.UNAUTHORIZED.status }
    ) };
  }

  const project = await mockData.getProjectById(projectId);
  if (!project) {
    return { error: NextResponse.json(
      { error: GCP_ERROR_CODES.NOT_FOUND.code, message: GCP_ERROR_CODES.NOT_FOUND.message },
      { status: GCP_ERROR_CODES.NOT_FOUND.status }
    ) };
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return { error: NextResponse.json(
      { error: GCP_ERROR_CODES.FORBIDDEN.code, message: GCP_ERROR_CODES.FORBIDDEN.message },
      { status: GCP_ERROR_CODES.FORBIDDEN.status }
    ) };
  }

  return { user, project };
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

export const mockGcp = {
  checkInstallation: async (projectId: string) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    return handleResult(await gcpFns.checkGcpInstallation(projectId));
  },

  getInstallationStatus: async (projectId: string) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    return handleResult(await gcpFns.getGcpInstallationStatus(projectId));
  },

  getRegionalManagedProxy: async (projectId: string, resourceId: string) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    if (!resourceId) {
      return NextResponse.json(
        { error: GCP_ERROR_CODES.VALIDATION_FAILED.code, message: 'resourceId 파라미터가 필요합니다.' },
        { status: GCP_ERROR_CODES.VALIDATION_FAILED.status }
      );
    }

    return handleResult(await gcpFns.getGcpRegionalManagedProxy(projectId, resourceId));
  },

  createProxySubnet: async (projectId: string, resourceId: string) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    if (!resourceId) {
      return NextResponse.json(
        { error: GCP_ERROR_CODES.VALIDATION_FAILED.code, message: 'resourceId가 필요합니다.' },
        { status: GCP_ERROR_CODES.VALIDATION_FAILED.status }
      );
    }

    return handleResult(await gcpFns.createGcpProxySubnet(projectId, resourceId));
  },

  getServiceTfResources: async (projectId: string, connectionType: string | null) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    if (!connectionType || !['PRIVATE_IP', 'PSC', 'BIGQUERY'].includes(connectionType)) {
      return NextResponse.json(
        { error: GCP_ERROR_CODES.VALIDATION_FAILED.code, message: '유효한 connectionType 파라미터가 필요합니다.' },
        { status: GCP_ERROR_CODES.VALIDATION_FAILED.status }
      );
    }

    return handleResult(await gcpFns.getGcpServiceTfResources(projectId, connectionType as GcpConnectionType));
  },
};
