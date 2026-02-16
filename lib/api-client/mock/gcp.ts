import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as gcpFns from '@/lib/mock-gcp';
import { GCP_ERROR_CODES } from '@/lib/constants/gcp';

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
};
