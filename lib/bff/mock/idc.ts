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

  checkInstallation: async (targetSourceId: string) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;
    return handleResult(idcFns.getIdcInstallationStatus(Number(targetSourceId)));
  },

  confirmFirewall: async (targetSourceId: string) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;
    return handleResult(idcFns.confirmIdcFirewall(Number(targetSourceId)));
  },

  getResources: async (targetSourceId: string) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;
    return handleResult(idcFns.getIdcResources(Number(targetSourceId)));
  },

  updateResources: async (targetSourceId: string, body: unknown) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;
    return handleResult(idcFns.updateIdcResources(Number(targetSourceId), body));
  },

  getSourceIpRecommendation: async (ipType: string) => {
    const user = mockData.getCurrentUser();
    if (!user) return errorResponse(AUTH_ERRORS.UNAUTHORIZED);
    return handleResult(idcFns.getIdcSourceIpRecommendation(ipType));
  },
};
