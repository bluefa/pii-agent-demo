import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { ProcessStatus } from '@/lib/types';
import { AZURE_ERROR_CODES } from '@/lib/constants/azure';
import { GCP_ERROR_CODES } from '@/lib/constants/gcp';
import { IDC_ERROR_CODES } from '@/lib/constants/idc';
import type { UpdateAwsSettingsRequest } from '@/lib/types';
import type { UpdateIdcSettingsRequest } from '@/lib/types/idc';

export const mockServices = {
  permissions: {
    list: async (serviceCode: string) => {
      const user = await dataAdapter.getCurrentUser();

      if (!user || user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: '관리자만 권한을 조회할 수 있습니다.' },
          { status: 403 }
        );
      }

      const allUsers = await dataAdapter.getUsers();
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
      const user = await dataAdapter.getCurrentUser();

      if (!user || user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: '관리자만 권한을 추가할 수 있습니다.' },
          { status: 403 }
        );
      }

      if (!(await dataAdapter.getServiceCodeByCode(serviceCode))) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: '존재하지 않는 서비스 코드입니다.' },
          { status: 404 }
        );
      }

      const { userId } = (body ?? {}) as { userId: string };

      const allUsers = await dataAdapter.getUsers();
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
      const user = await dataAdapter.getCurrentUser();

      if (!user || user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: '관리자만 권한을 제거할 수 있습니다.' },
          { status: 403 }
        );
      }

      const allUsers = await dataAdapter.getUsers();
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
      const user = await dataAdapter.getCurrentUser();

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

      const projects = (await dataAdapter.getProjectsByServiceCode(serviceCode)).map((p) => {
        const isIntegrated = p.processStatus === ProcessStatus.INSTALLATION_COMPLETE;

        return {
          id: p.id,
          projectCode: p.projectCode,
          name: p.name,
          cloudProvider: p.cloudProvider,
          isIntegrated,
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
          const service = await dataAdapter.getServiceCodeByCode(serviceCode);

          if (!service) {
            return NextResponse.json(
              { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
              { status: 404 }
            );
          }

          const settings = await dataAdapter.getAwsServiceSettings(serviceCode);
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
          const service = await dataAdapter.getServiceCodeByCode(serviceCode);

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

          const result = await dataAdapter.updateAwsServiceSettings(serviceCode, typedBody);
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
          const service = await dataAdapter.getServiceCodeByCode(serviceCode);

          if (!service) {
            return NextResponse.json(
              { error: 'NOT_FOUND', message: '서비스를 찾을 수 없습니다.' },
              { status: 404 }
            );
          }

          const result = await dataAdapter.verifyScanRole(serviceCode);
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
        const user = await dataAdapter.getCurrentUser();
        if (!user) {
          return NextResponse.json(
            { error: AZURE_ERROR_CODES.UNAUTHORIZED.code, message: AZURE_ERROR_CODES.UNAUTHORIZED.message },
            { status: AZURE_ERROR_CODES.UNAUTHORIZED.status }
          );
        }

        const service = await dataAdapter.getServiceCodeByCode(serviceCode);
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

        const result = await dataAdapter.getAzureServiceSettings(serviceCode);

        if (result.error) {
          return NextResponse.json(
            { error: result.error.code, message: result.error.message },
            { status: result.error.status }
          );
        }

        return NextResponse.json(result.data);
      },
    },

    gcp: {
      get: async (serviceCode: string) => {
        const user = await dataAdapter.getCurrentUser();
        if (!user) {
          return NextResponse.json(
            { error: GCP_ERROR_CODES.UNAUTHORIZED.code, message: GCP_ERROR_CODES.UNAUTHORIZED.message },
            { status: GCP_ERROR_CODES.UNAUTHORIZED.status }
          );
        }

        const service = await dataAdapter.getServiceCodeByCode(serviceCode);
        if (!service) {
          return NextResponse.json(
            { error: GCP_ERROR_CODES.SERVICE_NOT_FOUND.code, message: GCP_ERROR_CODES.SERVICE_NOT_FOUND.message },
            { status: GCP_ERROR_CODES.SERVICE_NOT_FOUND.status }
          );
        }

        if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
          return NextResponse.json(
            { error: GCP_ERROR_CODES.FORBIDDEN.code, message: GCP_ERROR_CODES.FORBIDDEN.message },
            { status: GCP_ERROR_CODES.FORBIDDEN.status }
          );
        }

        const result = await dataAdapter.getGcpServiceSettings(serviceCode);

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
        const user = await dataAdapter.getCurrentUser();
        if (!user) {
          return NextResponse.json(
            { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
            { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
          );
        }

        const service = await dataAdapter.getServiceCodeByCode(serviceCode);
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

        const result = await dataAdapter.getIdcServiceSettings(serviceCode);

        if (result.error) {
          return NextResponse.json(
            { error: result.error.code, message: result.error.message },
            { status: result.error.status }
          );
        }

        return NextResponse.json(result.data);
      },

      update: async (serviceCode: string, body: unknown) => {
        const user = await dataAdapter.getCurrentUser();
        if (!user) {
          return NextResponse.json(
            { error: IDC_ERROR_CODES.UNAUTHORIZED.code, message: IDC_ERROR_CODES.UNAUTHORIZED.message },
            { status: IDC_ERROR_CODES.UNAUTHORIZED.status }
          );
        }

        const service = await dataAdapter.getServiceCodeByCode(serviceCode);
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

        const result = await dataAdapter.updateIdcServiceSettings(serviceCode, typedBody.firewallPrepared);

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
