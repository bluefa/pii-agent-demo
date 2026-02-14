import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as idcFns from '@/lib/mock-idc';
import { IDC_ERROR_CODES } from '@/lib/constants/idc';
import type { IdcResourceInput, IpType } from '@/lib/types/idc';
import type { Resource, DatabaseType } from '@/lib/types';

const authorize = async (projectId: string) => {
  const user = await mockData.getCurrentUser();
  if (!user) {
    return { error: NextResponse.json(
      { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
      { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
    ) };
  }

  const project = await mockData.getProjectById(projectId);
  if (!project) {
    return { error: NextResponse.json(
      { error: IDC_ERROR_CODES.NOT_FOUND.code, message: IDC_ERROR_CODES.NOT_FOUND.message },
      { status: IDC_ERROR_CODES.NOT_FOUND.status }
    ) };
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return { error: NextResponse.json(
      { error: IDC_ERROR_CODES.FORBIDDEN.code, message: IDC_ERROR_CODES.FORBIDDEN.message },
      { status: IDC_ERROR_CODES.FORBIDDEN.status }
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

export const mockIdc = {
  getSourceIpRecommendation: async (ipType: string | null) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
        { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
      );
    }

    if (!ipType || !['public', 'private', 'vpc'].includes(ipType)) {
      return NextResponse.json(
        { error: IDC_ERROR_CODES.INVALID_IP_TYPE.code, message: IDC_ERROR_CODES.INVALID_IP_TYPE.message },
        { status: IDC_ERROR_CODES.INVALID_IP_TYPE.status }
      );
    }

    return handleResult(await idcFns.getSourceIpRecommendation(ipType as IpType));
  },

  checkInstallation: async (projectId: string) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    return handleResult(await idcFns.checkIdcInstallation(projectId));
  },

  confirmFirewall: async (projectId: string) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    return handleResult(await idcFns.confirmFirewall(projectId));
  },

  confirmTargets: async (projectId: string, body: unknown) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    const parsed = body as { resources?: IdcResourceInput[] };

    if (!parsed.resources || !Array.isArray(parsed.resources) || parsed.resources.length === 0) {
      return NextResponse.json(
        { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: '최소 1개 이상의 리소스를 선택해야 합니다.' },
        { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
      );
    }

    return handleResult(await idcFns.confirmIdcTargets(projectId, parsed.resources));
  },

  getInstallationStatus: async (projectId: string) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    return handleResult(await idcFns.getIdcInstallationStatus(projectId));
  },

  getResources: async (projectId: string) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    const result = await idcFns.getIdcResources(projectId);
    if (result.error) {
      return NextResponse.json(
        { error: result.error.code, message: result.error.message },
        { status: result.error.status }
      );
    }
    return NextResponse.json({ resources: result.data });
  },

  updateResources: async (projectId: string, body: unknown) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    const parsed = body as { resources?: IdcResourceInput[] };

    if (!parsed.resources || !Array.isArray(parsed.resources)) {
      return NextResponse.json(
        { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: 'resources 필드가 필요합니다.' },
        { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
      );
    }

    const result = await idcFns.updateIdcResources(projectId, parsed.resources);
    if (result.error) {
      return NextResponse.json(
        { error: result.error.code, message: result.error.message },
        { status: result.error.status }
      );
    }
    return NextResponse.json({ resources: result.data });
  },

  updateResourcesList: async (projectId: string, body: unknown) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    const parsed = body as { keepResourceIds?: string[]; newResources?: IdcResourceInput[] };
    const { keepResourceIds = [], newResources = [] } = parsed;

    const keepResourceIdSet = new Set(keepResourceIds);
    const remainingResources = auth.project!.resources.filter((r) => keepResourceIdSet.has(r.id));

    const convertedNewResources: Resource[] = await Promise.all(
      newResources.map(async (input) => {
        const hostInfo = input.inputFormat === 'IP'
          ? (input.ips?.join(', ') || '')
          : (input.host || '');

        return {
          id: await mockData.generateId('idc-res'),
          type: 'IDC',
          resourceId: `${input.name} (${hostInfo}:${input.port})`,
          connectionStatus: 'PENDING' as const,
          isSelected: true,
          databaseType: input.databaseType as DatabaseType,
          lifecycleStatus: 'TARGET' as const,
          integrationCategory: 'TARGET' as const,
        };
      })
    );

    const allResources = [...remainingResources, ...convertedNewResources];

    if (allResources.length === 0) {
      return NextResponse.json(
        { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: '최소 1개 이상의 리소스가 필요합니다.' },
        { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
      );
    }

    const updatedProject = await mockData.updateProject(projectId, {
      resources: allResources,
    });

    return NextResponse.json({ project: updatedProject });
  },
};
