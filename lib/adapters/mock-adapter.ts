/**
 * Mock 어댑터 (개발용)
 * 기존 lib/mock-*.ts 함수들을 DataAdapter 인터페이스로 래핑
 */

import type { DataAdapter } from './types';
import * as mockData from '@/lib/mock-data';
import * as mockInstallation from '@/lib/mock-installation';
import * as mockServiceSettings from '@/lib/mock-service-settings';
import * as mockScan from '@/lib/mock-scan';
import * as mockHistory from '@/lib/mock-history';
import * as mockAzure from '@/lib/mock-azure';
import * as mockIdc from '@/lib/mock-idc';

export const mockAdapter: DataAdapter = {
  // --- User ---
  getCurrentUser: async () => mockData.getCurrentUser(),
  setCurrentUser: async (userId) => mockData.setCurrentUser(userId),
  getUsers: async () => mockData.mockUsers,
  searchUsers: async (query) => {
    const q = query.toLowerCase();
    return mockData.mockUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  },

  // --- Project ---
  getProjectById: async (id) => mockData.getProjectById(id),
  getProjectsByServiceCode: async (serviceCode) => mockData.getProjectsByServiceCode(serviceCode),
  addProject: async (project) => mockData.addProject(project),
  updateProject: async (id, updates) => mockData.updateProject(id, updates),
  deleteProject: async (id) => mockData.deleteProject(id),
  generateId: async (prefix) => mockData.generateId(prefix),

  // --- ServiceCode ---
  getServiceCodes: async () => mockData.mockServiceCodes,
  getServiceCodeByCode: async (code) =>
    mockData.mockServiceCodes.find((s) => s.code === code),

  // --- Credential ---
  getCredentials: async () => mockData.getCredentials(),
  getCredentialsByDatabaseType: async (databaseType) =>
    mockData.getCredentialsByDatabaseType(databaseType),
  getCredentialById: async (id) => mockData.getCredentialById(id),
  simulateConnectionTest: async (resourceId, resourceType, databaseType, credentialId, credentialName) =>
    mockData.simulateConnectionTest(resourceId, resourceType, databaseType, credentialId, credentialName),

  // --- AWS Installation ---
  verifyTfRole: async (request) => mockInstallation.verifyTfRole(request),
  initializeInstallation: async (projectId, hasTfPermission) =>
    mockInstallation.initializeInstallation(projectId, hasTfPermission),
  getInstallationStatus: async (projectId) => mockInstallation.getInstallationStatus(projectId),
  checkInstallation: async (projectId) => mockInstallation.checkInstallation(projectId),
  getTerraformScript: async (projectId) => mockInstallation.getTerraformScript(projectId),

  // --- AWS Service Settings ---
  getAwsServiceSettings: async (serviceCode) =>
    mockServiceSettings.getAwsServiceSettings(serviceCode),
  updateAwsServiceSettings: async (serviceCode, request) =>
    mockServiceSettings.updateAwsServiceSettings(serviceCode, request),
  verifyScanRole: async (serviceCode) => mockServiceSettings.verifyScanRole(serviceCode),

  // --- Scan ---
  validateScanRequest: async (project, force) => mockScan.validateScanRequest(project, force),
  createScanJob: async (project) => mockScan.createScanJob(project),
  getScanJob: async (scanId) => mockScan.getScanJob(scanId),
  getLatestScanForProject: async (projectId) => mockScan.getLatestScanForProject(projectId),
  calculateScanStatus: async (scan) => mockScan.calculateScanStatus(scan),
  getScanHistory: async (projectId, limit, offset) =>
    mockScan.getScanHistory(projectId, limit, offset),
  canScan: async (project) => mockScan.canScan(project),

  // --- Project History ---
  getProjectHistory: async (options) => mockHistory.getProjectHistory(options),
  addTargetConfirmedHistory: async (projectId, actor, resourceCount, excludedResourceCount) =>
    mockHistory.addTargetConfirmedHistory(projectId, actor, resourceCount, excludedResourceCount),
  addAutoApprovedHistory: async (projectId) => mockHistory.addAutoApprovedHistory(projectId),
  addApprovalHistory: async (projectId, actor) => mockHistory.addApprovalHistory(projectId, actor),
  addRejectionHistory: async (projectId, actor, reason) =>
    mockHistory.addRejectionHistory(projectId, actor, reason),
  addDecommissionRequestHistory: async (projectId, actor, reason) =>
    mockHistory.addDecommissionRequestHistory(projectId, actor, reason),
  addDecommissionApprovedHistory: async (projectId, actor) =>
    mockHistory.addDecommissionApprovedHistory(projectId, actor),
  addDecommissionRejectedHistory: async (projectId, actor, reason) =>
    mockHistory.addDecommissionRejectedHistory(projectId, actor, reason),

  // --- Azure ---
  getAzureInstallationStatus: async (projectId) => mockAzure.getAzureInstallationStatus(projectId),
  checkAzureInstallation: async (projectId) => mockAzure.checkAzureInstallation(projectId),
  getAzureVmInstallationStatus: async (projectId) =>
    mockAzure.getAzureVmInstallationStatus(projectId),
  checkAzureVmInstallation: async (projectId) => mockAzure.checkAzureVmInstallation(projectId),
  getAzureVmTerraformScript: async (projectId) =>
    mockAzure.getAzureVmTerraformScript(projectId),
  getAzureSubnetGuide: async (projectId) => mockAzure.getAzureSubnetGuide(projectId),
  getAzureServiceSettings: async (serviceCode) =>
    mockAzure.getAzureServiceSettings(serviceCode),

  // --- IDC ---
  getIdcInstallationStatus: async (projectId) => mockIdc.getIdcInstallationStatus(projectId),
  checkIdcInstallation: async (projectId) => mockIdc.checkIdcInstallation(projectId),
  confirmFirewall: async (projectId) => mockIdc.confirmFirewall(projectId),
  getSourceIpRecommendation: async (ipType) => mockIdc.getSourceIpRecommendation(ipType),
  getIdcServiceSettings: async (serviceCode) => mockIdc.getIdcServiceSettings(serviceCode),
  updateIdcServiceSettings: async (serviceCode, firewallPrepared) =>
    mockIdc.updateIdcServiceSettings(serviceCode, firewallPrepared),
  getIdcResources: async (projectId) => mockIdc.getIdcResources(projectId),
  updateIdcResources: async (projectId, resources) =>
    mockIdc.updateIdcResources(projectId, resources),
  confirmIdcTargets: async (projectId, resources) =>
    mockIdc.confirmIdcTargets(projectId, resources),
};
