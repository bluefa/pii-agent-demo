import type { NextResponse } from 'next/server';
import type { VerifyTfRoleRequest } from '@/lib/types';

interface SetInstallationModeBody {
  mode: 'AUTO' | 'MANUAL';
}

export interface ApiClient {
  targetSources: {
    list: (serviceCode: string) => Promise<NextResponse>;
    get: (projectId: string) => Promise<NextResponse>;
    create: (body: unknown) => Promise<NextResponse>;
  };
  projects: {
    get: (projectId: string) => Promise<NextResponse>;
    delete: (projectId: string) => Promise<NextResponse>;
    create: (body: unknown) => Promise<NextResponse>;
    approve: (projectId: string, body: unknown) => Promise<NextResponse>;
    reject: (projectId: string, body: unknown) => Promise<NextResponse>;
    confirmTargets: (projectId: string, body: unknown) => Promise<NextResponse>;
    completeInstallation: (projectId: string) => Promise<NextResponse>;
    confirmCompletion: (projectId: string) => Promise<NextResponse>;
    credentials: (projectId: string) => Promise<NextResponse>;
    history: (projectId: string, query: { type: string; limit: string; offset: string }) => Promise<NextResponse>;
    resourceCredential: (projectId: string, body: unknown) => Promise<NextResponse>;
    resourceExclusions: (projectId: string) => Promise<NextResponse>;
    resources: (projectId: string) => Promise<NextResponse>;
    scan: (projectId: string) => Promise<NextResponse>;
    terraformStatus: (projectId: string) => Promise<NextResponse>;
    testConnection: (projectId: string, body: unknown) => Promise<NextResponse>;
  };
  users: {
    search: (query: string, excludeIds: string[]) => Promise<NextResponse>;
    getMe: () => Promise<NextResponse>;
    getServices: () => Promise<NextResponse>;
  };
  sdu: {
    checkInstallation: (projectId: string) => Promise<NextResponse>;
    getAthenaTables: (projectId: string) => Promise<NextResponse>;
    executeConnectionTest: (projectId: string) => Promise<NextResponse>;
    getConnectionTest: (projectId: string) => Promise<NextResponse>;
    issueAkSk: (projectId: string, body: { issuedBy: string }) => Promise<NextResponse>;
    getIamUser: (projectId: string) => Promise<NextResponse>;
    getInstallationStatus: (projectId: string) => Promise<NextResponse>;
    checkS3Upload: (projectId: string) => Promise<NextResponse>;
    getS3Upload: (projectId: string) => Promise<NextResponse>;
    confirmSourceIp: (projectId: string, body: { cidr: string }) => Promise<NextResponse>;
    registerSourceIp: (projectId: string, body: { cidr: string }) => Promise<NextResponse>;
    getSourceIpList: (projectId: string) => Promise<NextResponse>;
  };
  aws: {
    checkInstallation: (projectId: string) => Promise<NextResponse>;
    setInstallationMode: (projectId: string, body: SetInstallationModeBody) => Promise<NextResponse>;
    getInstallationStatus: (projectId: string) => Promise<NextResponse>;
    getTerraformScript: (projectId: string) => Promise<NextResponse>;
    verifyTfRole: (projectId: string, body?: { roleArn?: string }) => Promise<NextResponse>;
  };
  azure: {
    checkInstallation: (projectId: string) => Promise<NextResponse>;
    getInstallationStatus: (projectId: string) => Promise<NextResponse>;
    getSettings: (projectId: string) => Promise<NextResponse>;
    getSubnetGuide: (projectId: string) => Promise<NextResponse>;
    vmCheckInstallation: (projectId: string) => Promise<NextResponse>;
    vmGetInstallationStatus: (projectId: string) => Promise<NextResponse>;
    vmGetTerraformScript: (projectId: string) => Promise<NextResponse>;
  };
  gcp: {
    checkInstallation: (projectId: string) => Promise<NextResponse>;
    getInstallationStatus: (projectId: string) => Promise<NextResponse>;
  };
  idc: {
    getSourceIpRecommendation: (ipType: string | null) => Promise<NextResponse>;
    checkInstallation: (projectId: string) => Promise<NextResponse>;
    confirmFirewall: (projectId: string) => Promise<NextResponse>;
    confirmTargets: (projectId: string, body: unknown) => Promise<NextResponse>;
    getInstallationStatus: (projectId: string) => Promise<NextResponse>;
    getResources: (projectId: string) => Promise<NextResponse>;
    updateResources: (projectId: string, body: unknown) => Promise<NextResponse>;
    updateResourcesList: (projectId: string, body: unknown) => Promise<NextResponse>;
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
      idc: {
        get: (serviceCode: string) => Promise<NextResponse>;
        update: (serviceCode: string, body: unknown) => Promise<NextResponse>;
      };
    };
  };
  dev: {
    getUsers: () => Promise<NextResponse>;
    switchUser: (body: unknown) => Promise<NextResponse>;
  };
  scan: {
    get: (projectId: string, scanId: string) => Promise<NextResponse>;
    getHistory: (projectId: string, query: { limit: number; offset: number }) => Promise<NextResponse>;
    create: (projectId: string, body: unknown) => Promise<NextResponse>;
    getStatus: (projectId: string) => Promise<NextResponse>;
  };
  confirm: {
    getResources: (projectId: string) => Promise<NextResponse>;
    createApprovalRequest: (projectId: string, body: unknown) => Promise<NextResponse>;
    getConfirmedIntegration: (projectId: string) => Promise<NextResponse>;
    getApprovedIntegration: (projectId: string) => Promise<NextResponse>;
    getApprovalHistory: (projectId: string, page: number, size: number) => Promise<NextResponse>;
    getProcessStatus: (projectId: string) => Promise<NextResponse>;
    approveApprovalRequest: (projectId: string, body: unknown) => Promise<NextResponse>;
    rejectApprovalRequest: (projectId: string, body: unknown) => Promise<NextResponse>;
    cancelApprovalRequest: (projectId: string) => Promise<NextResponse>;
    confirmInstallation: (projectId: string) => Promise<NextResponse>;
    updateResourceCredential: (projectId: string, body: unknown) => Promise<NextResponse>;
    testConnection: (projectId: string, body: unknown) => Promise<NextResponse>;
    getTestConnectionResults: (projectId: string, page: number, size: number) => Promise<NextResponse>;
    getTestConnectionLatest: (projectId: string) => Promise<NextResponse>;
    getConnectionStatus: (projectId: string) => Promise<NextResponse>;
  };
}
