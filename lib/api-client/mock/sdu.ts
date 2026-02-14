import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { SDU_ERROR_CODES } from '@/lib/constants/sdu';

export const mockSdu = {
  checkInstallation: async (projectId: string) => {
    const user = await dataAdapter.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: SDU_ERROR_CODES.UNAUTHORIZED.code, message: SDU_ERROR_CODES.UNAUTHORIZED.message },
        { status: SDU_ERROR_CODES.UNAUTHORIZED.status }
      );
    }

    const project = await dataAdapter.getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: SDU_ERROR_CODES.NOT_FOUND.code, message: SDU_ERROR_CODES.NOT_FOUND.message },
        { status: SDU_ERROR_CODES.NOT_FOUND.status }
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
      return NextResponse.json(
        { error: SDU_ERROR_CODES.FORBIDDEN.code, message: SDU_ERROR_CODES.FORBIDDEN.message },
        { status: SDU_ERROR_CODES.FORBIDDEN.status }
      );
    }

    if (project.cloudProvider !== 'SDU') {
      return NextResponse.json(
        { error: SDU_ERROR_CODES.NOT_SDU_PROJECT.code, message: SDU_ERROR_CODES.NOT_SDU_PROJECT.message },
        { status: SDU_ERROR_CODES.NOT_SDU_PROJECT.status }
      );
    }

    const result = await dataAdapter.checkSduInstallation(projectId);
    if (result.error) {
      return NextResponse.json(
        { error: result.error.code, message: result.error.message },
        { status: result.error.status }
      );
    }

    return NextResponse.json(result.data);
  },
};
