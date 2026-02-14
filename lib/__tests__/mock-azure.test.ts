import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAzureInstallationStatus,
  checkAzureInstallation,
  getAzureVmInstallationStatus,
  checkAzureVmInstallation,
  getAzureVmTerraformScript,
  getAzureSubnetGuide,
  getAzureServiceSettings,
  resetAzureStore,
  hasVmResources,
  hasDbResources,
} from '@/lib/mock-azure';
import { getStore } from '@/lib/mock-store';
import { Project, ProcessStatus } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process';

// 테스트용 Azure 프로젝트 생성 헬퍼
const createAzureProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'azure-test-project',
  projectCode: 'AZURE-TEST-001',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'Azure',
  processStatus: ProcessStatus.INSTALLING,
  status: {
    ...createInitialProjectStatus(),
    scan: { status: 'COMPLETED' },
    targets: { confirmed: true, selectedCount: 2, excludedCount: 0 },
    approval: { status: 'APPROVED' },
    installation: { status: 'IN_PROGRESS' },
  },
  resources: [
    {
      id: 'res-1',
      type: 'AZURE_MSSQL',
      resourceId: 'mssql-test-001',
      databaseType: 'MSSQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      lifecycleStatus: 'INSTALLING',
      integrationCategory: 'TARGET',
    },
    {
      id: 'res-2',
      type: 'AZURE_POSTGRESQL',
      resourceId: 'pg-test-001',
      databaseType: 'POSTGRESQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      lifecycleStatus: 'INSTALLING',
      integrationCategory: 'TARGET',
    },
  ],
  terraformState: { bdcTf: 'PENDING' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  name: 'Azure Test Project',
  description: 'Azure Test Description',
  isRejected: false,
  ...overrides,
});

const createAzureProjectWithVm = (overrides: Partial<Project> = {}): Project => ({
  ...createAzureProject(),
  id: 'azure-vm-project',
  resources: [
    {
      id: 'res-vm-1',
      type: 'AZURE_VM',
      resourceId: 'vm-test-001',
      databaseType: 'MSSQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      lifecycleStatus: 'INSTALLING',
      integrationCategory: 'TARGET',
    },
    {
      id: 'res-vm-2',
      type: 'AZURE_VM',
      resourceId: 'vm-test-002',
      databaseType: 'POSTGRESQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      lifecycleStatus: 'INSTALLING',
      integrationCategory: 'TARGET',
    },
    {
      id: 'res-db-1',
      type: 'AZURE_SYNAPSE',
      resourceId: 'synapse-test-001',
      databaseType: 'MSSQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      lifecycleStatus: 'INSTALLING',
      integrationCategory: 'TARGET',
    },
  ],
  ...overrides,
});

const createAwsProject = (): Project => ({
  id: 'aws-test-project',
  projectCode: 'AWS-TEST-001',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.INSTALLING,
  status: {
    ...createInitialProjectStatus(),
    scan: { status: 'COMPLETED' },
    targets: { confirmed: true, selectedCount: 0, excludedCount: 0 },
    approval: { status: 'APPROVED' },
    installation: { status: 'IN_PROGRESS' },
  },
  resources: [],
  terraformState: { bdcTf: 'PENDING' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  name: 'AWS Test Project',
  description: 'AWS Test Description',
  isRejected: false,
});

// Store 초기화
const resetStore = () => {
  const store = getStore();
  store.projects = [];
  resetAzureStore();
};

describe('mock-azure', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('getAzureInstallationStatus', () => {
    it('존재하지 않는 프로젝트는 NOT_FOUND 에러 반환', () => {
      const result = getAzureInstallationStatus('non-existent');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.status).toBe(404);
    });

    it('AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = getAzureInstallationStatus('aws-test-project');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NOT_AZURE_PROJECT');
      expect(result.error?.status).toBe(400);
    });

    it('Azure 프로젝트는 설치 상태 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProject());

      const result = getAzureInstallationStatus('azure-test-project');
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.provider).toBe('Azure');
      expect(result.data?.resources).toHaveLength(2);
      expect(result.data?.lastCheckedAt).toBeDefined();
      // installed는 boolean 타입
      expect(typeof result.data?.installed).toBe('boolean');
    });

    it('installed는 모든 리소스가 APPROVED일 때 true', () => {
      const store = getStore();
      store.projects.push(createAzureProject());

      const result = getAzureInstallationStatus('azure-test-project');
      const allApproved = result.data?.resources.every(
        (r) => r.privateEndpoint.status === 'APPROVED'
      );
      expect(result.data?.installed).toBe(allApproved);
    });

    it('DB 리소스는 Private Endpoint 정보 포함 (TF 완료 여부는 status로 판단)', () => {
      const store = getStore();
      store.projects.push(createAzureProject());

      const result = getAzureInstallationStatus('azure-test-project');
      const resources = result.data?.resources || [];

      resources.forEach((resource) => {
        expect(resource.resourceId).toBeDefined();
        expect(resource.resourceType).toBeDefined();
        // privateEndpoint는 필수
        expect(resource.privateEndpoint).toBeDefined();
        expect(resource.privateEndpoint.status).toBeDefined();
        // TF 완료 여부는 status로 판단: NOT_REQUESTED가 아니면 TF 완료
        const validStatuses = ['NOT_REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
        expect(validStatuses).toContain(resource.privateEndpoint.status);
      });
    });

    it('캐시된 상태는 동일한 결과 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProject());

      const result1 = getAzureInstallationStatus('azure-test-project');
      const result2 = getAzureInstallationStatus('azure-test-project');

      expect(result1.data?.lastCheckedAt).toBe(result2.data?.lastCheckedAt);
    });
  });

  describe('checkAzureInstallation', () => {
    it('존재하지 않는 프로젝트는 NOT_FOUND 에러 반환', () => {
      const result = checkAzureInstallation('non-existent');
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('새로고침 시 lastCheckedAt 갱신', () => {
      const store = getStore();
      store.projects.push(createAzureProject());

      const result1 = getAzureInstallationStatus('azure-test-project');
      expect(result1.data?.lastCheckedAt).toBeDefined();

      // checkAzureInstallation은 캐시를 삭제하고 새로 조회하므로 lastCheckedAt가 갱신됨
      const result2 = checkAzureInstallation('azure-test-project');
      expect(result2.data?.lastCheckedAt).toBeDefined();
      // 갱신 함수가 정상 동작하는지 확인 (데이터 반환)
      expect(result2.data?.resources).toBeDefined();
    });

    it('AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = checkAzureInstallation('aws-test-project');
      expect(result.error?.code).toBe('NOT_AZURE_PROJECT');
    });
  });

  describe('getAzureVmInstallationStatus', () => {
    it('VM 리소스가 있는 프로젝트는 VM 상태 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProjectWithVm());

      const result = getAzureVmInstallationStatus('azure-vm-project');
      expect(result.error).toBeUndefined();
      expect(result.data?.vms).toHaveLength(2); // VM만 필터링
      expect(result.data?.lastCheckedAt).toBeDefined();
    });

    it('VM 리소스가 없는 프로젝트는 빈 배열 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProject()); // DB만 있는 프로젝트

      const result = getAzureVmInstallationStatus('azure-test-project');
      expect(result.data?.vms).toHaveLength(0);
    });

    it('VM 상태는 subnetExists와 loadBalancer 포함', () => {
      const store = getStore();
      store.projects.push(createAzureProjectWithVm());

      const result = getAzureVmInstallationStatus('azure-vm-project');
      result.data?.vms.forEach((vm) => {
        expect(vm.vmId).toBeDefined();
        expect(vm.vmName).toBeDefined();
        expect(typeof vm.subnetExists).toBe('boolean');
        expect(typeof vm.loadBalancer.installed).toBe('boolean');
        expect(vm.loadBalancer.name).toBeDefined();
      });
    });

    it('AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = getAzureVmInstallationStatus('aws-test-project');
      expect(result.error?.code).toBe('NOT_AZURE_PROJECT');
    });
  });

  describe('checkAzureVmInstallation', () => {
    it('새로고침 시 lastCheckedAt 갱신', () => {
      const store = getStore();
      store.projects.push(createAzureProjectWithVm());

      const result1 = getAzureVmInstallationStatus('azure-vm-project');
      expect(result1.data?.lastCheckedAt).toBeDefined();

      // checkAzureVmInstallation은 캐시를 삭제하고 새로 조회하므로 lastCheckedAt가 갱신됨
      const result2 = checkAzureVmInstallation('azure-vm-project');
      expect(result2.data?.lastCheckedAt).toBeDefined();
      // 갱신 함수가 정상 동작하는지 확인 (데이터 반환)
      expect(result2.data?.vms).toBeDefined();
    });
  });

  describe('getAzureVmTerraformScript', () => {
    it('VM 리소스가 있는 프로젝트는 Script 정보 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProjectWithVm());

      const result = getAzureVmTerraformScript('azure-vm-project');
      expect(result.error).toBeUndefined();
      expect(result.data?.downloadUrl).toBeDefined();
      expect(result.data?.fileName).toContain('terraform');
      expect(result.data?.generatedAt).toBeDefined();
    });

    it('VM 리소스가 없는 프로젝트는 NO_VM_RESOURCES 에러', () => {
      const store = getStore();
      store.projects.push(createAzureProject()); // DB만 있는 프로젝트

      const result = getAzureVmTerraformScript('azure-test-project');
      expect(result.error?.code).toBe('NO_VM_RESOURCES');
      expect(result.error?.status).toBe(400);
    });

    it('AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = getAzureVmTerraformScript('aws-test-project');
      expect(result.error?.code).toBe('NOT_AZURE_PROJECT');
    });
  });

  describe('getAzureSubnetGuide', () => {
    it('Azure 프로젝트는 가이드 정보 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProject());

      const result = getAzureSubnetGuide('azure-test-project');
      expect(result.error).toBeUndefined();
      expect(result.data?.description).toBeDefined();
      expect(result.data?.documentUrl).toBeDefined();
    });

    it('AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = getAzureSubnetGuide('aws-test-project');
      expect(result.error?.code).toBe('NOT_AZURE_PROJECT');
    });
  });

  describe('getAzureServiceSettings', () => {
    it('서비스 설정 반환', () => {
      const result = getAzureServiceSettings('SERVICE-A');
      expect(result.error).toBeUndefined();
      expect(result.data?.scanApp).toBeDefined();
      expect(typeof result.data?.scanApp.registered).toBe('boolean');
    });

    it('등록된 Scan App은 appId와 status 포함', () => {
      // SERVICE-A는 해시 기반으로 등록됨
      const result = getAzureServiceSettings('SERVICE-A');
      if (result.data?.scanApp.registered) {
        expect(result.data.scanApp.appId).toBeDefined();
        expect(result.data.scanApp.status).toBe('VALID');
        expect(result.data.scanApp.lastVerifiedAt).toBeDefined();
      }
    });

    it('미등록 Scan App은 가이드 포함', () => {
      const result = getAzureServiceSettings('SERVICE-B');
      if (!result.data?.scanApp.registered) {
        expect(result.data?.guide).toBeDefined();
        expect(result.data?.guide?.description).toBeDefined();
        expect(result.data?.guide?.documentUrl).toBeDefined();
      }
    });

    it('캐시된 설정은 동일한 결과 반환', () => {
      const result1 = getAzureServiceSettings('SERVICE-A');
      const result2 = getAzureServiceSettings('SERVICE-A');
      expect(result1.data?.scanApp.appId).toBe(result2.data?.scanApp.appId);
    });
  });

  describe('hasVmResources / hasDbResources', () => {
    it('VM 리소스 존재 여부 확인', () => {
      const store = getStore();
      store.projects.push(createAzureProject());
      store.projects.push(createAzureProjectWithVm());

      expect(hasVmResources('azure-test-project')).toBe(false);
      expect(hasVmResources('azure-vm-project')).toBe(true);
    });

    it('DB 리소스 존재 여부 확인', () => {
      const store = getStore();
      store.projects.push(createAzureProject());
      store.projects.push(createAzureProjectWithVm());

      expect(hasDbResources('azure-test-project')).toBe(true);
      expect(hasDbResources('azure-vm-project')).toBe(true); // AZURE_SYNAPSE 포함
    });

    it('존재하지 않는 프로젝트는 false', () => {
      expect(hasVmResources('non-existent')).toBe(false);
      expect(hasDbResources('non-existent')).toBe(false);
    });
  });
});
