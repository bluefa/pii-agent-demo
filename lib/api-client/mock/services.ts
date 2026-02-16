import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as mockServiceSettings from '@/lib/mock-service-settings';
import * as azureFns from '@/lib/mock-azure';
import * as idcFns from '@/lib/mock-idc';
import { AZURE_ERROR_CODES } from '@/lib/constants/azure';
import { IDC_ERROR_CODES } from '@/lib/constants/idc';
import type { UpdateAwsSettingsRequest } from '@/lib/types';
import type { UpdateIdcSettingsRequest } from '@/lib/types/idc';

export const mockServices = {
  permissions: {
    list: async (serviceCode: string) => {
      const user = await mockData.getCurrentUser();

      if (!user || user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: '관리자만 권한을 조회할 수 있습니다.' },
          { status: 403 }
        );
      }

      const allUsers = mockData.mockUsers;
      const usersWithPermission = allUsers
        .filter((u) => u.serviceCodePermissions.includes(serviceCode))
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        }));

      return NextResponse.json({ users: usersWithPermission });
    },

    add: async (serviceCode: string, body: unknown) => {
      const user = await mockData.getCurrentUser();

      if (!user || user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: '관리자만 권한을 추가할 수 있습니다.' },
          { status: 403 }
        );
      }

      if (!(mockData.mockServiceCodes.find((s) => s.code === serviceCode))) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: '존재하지 않는 서비스 코드입니다.' },
          { status: 404 }
        );
      }

      const { userId } = (body ?? {}) as { userId: string };

      const allUsers = mockData.mockUsers;
      const targetUser = allUsers.find((u) => u.id === userId);

      if (!targetUser) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: '해당 사용자를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      if (targetUser.serviceCodePermissions.includes(serviceCode)) {
        return NextResponse.json(
          { error: 'ALREADY_EXISTS', message: '이미 해당 서비스에 대한 권한이 있습니다.' },
          { status: 400 }
        );
      }

      targetUser.serviceCodePermissions.push(serviceCode);

      return NextResponse.json({
        success: true,
        user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
      });
    },

    remove: async (serviceCode: string, userId: string) => {
      const user = await mockData.getCurrentUser();

      if (!user || user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: '관리자만 권한을 제거할 수 있습니다.' },
          { status: 403 }
        );
      }

      const allUsers = mockData.mockUsers;
      const targetUser = allUsers.find((u) => u.id === userId);

      if (!targetUser) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const index = targetUser.serviceCodePermissions.indexOf(serviceCode);

      if (index === -1) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: '해당 사용자는 이 서비스에 대한 권한이 없습니다.' },
          { status: 404 }
        );
      }

      targetUser.serviceCodePermissions.splice(index, 1);

      return NextResponse.json({ success: true });
    },
  },

  projects: {
    list: async (serviceCode: string) => {
      const user = await mockData.getCurrentUser();

      if (!user) {
        return NextResponse.json(
          { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
          { status: 401 }
        );
      }

      if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: '해당 서비스에 대한 권한이 없습니다.' },
          { status: 403 }
        );
      }

      const projects = (await mockData.getProjectsByServiceCode(serviceCode)).map((p) => {
        const selectedResources = p.resources.filter((r) => r.isSelected);
        const hasDisconnected = selectedResources.some((r) => r.connectionStatus === 'DISCONNECTED');
        const connectionTestComplete = selectedResources.length > 0 &&
          selectedResources.every((r) => r.connectionStatus === 'CONNECTED');

        return {
          id: p.id,
          targetSourceId: p.targetSourceId,
          projectCode: p.projectCode,
          processStatus: p.processStatus,
          cloudProvider: p.cloudProvider,
          resourceCount: p.resources.length,
          hasDisconnected,
          hasNew: false,
          description: p.description,
          isRejected: p.isRejected,
          rejectionReason: p.rejectionReason,
          connectionTestComplete,
          createdAt: p.createdAt,
        };
      });

      return NextResponse.json({ projects });
    },
  },

  settings: {
    aws: {
      get: async (serviceCode: string) => {
        try {
          const service = mockData.mockServiceCodes.find((s) => s.code === serviceCode);

          if (!service) {
            return NextResponse.json(
              { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
              { status: 404 }
            );
          }

          const settings = await mockServiceSettings.getAwsServiceSettings(serviceCode);
          return NextResponse.json(settings);
        } catch {
          return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
            { status: 500 }
          );
        }
      },

      update: async (serviceCode: string, body: unknown) => {
        try {
          const service = mockData.mockServiceCodes.find((s) => s.code === serviceCode);

          if (!service) {
            return NextResponse.json(
              { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
              { status: 404 }
            );
          }

          const typedBody = body as UpdateAwsSettingsRequest;

          if (!typedBody.accountId || !typedBody.scanRoleArn) {
            return NextResponse.json(
              { error: 'INVALID_REQUEST', message: 'accountId와 scanRoleArn은 필수입니다.' },
              { status: 400 }
            );
          }

          const result = await mockServiceSettings.updateAwsServiceSettings(serviceCode, typedBody);
          return NextResponse.json(result);
        } catch {
          return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
            { status: 500 }
          );
        }
      },

      verifyScanRole: async (serviceCode: string) => {
        try {
          const service = mockData.mockServiceCodes.find((s) => s.code === serviceCode);

          if (!service) {
            return NextResponse.json(
              { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
              { status: 404 }
            );
          }

          const result = await mockServiceSettings.verifyScanRole(serviceCode);
          return NextResponse.json(result);
        } catch {
          return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
            { status: 500 }
          );
        }
      },
    },

    azure: {
      get: async (serviceCode: string) => {
        const user = await mockData.getCurrentUser();
        if (!user) {
          return NextResponse.json(
            { error: AZURE_ERROR_CODES.UNAUTHORIZED.code, message: AZURE_ERROR_CODES.UNAUTHORIZED.message },
            { status: AZURE_ERROR_CODES.UNAUTHORIZED.status }
          );
        }

        const service = mockData.mockServiceCodes.find((s) => s.code === serviceCode);
        if (!service) {
          return NextResponse.json(
            { error: AZURE_ERROR_CODES.SERVICE_NOT_FOUND.code, message: AZURE_ERROR_CODES.SERVICE_NOT_FOUND.message },
            { status: AZURE_ERROR_CODES.SERVICE_NOT_FOUND.status }
          );
        }

        if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
          return NextResponse.json(
            { error: AZURE_ERROR_CODES.FORBIDDEN.code, message: AZURE_ERROR_CODES.FORBIDDEN.message },
            { status: AZURE_ERROR_CODES.FORBIDDEN.status }
          );
        }

        const result = await azureFns.getAzureServiceSettings(serviceCode);

        if (result.error) {
          return NextResponse.json(
            { error: result.error.code, message: result.error.message },
            { status: result.error.status }
          );
        }

        return NextResponse.json(result.data);
      },
    },

    idc: {
      get: async (serviceCode: string) => {
        const user = await mockData.getCurrentUser();
        if (!user) {
          return NextResponse.json(
            { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
            { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
          );
        }

        const service = mockData.mockServiceCodes.find((s) => s.code === serviceCode);
        if (!service) {
          return NextResponse.json(
            { error: IDC_ERROR_CODES.SERVICE_NOT_FOUND.code, message: IDC_ERROR_CODES.SERVICE_NOT_FOUND.message },
            { status: IDC_ERROR_CODES.SERVICE_NOT_FOUND.status }
          );
        }

        if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
          return NextResponse.json(
            { error: IDC_ERROR_CODES.FORBIDDEN.code, message: IDC_ERROR_CODES.FORBIDDEN.message },
            { status: IDC_ERROR_CODES.FORBIDDEN.status }
          );
        }

        const result = await idcFns.getIdcServiceSettings(serviceCode);

        if (result.error) {
          return NextResponse.json(
            { error: result.error.code, message: result.error.message },
            { status: result.error.status }
          );
        }

        return NextResponse.json(result.data);
      },

      update: async (serviceCode: string, body: unknown) => {
        const user = await mockData.getCurrentUser();
        if (!user) {
          return NextResponse.json(
            { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
            { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
          );
        }

        const service = mockData.mockServiceCodes.find((s) => s.code === serviceCode);
        if (!service) {
          return NextResponse.json(
            { error: IDC_ERROR_CODES.SERVICE_NOT_FOUND.code, message: IDC_ERROR_CODES.SERVICE_NOT_FOUND.message },
            { status: IDC_ERROR_CODES.SERVICE_NOT_FOUND.status }
          );
        }

        if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
          return NextResponse.json(
            { error: IDC_ERROR_CODES.FORBIDDEN.code, message: IDC_ERROR_CODES.FORBIDDEN.message },
            { status: IDC_ERROR_CODES.FORBIDDEN.status }
          );
        }

        const typedBody = body as UpdateIdcSettingsRequest;

        if (typeof typedBody.firewallPrepared !== 'boolean') {
          return NextResponse.json(
            { error: IDC_ERROR_CODES.VALIDATION_FAILED.code, message: 'firewallPrepared는 boolean 타입이어야 합니다.' },
            { status: IDC_ERROR_CODES.VALIDATION_FAILED.status }
          );
        }

        const result = await idcFns.updateIdcServiceSettings(serviceCode, typedBody.firewallPrepared);

        if (result.error) {
          return NextResponse.json(
            { error: result.error.code, message: result.error.message },
            { status: result.error.status }
          );
        }

        return NextResponse.json(result.data);
      },
    },
  },
};
