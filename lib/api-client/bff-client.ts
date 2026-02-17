import { NextResponse } from 'next/server';
import type { ApiClient } from '@/lib/api-client/types';

const BFF_URL = process.env.BFF_API_URL;

const proxyGet = async (path: string): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${path}`);
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyPost = async (path: string, body: unknown): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyPatch = async (path: string, body: unknown): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyPut = async (path: string, body: unknown): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyDelete = async (path: string): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${path}`, { method: 'DELETE' });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

export const bffClient: ApiClient = {
  targetSources: {
    list: (serviceCode) => proxyGet(`/v1/services/${serviceCode}/target-sources`),
    get: (projectId) => proxyGet(`/v1/target-sources/${projectId}`),
    create: (body) => proxyPost('/v1/target-sources', body),
  },
  projects: {
    get: (projectId) => proxyGet(`/projects/${projectId}`),
    delete: (projectId) => proxyDelete(`/projects/${projectId}`),
    create: (body) => proxyPost('/projects', body),
    approve: (projectId, body) => proxyPost(`/projects/${projectId}/approve`, body),
    reject: (projectId, body) => proxyPost(`/projects/${projectId}/reject`, body),
    confirmTargets: (projectId, body) => proxyPost(`/projects/${projectId}/confirm-targets`, body),
    completeInstallation: (projectId) => proxyPost(`/projects/${projectId}/complete-installation`, {}),
    confirmCompletion: (projectId) => proxyPost(`/projects/${projectId}/confirm-completion`, {}),
    credentials: (projectId) => proxyGet(`/projects/${projectId}/credentials`),
    history: (projectId, query) => {
      const params = new URLSearchParams();
      if (query.type) params.set('type', query.type);
      if (query.limit) params.set('limit', query.limit);
      if (query.offset) params.set('offset', query.offset);
      const qs = params.toString();
      return proxyGet(`/projects/${projectId}/history${qs ? `?${qs}` : ''}`);
    },
    resourceCredential: (projectId, body) => proxyPatch(`/projects/${projectId}/resources/credential`, body),
    resourceExclusions: (projectId) => proxyGet(`/projects/${projectId}/resources/exclusions`),
    resources: (projectId) => proxyGet(`/projects/${projectId}/resources`),
    scan: (projectId) => proxyPost(`/projects/${projectId}/scan`, {}),
    terraformStatus: (projectId) => proxyGet(`/projects/${projectId}/terraform-status`),
    testConnection: (projectId, body) => proxyPost(`/projects/${projectId}/test-connection`, body),
  },
  users: {
    search: (query, excludeIds) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (excludeIds.length > 0) params.set('exclude', excludeIds.join(','));
      const qs = params.toString();
      return proxyGet(`/users/search${qs ? `?${qs}` : ''}`);
    },
    getMe: () => proxyGet('/users/me'),
    getServices: () => proxyGet('/users/me/services'),
  },
  sdu: {
    checkInstallation: (projectId) => proxyPost(`/v1/sdu/target-sources/${projectId}/check-installation`, {}),
    getAthenaTables: (projectId) => proxyGet(`/v1/sdu/target-sources/${projectId}/athena-tables`),
    executeConnectionTest: (projectId) => proxyPost(`/v1/sdu/target-sources/${projectId}/connection-test/execute`, {}),
    getConnectionTest: (projectId) => proxyGet(`/v1/sdu/target-sources/${projectId}/connection-test`),
    issueAkSk: (projectId, body) => proxyPost(`/v1/sdu/target-sources/${projectId}/iam-user/issue-aksk`, body),
    getIamUser: (projectId) => proxyGet(`/v1/sdu/target-sources/${projectId}/iam-user`),
    getInstallationStatus: (projectId) => proxyGet(`/v1/sdu/target-sources/${projectId}/installation-status`),
    checkS3Upload: (projectId) => proxyPost(`/v1/sdu/target-sources/${projectId}/s3-upload/check`, {}),
    getS3Upload: (projectId) => proxyGet(`/v1/sdu/target-sources/${projectId}/s3-upload`),
    confirmSourceIp: (projectId, body) => proxyPost(`/v1/sdu/target-sources/${projectId}/source-ip/confirm`, body),
    registerSourceIp: (projectId, body) => proxyPost(`/v1/sdu/target-sources/${projectId}/source-ip/register`, body),
    getSourceIpList: (projectId) => proxyGet(`/v1/sdu/target-sources/${projectId}/source-ip`),
  },
  aws: {
    checkInstallation: (projectId) => proxyPost(`/aws/projects/${projectId}/check-installation`, {}),
    setInstallationMode: (projectId, body) => proxyPost(`/aws/projects/${projectId}/installation-mode`, body),
    getInstallationStatus: (projectId) => proxyGet(`/aws/projects/${projectId}/installation-status`),
    getTerraformScript: (projectId) => proxyGet(`/aws/projects/${projectId}/terraform-script`),
    verifyTfRole: (_projectId, body) => proxyPost('/aws/verify-tf-role', body ?? {}),
  },
  azure: {
    checkInstallation: (projectId) => proxyPost(`/azure/projects/${projectId}/check-installation`, {}),
    getInstallationStatus: (projectId) => proxyGet(`/azure/projects/${projectId}/installation-status`),
    getSettings: (projectId) => proxyGet(`/azure/projects/${projectId}/settings`),
    getSubnetGuide: (projectId) => proxyGet(`/azure/projects/${projectId}/subnet-guide`),
    vmCheckInstallation: (projectId) => proxyPost(`/azure/projects/${projectId}/vm/check-installation`, {}),
    vmGetInstallationStatus: (projectId) => proxyGet(`/azure/projects/${projectId}/vm/installation-status`),
    vmGetTerraformScript: (projectId) => proxyGet(`/azure/projects/${projectId}/vm/terraform-script`),
  },
  gcp: {
    checkInstallation: (projectId) => proxyPost(`/gcp/projects/${projectId}/check-installation`, {}),
    getInstallationStatus: (projectId) => proxyGet(`/gcp/projects/${projectId}/installation-status`),
  },
  idc: {
    getSourceIpRecommendation: (ipType) =>
      proxyGet(`/v1/idc/source-ip-recommendation${ipType ? `?ipType=${ipType}` : ''}`),
    checkInstallation: (projectId) => proxyPost(`/v1/idc/target-sources/${projectId}/check-installation`, {}),
    confirmFirewall: (projectId) => proxyPost(`/v1/idc/target-sources/${projectId}/confirm-firewall`, {}),
    confirmTargets: (projectId, body) => proxyPost(`/v1/idc/target-sources/${projectId}/confirm-targets`, body),
    getInstallationStatus: (projectId) => proxyGet(`/v1/idc/target-sources/${projectId}/installation-status`),
    getResources: (projectId) => proxyGet(`/v1/idc/target-sources/${projectId}/resources`),
    updateResources: (projectId, body) => proxyPut(`/v1/idc/target-sources/${projectId}/resources`, body),
    updateResourcesList: (projectId, body) => proxyPut(`/v1/idc/target-sources/${projectId}/resources/list`, body),
  },
  services: {
    permissions: {
      list: (serviceCode) => proxyGet(`/services/${serviceCode}/permissions`),
      add: (serviceCode, body) => proxyPost(`/services/${serviceCode}/permissions`, body),
      remove: (serviceCode, userId) => proxyDelete(`/services/${serviceCode}/permissions/${userId}`),
    },
    projects: {
      list: (serviceCode) => proxyGet(`/services/${serviceCode}/projects`),
    },
    settings: {
      aws: {
        get: (serviceCode) => proxyGet(`/services/${serviceCode}/settings/aws`),
        update: (serviceCode, body) => proxyPut(`/services/${serviceCode}/settings/aws`, body),
        verifyScanRole: (serviceCode) => proxyPost(`/services/${serviceCode}/settings/aws/verify-scan-role`, {}),
      },
      azure: {
        get: (serviceCode) => proxyGet(`/services/${serviceCode}/settings/azure`),
      },
      idc: {
        get: (serviceCode) => proxyGet(`/services/${serviceCode}/settings/idc`),
        update: (serviceCode, body) => proxyPut(`/services/${serviceCode}/settings/idc`, body),
      },
    },
  },
  dev: {
    getUsers: () => proxyGet('/dev/users'),
    switchUser: (body) => proxyPost('/dev/switch-user', body),
  },
  scan: {
    get: (projectId, scanId) => proxyGet(`/scan/projects/${projectId}/scans/${scanId}`),
    getHistory: (projectId, query) =>
      proxyGet(`/scan/projects/${projectId}/history?limit=${query.limit}&offset=${query.offset}`),
    create: (projectId, body) => proxyPost(`/scan/projects/${projectId}/scans`, body),
    getStatus: (projectId) => proxyGet(`/scan/projects/${projectId}/status`),
  },
  confirm: {
    getResources: (projectId) => proxyGet(`/target-sources/${projectId}/resources`),
    createApprovalRequest: (projectId, body) => proxyPost(`/target-sources/${projectId}/approval-requests`, body),
    getConfirmedIntegration: (projectId) => proxyGet(`/target-sources/${projectId}/confirmed-integration`),
    getApprovedIntegration: (projectId) => proxyGet(`/target-sources/${projectId}/approved-integration`),
    getApprovalHistory: (projectId, page, size) =>
      proxyGet(`/target-sources/${projectId}/approval-history?page=${page}&size=${size}`),
    getProcessStatus: (projectId) => proxyGet(`/target-sources/${projectId}/process-status`),
    approveApprovalRequest: (projectId, body) => proxyPost(`/target-sources/${projectId}/approval-requests/approve`, body),
    rejectApprovalRequest: (projectId, body) => proxyPost(`/target-sources/${projectId}/approval-requests/reject`, body),
    cancelApprovalRequest: (projectId) => proxyPost(`/target-sources/${projectId}/approval-requests/cancel`, {}),
    confirmInstallation: (projectId) => proxyPost(`/target-sources/${projectId}/pii-agent-installation/confirm`, {}),
    updateResourceCredential: (projectId, body) => proxyPatch(`/target-sources/${projectId}/resources/credential`, body),
    testConnection: (projectId, body) => proxyPost(`/target-sources/${projectId}/test-connection`, body),
  },
};
