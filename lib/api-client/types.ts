import type { NextResponse } from 'next/server';
import type { VerifyTfRoleRequest } from '@/lib/types';
import type { QueueBoardQueryParams } from '@/lib/types/queue-board';

interface SetInstallationModeBody {
  mode: 'AUTO' | 'MANUAL';
}

export interface ApiClient {
  targetSources: {
    list: (serviceCode: string) => Promise<NextResponse>;
    get: (targetSourceId: string) => Promise<NextResponse>;
    create: (body: unknown) => Promise<NextResponse>;
  };
  projects: {
    get: (targetSourceId: string) => Promise<NextResponse>;
    delete: (targetSourceId: string) => Promise<NextResponse>;
    create: (body: unknown) => Promise<NextResponse>;
    approve: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    reject: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    confirmTargets: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    completeInstallation: (targetSourceId: string) => Promise<NextResponse>;
    confirmCompletion: (targetSourceId: string) => Promise<NextResponse>;
    credentials: (targetSourceId: string) => Promise<NextResponse>;
    history: (targetSourceId: string, query: { type: string; limit: string; offset: string }) => Promise<NextResponse>;
    resourceCredential: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    resourceExclusions: (targetSourceId: string) => Promise<NextResponse>;
    resources: (targetSourceId: string) => Promise<NextResponse>;
    scan: (targetSourceId: string) => Promise<NextResponse>;
    terraformStatus: (targetSourceId: string) => Promise<NextResponse>;
    testConnection: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
  };
  users: {
    search: (query: string, excludeIds: string[]) => Promise<NextResponse>;
    getMe: () => Promise<NextResponse>;
    getServices: () => Promise<NextResponse>;
    getServicesPage: (page: number, size: number, query?: string) => Promise<NextResponse>;
  };
  aws: {
    checkInstallation: (targetSourceId: string) => Promise<NextResponse>;
    setInstallationMode: (targetSourceId: string, body: SetInstallationModeBody) => Promise<NextResponse>;
    getInstallationStatus: (targetSourceId: string) => Promise<NextResponse>;
    getTerraformScript: (targetSourceId: string) => Promise<NextResponse>;
    verifyTfRole: (targetSourceId: string, body?: { roleArn?: string }) => Promise<NextResponse>;
  };
  azure: {
    checkInstallation: (targetSourceId: string) => Promise<NextResponse>;
    getInstallationStatus: (targetSourceId: string) => Promise<NextResponse>;
    getSettings: (targetSourceId: string) => Promise<NextResponse>;
    getSubnetGuide: (targetSourceId: string) => Promise<NextResponse>;
    getScanApp: (targetSourceId: string) => Promise<NextResponse>;
    vmCheckInstallation: (targetSourceId: string) => Promise<NextResponse>;
    vmGetInstallationStatus: (targetSourceId: string) => Promise<NextResponse>;
    vmGetTerraformScript: (targetSourceId: string) => Promise<NextResponse>;
  };
  gcp: {
    checkInstallation: (targetSourceId: string) => Promise<NextResponse>;
    getInstallationStatus: (targetSourceId: string) => Promise<NextResponse>;
    getScanServiceAccount: (targetSourceId: string) => Promise<NextResponse>;
    getTerraformServiceAccount: (targetSourceId: string) => Promise<NextResponse>;
  };
  services: {
    permissions: {
      list: (serviceCode: string) => Promise<NextResponse>;
      add: (serviceCode: string, body: unknown) => Promise<NextResponse>;
      remove: (serviceCode: string, userId: string) => Promise<NextResponse>;
    };
    projects: {
      list: (serviceCode: string) => Promise<NextResponse>;
    };
    settings: {
      aws: {
        get: (serviceCode: string) => Promise<NextResponse>;
        update: (serviceCode: string, body: unknown) => Promise<NextResponse>;
        verifyScanRole: (serviceCode: string) => Promise<NextResponse>;
      };
      azure: {
        get: (serviceCode: string) => Promise<NextResponse>;
      };
    };
  };
  dashboard: {
    summary: () => Promise<NextResponse>;
    systems: (params: URLSearchParams) => Promise<NextResponse>;
    systemsExport: (params: URLSearchParams) => Promise<NextResponse>;
  };
  dev: {
    getUsers: () => Promise<NextResponse>;
    switchUser: (body: unknown) => Promise<NextResponse>;
  };
  scan: {
    get: (targetSourceId: string, scanId: string) => Promise<NextResponse>;
    getHistory: (targetSourceId: string, query: { limit: number; offset: number }) => Promise<NextResponse>;
    create: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    getStatus: (targetSourceId: string) => Promise<NextResponse>;
  };
  taskAdmin: {
    getApprovalRequestQueue(params: QueueBoardQueryParams): Promise<NextResponse>;
  };
  confirm: {
    getResources: (targetSourceId: string) => Promise<NextResponse>;
    createApprovalRequest: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    getConfirmedIntegration: (targetSourceId: string) => Promise<NextResponse>;
    getApprovedIntegration: (targetSourceId: string) => Promise<NextResponse>;
    getApprovalHistory: (targetSourceId: string, page: number, size: number) => Promise<NextResponse>;
    getApprovalRequestLatest: (targetSourceId: string) => Promise<NextResponse>;
    getProcessStatus: (targetSourceId: string) => Promise<NextResponse>;
    approveApprovalRequest: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    rejectApprovalRequest: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    cancelApprovalRequest: (targetSourceId: string) => Promise<NextResponse>;
    confirmInstallation: (targetSourceId: string) => Promise<NextResponse>;
    updateResourceCredential: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    testConnection: (targetSourceId: string, body: unknown) => Promise<NextResponse>;
    getTestConnectionResults: (targetSourceId: string, page: number, size: number) => Promise<NextResponse>;
    getTestConnectionLatest: (targetSourceId: string) => Promise<NextResponse>;
  };
  guides: {
    get: (name: string) => Promise<NextResponse>;
    put: (name: string, body: unknown) => Promise<NextResponse>;
  };
}
