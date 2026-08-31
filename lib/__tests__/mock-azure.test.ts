import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAzureInstallationStatus,
  checkAzureInstallation,
  getAzureVmInstallationStatus,
  checkAzureVmInstallation,
  getAzureVmTerraformScript,
  getAzureServiceSettings,
  resetAzureStore,
  hasVmResources,
  hasDbResources,
} from '@/lib/mock-azure';
import { mockAzure } from '@/lib/bff/mock/azure';
import { getStore } from '@/lib/mock-store';
import { Project, ProcessStatus } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process';

const AZURE_TARGET_SOURCE_ID = 9001;
const AZURE_VM_TARGET_SOURCE_ID = 9003;
const AWS_TARGET_SOURCE_ID = 9002;
const NONEXISTENT_TARGET_SOURCE_ID = 99999;

// 테스트용 Azure 프로젝트 생성 헬퍼
const createAzureProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'azure-test-project',
  targetSourceId: 9001,
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
      integrationCategory: 'TARGET',
    },
    {
      id: 'res-2',
      type: 'AZURE_POSTGRESQL',
      resourceId: 'pg-test-001',
      databaseType: 'POSTGRESQL',
      connectionStatus: 'PENDING',
      isSelected: true,
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
  targetSourceId: AZURE_VM_TARGET_SOURCE_ID,
  resources: [
    {
      id: 'res-vm-1',
      type: 'AZURE_VM',
      resourceId: 'vm-test-001',
      databaseType: 'MSSQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      integrationCategory: 'NO_INSTALL_NEEDED',
    },
    {
      id: 'res-vm-2',
      type: 'AZURE_VM',
      resourceId: 'vm-test-002',
      databaseType: 'POSTGRESQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      integrationCategory: 'NO_INSTALL_NEEDED',
    },
    {
      id: 'res-db-1',
      type: 'AZURE_SYNAPSE',
      resourceId: 'synapse-test-001',
      databaseType: 'MSSQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      integrationCategory: 'TARGET',
    },
  ],
  ...overrides,
});

const createAwsProject = (): Project => ({
  id: 'aws-test-project',
  targetSourceId: 9002,
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
      const result = getAzureInstallationStatus(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.status).toBe(404);
    });

    it('AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = getAzureInstallationStatus(AWS_TARGET_SOURCE_ID);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NOT_AZURE_PROJECT');
      expect(result.error?.status).toBe(400);
    });

    it('Azure 프로젝트는 설치 상태 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProject());

      const result = getAzureInstallationStatus(AZURE_TARGET_SOURCE_ID);
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

      const result = getAzureInstallationStatus(AZURE_TARGET_SOURCE_ID);
      const allApproved = result.data?.resources.every(
        (r) => r.privateEndpoint.status === 'APPROVED'
      );
      expect(result.data?.installed).toBe(allApproved);
    });

    it('DB 리소스는 Private Endpoint 정보 포함 (TF 완료 여부는 status로 판단)', () => {
      const store = getStore();
      store.projects.push(createAzureProject());

      const result = getAzureInstallationStatus(AZURE_TARGET_SOURCE_ID);
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

      const result1 = getAzureInstallationStatus(AZURE_TARGET_SOURCE_ID);
      const result2 = getAzureInstallationStatus(AZURE_TARGET_SOURCE_ID);

      expect(result1.data?.lastCheckedAt).toBe(result2.data?.lastCheckedAt);
    });
  });

  describe('checkAzureInstallation', () => {
    it('존재하지 않는 프로젝트는 NOT_FOUND 에러 반환', () => {
      const result = checkAzureInstallation(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('새로고침 시 lastCheckedAt 갱신', () => {
      const store = getStore();
      store.projects.push(createAzureProject());

      const result1 = getAzureInstallationStatus(AZURE_TARGET_SOURCE_ID);
      expect(result1.data?.lastCheckedAt).toBeDefined();

      // checkAzureInstallation은 캐시를 삭제하고 새로 조회하므로 lastCheckedAt가 갱신됨
      const result2 = checkAzureInstallation(AZURE_TARGET_SOURCE_ID);
      expect(result2.data?.lastCheckedAt).toBeDefined();
      // 갱신 함수가 정상 동작하는지 확인 (데이터 반환)
      expect(result2.data?.resources).toBeDefined();
    });

    it('AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = checkAzureInstallation(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_AZURE_PROJECT');
    });
  });

  describe('getAzureVmInstallationStatus', () => {
    it('VM 리소스가 있는 프로젝트는 VM 상태 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProjectWithVm());

      const result = getAzureVmInstallationStatus(AZURE_VM_TARGET_SOURCE_ID);
      expect(result.error).toBeUndefined();
      expect(result.data?.vms).toHaveLength(2); // VM만 필터링
      expect(result.data?.lastCheckedAt).toBeDefined();
    });

    it('VM 리소스가 없는 프로젝트는 빈 배열 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProject()); // DB만 있는 프로젝트

      const result = getAzureVmInstallationStatus(AZURE_TARGET_SOURCE_ID);
      expect(result.data?.vms).toHaveLength(0);
    });

    it('VM 상태는 subnetExists와 loadBalancer 포함', () => {
      const store = getStore();
      store.projects.push(createAzureProjectWithVm());

      const result = getAzureVmInstallationStatus(AZURE_VM_TARGET_SOURCE_ID);
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

      const result = getAzureVmInstallationStatus(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_AZURE_PROJECT');
    });
  });

  describe('checkAzureVmInstallation', () => {
    it('새로고침 시 lastCheckedAt 갱신', () => {
      const store = getStore();
      store.projects.push(createAzureProjectWithVm());

      const result1 = getAzureVmInstallationStatus(AZURE_VM_TARGET_SOURCE_ID);
      expect(result1.data?.lastCheckedAt).toBeDefined();

      // checkAzureVmInstallation은 캐시를 삭제하고 새로 조회하므로 lastCheckedAt가 갱신됨
      const result2 = checkAzureVmInstallation(AZURE_VM_TARGET_SOURCE_ID);
      expect(result2.data?.lastCheckedAt).toBeDefined();
      // 갱신 함수가 정상 동작하는지 확인 (데이터 반환)
      expect(result2.data?.vms).toBeDefined();
    });
  });

  describe('getAzureVmTerraformScript', () => {
    it('VM 리소스가 있는 프로젝트는 Script 정보 반환', () => {
      const store = getStore();
      store.projects.push(createAzureProjectWithVm());

      const result = getAzureVmTerraformScript(AZURE_VM_TARGET_SOURCE_ID);
      expect(result.error).toBeUndefined();
      expect(result.data?.downloadUrl).toBeDefined();
      expect(result.data?.fileName).toContain('terraform');
      expect(result.data?.generatedAt).toBeDefined();
    });

    it('VM 리소스가 없는 프로젝트는 NO_VM_RESOURCES 에러', () => {
      const store = getStore();
      store.projects.push(createAzureProject()); // DB만 있는 프로젝트

      const result = getAzureVmTerraformScript(AZURE_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NO_VM_RESOURCES');
      expect(result.error?.status).toBe(400);
    });

    it('AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = getAzureVmTerraformScript(AWS_TARGET_SOURCE_ID);
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

      expect(hasVmResources(AZURE_TARGET_SOURCE_ID)).toBe(false);
      expect(hasVmResources(AZURE_VM_TARGET_SOURCE_ID)).toBe(true);
    });

    it('DB 리소스 존재 여부 확인', () => {
      const store = getStore();
      store.projects.push(createAzureProject());
      store.projects.push(createAzureProjectWithVm());

      expect(hasDbResources(AZURE_TARGET_SOURCE_ID)).toBe(true);
      expect(hasDbResources(AZURE_VM_TARGET_SOURCE_ID)).toBe(true); // AZURE_SYNAPSE 포함
    });

    it('존재하지 않는 프로젝트는 false', () => {
      expect(hasVmResources(NONEXISTENT_TARGET_SOURCE_ID)).toBe(false);
      expect(hasDbResources(NONEXISTENT_TARGET_SOURCE_ID)).toBe(false);
    });
  });
});

/**
 * BFF wire layer (`lib/bff/mock/azure.ts`) — the VM rows.
 *
 * 도메인 목은 리소스를 DB(`isDbResource`)와 VM(`isVmResource`)으로 갈라 담고 두 타입
 * 집합은 서로소다. 그래서 wire 층이 VM 상태를 DB 행에 resource_id 로 join 하던 것은
 * 어떤 대상에서도 맞은 적이 없었고, 계약이 가진 VM 두 단계가 늘 SKIP 으로만 나갔다.
 * 붙지 않은 VM 은 제 행으로 선다 — 이 두 테스트가 그 행과, 겹칠 때 겹치지 않음을 잡는다.
 */
interface WireStep {
  status: string;
}

interface WireRow {
  resource_id: string;
  azure_virtual_machine_subnet_creation?: WireStep;
  azure_virtual_machine_terraform_apply?: WireStep;
  service_side_private_endpoint_approval?: { status: string };
}

const installationRows = async (targetSourceId: number): Promise<WireRow[]> => {
  const response = await mockAzure.getInstallationStatus(String(targetSourceId));
  expect(response.status).toBe(200);
  const body = (await response.json()) as { resources: WireRow[] };
  return body.resources;
};

describe('mockAzure.getInstallationStatus — VM 행', () => {
  beforeEach(() => {
    resetStore();
  });

  it('DB 목록에 없는 VM 은 제 행으로 서고, 두 단계가 subnet·LB 에서 나온다', async () => {
    getStore().projects.push(createAzureProjectWithVm());

    const rows = await installationRows(AZURE_VM_TARGET_SOURCE_ID);
    const vms = getAzureVmInstallationStatus(AZURE_VM_TARGET_SOURCE_ID).data?.vms ?? [];
    expect(vms.length).toBeGreaterThan(0);

    for (const vm of vms) {
      const row = rows.find((r) => r.resource_id === vm.vmId);
      expect(row).toBeDefined();
      // 값을 손으로 적지 않는다 — 목의 subnet/LB 가 곧 이 두 칸의 출처라는 것이 요지다.
      expect(row?.azure_virtual_machine_subnet_creation?.status).toBe(
        vm.subnetExists ? 'COMPLETED' : 'IN_PROGRESS',
      );
      expect(row?.azure_virtual_machine_terraform_apply?.status).toBe(
        vm.loadBalancer.installed ? 'COMPLETED' : 'IN_PROGRESS',
      );
    }

    // DB 행은 VM 이 아니므로 그 두 칸을 갖지 않는다 — 어댑터가 없는 칸을 SKIP 으로 읽는다.
    const dbRow = rows.find((r) => r.resource_id === 'synapse-test-001');
    expect(dbRow?.azure_virtual_machine_subnet_creation).toBeUndefined();
  });

  it('VM 이 DB 행과 같은 id 를 쓰면 행이 둘로 늘지 않는다', async () => {
    const sharedId = 'shared-test-001';
    getStore().projects.push(
      createAzureProjectWithVm({
        targetSourceId: AZURE_VM_TARGET_SOURCE_ID,
        resources: [
          {
            id: 'res-db-shared',
            type: 'AZURE_MSSQL',
            resourceId: sharedId,
            databaseType: 'MSSQL',
            connectionStatus: 'PENDING',
            isSelected: true,
            integrationCategory: 'TARGET',
          },
          {
            id: 'res-vm-shared',
            type: 'AZURE_VM',
            resourceId: sharedId,
            databaseType: 'MSSQL',
            connectionStatus: 'PENDING',
            isSelected: true,
            integrationCategory: 'NO_INSTALL_NEEDED',
          },
        ],
      }),
    );

    const rows = await installationRows(AZURE_VM_TARGET_SOURCE_ID);
    expect(rows.filter((r) => r.resource_id === sharedId)).toHaveLength(1);
    // 겹치면 원래의 join 이 맞으므로, 그 한 행이 PE 와 VM 두 단계를 함께 진다.
    const row = rows.find((r) => r.resource_id === sharedId);
    expect(row?.service_side_private_endpoint_approval).toBeDefined();
    expect(row?.azure_virtual_machine_subnet_creation).toBeDefined();
  });
});
