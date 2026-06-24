import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as idcFns from '@/lib/mock-idc';
import type { MockIdcError } from '@/lib/mock-idc';

const AUTH_ERRORS = {
  UNAUTHORIZED: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.', status: 401 },
  NOT_FOUND: { code: 'TARGET_SOURCE_NOT_FOUND', message: '요청하신 Target Source를 찾을 수 없습니다.', status: 404 },
  FORBIDDEN: { code: 'FORBIDDEN', message: '해당 리소스에 접근할 권한이 없습니다.', status: 403 },
} as const;

const errorResponse = (e: { code: string; message: string; status: number }) =>
  NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });

const authorize = (targetSourceId: string) => {
  const user = mockData.getCurrentUser();
  if (!user) return { error: errorResponse(AUTH_ERRORS.UNAUTHORIZED) };

  const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
  if (!project) return { error: errorResponse(AUTH_ERRORS.NOT_FOUND) };

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return { error: errorResponse(AUTH_ERRORS.FORBIDDEN) };
  }
  return { user, project };
};

const handleResult = (result: { error?: MockIdcError; data?: unknown }) => {
  if (result.error) return errorResponse(result.error);
  return NextResponse.json(result.data);
};

export const mockIdc = {
  getInstallationStatus: async (targetSourceId: string) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;
    return handleResult(idcFns.getIdcInstallationStatus(Number(targetSourceId)));
  },

  getPreviousRequest: async (targetSourceId: string) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;
    return handleResult(idcFns.getIdcPreviousRequest(Number(targetSourceId)));
  },

  // ADR-019 NLB endpoints (camelCase ON THE WIRE per swagger). Array responses.
  getOccupiedResources: async (_nlbIndex: string) => {
    const user = mockData.getCurrentUser();
    if (!user) return errorResponse(AUTH_ERRORS.UNAUTHORIZED);
    return NextResponse.json([
      {
        serviceCode: 'svc-a',
        serviceName: 'Service A',
        targetSourceId: 1001,
        isLatest: true,
        ipSet: ['10.20.30.40', '10.20.30.41'],
        port: 3306,
        databaseType: 'MYSQL',
        databaseName: 'orders',
      },
    ]);
  },

  getNlbTable: async () => {
    const user = mockData.getCurrentUser();
    if (!user) return errorResponse(AUTH_ERRORS.UNAUTHORIZED);
    return NextResponse.json([
      { nlbIndex: 0, nlbIpList: ['172.16.10.10', '172.16.10.11'], occupiedListenerCount: 3 },
      { nlbIndex: 1, nlbIpList: ['172.16.10.20'], occupiedListenerCount: 0 },
    ]);
  },
};
