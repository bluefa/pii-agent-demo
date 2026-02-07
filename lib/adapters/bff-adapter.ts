/**
 * BFF 어댑터 (프로덕션용) - 스텁 구현
 *
 * 프로덕션 전환 시 BFF API 명세(docs/api/)에 맞춰 구현 예정.
 * 현재는 인터페이스 준수를 위한 스텁만 제공.
 */

import type { DataAdapter } from './types';

const BFF_URL = process.env.BFF_API_URL;

const fetchWithAuth = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${BFF_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`BFF Error: ${res.status}`);
  return res.json();
};

const notImplemented = (method: string): never => {
  throw new Error(`BFF adapter method not implemented: ${method}. BFF_API_URL: ${BFF_URL}`);
};

export const bffAdapter: DataAdapter = {
  // --- User ---
  getCurrentUser: async () => {
    const data = await fetchWithAuth('/user/me');
    return data.user;
  },
  setCurrentUser: async () => notImplemented('setCurrentUser'),
  getUsers: async () => {
    const data = await fetchWithAuth('/users');
    return data.users;
  },
  searchUsers: async (query) => {
    const data = await fetchWithAuth(`/users/search?q=${encodeURIComponent(query)}`);
    return data.users;
  },

  // --- Project ---
  getProjectById: async (id) => {
    const data = await fetchWithAuth(`/projects/${id}`);
    return data.project;
  },
  getProjectsByServiceCode: async (serviceCode) => {
    const data = await fetchWithAuth(`/services/${serviceCode}/projects`);
    return data.projects;
  },
  addProject: async (project) => {
    const data = await fetchWithAuth('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
    return data.project;
  },
  updateProject: async (id, updates) => {
    const data = await fetchWithAuth(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return data.project;
  },
  deleteProject: async (id) => {
    await fetchWithAuth(`/projects/${id}`, { method: 'DELETE' });
    return true;
  },
  generateId: async () => notImplemented('generateId'),

  // --- ServiceCode ---
  getServiceCodes: async () => {
    const data = await fetchWithAuth('/services');
    return data.serviceCodes;
  },
  getServiceCodeByCode: async (code) => {
    const data = await fetchWithAuth(`/services/${code}`);
    return data.serviceCode;
  },

  // --- Credential ---
  getCredentials: async () => notImplemented('getCredentials'),
  getCredentialsByDatabaseType: async () => notImplemented('getCredentialsByDatabaseType'),
  getCredentialById: async () => notImplemented('getCredentialById'),
  simulateConnectionTest: async () => notImplemented('simulateConnectionTest'),

  // --- AWS Installation ---
  verifyTfRole: async () => notImplemented('verifyTfRole'),
  initializeInstallation: async () => notImplemented('initializeInstallation'),
  getInstallationStatus: async () => notImplemented('getInstallationStatus'),
  checkInstallation: async () => notImplemented('checkInstallation'),
  getTerraformScript: async () => notImplemented('getTerraformScript'),

  // --- AWS Service Settings ---
  getAwsServiceSettings: async () => notImplemented('getAwsServiceSettings'),
  updateAwsServiceSettings: async () => notImplemented('updateAwsServiceSettings'),
  verifyScanRole: async () => notImplemented('verifyScanRole'),

  // --- Scan ---
  validateScanRequest: async () => notImplemented('validateScanRequest'),
  createScanJob: async () => notImplemented('createScanJob'),
  getScanJob: async () => notImplemented('getScanJob'),
  getLatestScanForProject: async () => notImplemented('getLatestScanForProject'),
  calculateScanStatus: async () => notImplemented('calculateScanStatus'),
  getScanHistory: async () => notImplemented('getScanHistory'),
  canScan: async () => notImplemented('canScan'),

  // --- Project History ---
  getProjectHistory: async () => notImplemented('getProjectHistory'),
  addTargetConfirmedHistory: async () => notImplemented('addTargetConfirmedHistory'),
  addAutoApprovedHistory: async () => notImplemented('addAutoApprovedHistory'),
  addApprovalHistory: async () => notImplemented('addApprovalHistory'),
  addRejectionHistory: async () => notImplemented('addRejectionHistory'),
  addDecommissionRequestHistory: async () => notImplemented('addDecommissionRequestHistory'),
  addDecommissionApprovedHistory: async () => notImplemented('addDecommissionApprovedHistory'),
  addDecommissionRejectedHistory: async () => notImplemented('addDecommissionRejectedHistory'),

  // --- Azure ---
  getAzureInstallationStatus: async () => notImplemented('getAzureInstallationStatus'),
  checkAzureInstallation: async () => notImplemented('checkAzureInstallation'),
  getAzureVmInstallationStatus: async () => notImplemented('getAzureVmInstallationStatus'),
  checkAzureVmInstallation: async () => notImplemented('checkAzureVmInstallation'),
  getAzureVmTerraformScript: async () => notImplemented('getAzureVmTerraformScript'),
  getAzureSubnetGuide: async () => notImplemented('getAzureSubnetGuide'),
  getAzureServiceSettings: async () => notImplemented('getAzureServiceSettings'),

  // --- IDC ---
  getIdcInstallationStatus: async () => notImplemented('getIdcInstallationStatus'),
  checkIdcInstallation: async () => notImplemented('checkIdcInstallation'),
  confirmFirewall: async () => notImplemented('confirmFirewall'),
  getSourceIpRecommendation: async () => notImplemented('getSourceIpRecommendation'),
  getIdcServiceSettings: async () => notImplemented('getIdcServiceSettings'),
  updateIdcServiceSettings: async () => notImplemented('updateIdcServiceSettings'),
  getIdcResources: async () => notImplemented('getIdcResources'),
  updateIdcResources: async () => notImplemented('updateIdcResources'),
  confirmIdcTargets: async () => notImplemented('confirmIdcTargets'),

  // --- SDU ---
  getSduInstallationStatus: async () => notImplemented('getSduInstallationStatus'),
  checkSduInstallation: async () => notImplemented('checkSduInstallation'),
  getS3UploadStatus: async () => notImplemented('getS3UploadStatus'),
  confirmS3Upload: async () => notImplemented('confirmS3Upload'),
  getIamUser: async () => notImplemented('getIamUser'),
  issueAkSk: async () => notImplemented('issueAkSk'),
  getSourceIpList: async () => notImplemented('getSourceIpList'),
  registerSourceIp: async () => notImplemented('registerSourceIp'),
  confirmSourceIp: async () => notImplemented('confirmSourceIp'),
  getAthenaTables: async () => notImplemented('getAthenaTables'),
  getSduServiceSettings: async () => notImplemented('getSduServiceSettings'),
  getSduConnectionTest: async () => notImplemented('getSduConnectionTest'),
  executeSduConnectionTest: async () => notImplemented('executeSduConnectionTest'),
};
