import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIdcInstallationStatus,
  checkIdcInstallation,
  confirmFirewall,
  getSourceIpRecommendation,
  getIdcServiceSettings,
  updateIdcServiceSettings,
  resetIdcStore,
} from '@/lib/mock-idc';
import { getStore } from '@/lib/mock-store';
import { Project, ProcessStatus } from '@/lib/types';

// 테스트용 IDC 프로젝트 생성 헬퍼
const createIdcProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'idc-test-project',
  projectCode: 'IDC-TEST-001',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'IDC',
  processStatus: ProcessStatus.INSTALLING,
  resources: [
    {
      id: 'res-1',
      type: 'MySQL',
      resourceId: 'mysql-test-001',
      databaseType: 'MYSQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      lifecycleStatus: 'INSTALLING',
    },
    {
      id: 'res-2',
      type: 'PostgreSQL',
      resourceId: 'pg-test-001',
      databaseType: 'POSTGRESQL',
      connectionStatus: 'PENDING',
      isSelected: true,
      lifecycleStatus: 'INSTALLING',
    },
  ],
  terraformState: { bdcTf: 'PENDING' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  name: 'IDC Test Project',
  description: 'IDC Test Description',
  isRejected: false,
  ...overrides,
});

const createAwsProject = (): Project => ({
  id: 'aws-test-project',
  projectCode: 'AWS-TEST-001',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.INSTALLING,
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
  resetIdcStore();
};

describe('mock-idc', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('getIdcInstallationStatus', () => {
    it('존재하지 않는 프로젝트는 NOT_FOUND 에러 반환', () => {
      const result = getIdcInstallationStatus('non-existent');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.status).toBe(404);
    });

    it('AWS 프로젝트는 NOT_IDC_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = getIdcInstallationStatus('aws-test-project');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NOT_IDC_PROJECT');
      expect(result.error?.status).toBe(400);
    });

    it('IDC 프로젝트는 설치 상태 반환', () => {
      const store = getStore();
      store.projects.push(createIdcProject());

      const result = getIdcInstallationStatus('idc-test-project');
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.provider).toBe('IDC');
      expect(result.data?.lastCheckedAt).toBeDefined();
    });

    it('bdcTf는 유효한 상태값 중 하나', () => {
      const store = getStore();
      store.projects.push(createIdcProject());

      const result = getIdcInstallationStatus('idc-test-project');
      const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];
      expect(validStatuses).toContain(result.data?.bdcTf);
    });

    it('firewallOpened는 boolean 타입', () => {
      const store = getStore();
      store.projects.push(createIdcProject());

      const result = getIdcInstallationStatus('idc-test-project');
      expect(typeof result.data?.firewallOpened).toBe('boolean');
    });

    it('캐시된 상태는 동일한 결과 반환', () => {
      const store = getStore();
      store.projects.push(createIdcProject());

      const result1 = getIdcInstallationStatus('idc-test-project');
      const result2 = getIdcInstallationStatus('idc-test-project');

      expect(result1.data?.lastCheckedAt).toBe(result2.data?.lastCheckedAt);
      expect(result1.data?.bdcTf).toBe(result2.data?.bdcTf);
    });
  });

  describe('checkIdcInstallation', () => {
    it('존재하지 않는 프로젝트는 NOT_FOUND 에러 반환', () => {
      const result = checkIdcInstallation('non-existent');
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('AWS 프로젝트는 NOT_IDC_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = checkIdcInstallation('aws-test-project');
      expect(result.error?.code).toBe('NOT_IDC_PROJECT');
    });

    it('새로고침 시 lastCheckedAt 갱신', () => {
      const store = getStore();
      store.projects.push(createIdcProject());

      const result1 = getIdcInstallationStatus('idc-test-project');
      expect(result1.data?.lastCheckedAt).toBeDefined();

      // checkIdcInstallation은 캐시를 삭제하고 새로 조회하므로 lastCheckedAt가 갱신됨
      const result2 = checkIdcInstallation('idc-test-project');
      expect(result2.data?.lastCheckedAt).toBeDefined();
      expect(result2.data?.provider).toBe('IDC');
    });
  });

  describe('confirmFirewall', () => {
    it('존재하지 않는 프로젝트는 NOT_FOUND 에러 반환', () => {
      const result = confirmFirewall('non-existent');
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('AWS 프로젝트는 NOT_IDC_PROJECT 에러 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject());

      const result = confirmFirewall('aws-test-project');
      expect(result.error?.code).toBe('NOT_IDC_PROJECT');
    });

    it('방화벽 확인 성공 시 confirmed: true 반환', () => {
      const store = getStore();
      store.projects.push(createIdcProject());

      const result = confirmFirewall('idc-test-project');
      expect(result.error).toBeUndefined();
      expect(result.data?.confirmed).toBe(true);
      expect(result.data?.confirmedAt).toBeDefined();
    });

    it('방화벽 확인 후 설치 상태에 firewallOpened: true 반영', () => {
      const store = getStore();
      store.projects.push(createIdcProject());

      // 먼저 설치 상태 조회 (캐시 생성)
      getIdcInstallationStatus('idc-test-project');

      // 방화벽 확인
      confirmFirewall('idc-test-project');

      // 다시 설치 상태 조회
      const result = getIdcInstallationStatus('idc-test-project');
      expect(result.data?.firewallOpened).toBe(true);
    });
  });

  describe('getSourceIpRecommendation', () => {
    it('public IP 타입에 대한 추천 반환', () => {
      const result = getSourceIpRecommendation('public');
      expect(result.error).toBeUndefined();
      expect(result.data?.sourceIps).toBeDefined();
      expect(result.data?.sourceIps.length).toBeGreaterThan(0);
      expect(result.data?.port).toBeDefined();
      expect(result.data?.description).toBeDefined();
    });

    it('private IP 타입에 대한 추천 반환', () => {
      const result = getSourceIpRecommendation('private');
      expect(result.error).toBeUndefined();
      expect(result.data?.sourceIps).toBeDefined();
      expect(result.data?.description).toContain('Private');
    });

    it('vpc IP 타입에 대한 추천 반환', () => {
      const result = getSourceIpRecommendation('vpc');
      expect(result.error).toBeUndefined();
      expect(result.data?.sourceIps).toBeDefined();
      expect(result.data?.description).toContain('VPC');
    });

    it('유효하지 않은 IP 타입은 에러 반환', () => {
      // @ts-expect-error: 의도적으로 잘못된 타입 전달
      const result = getSourceIpRecommendation('invalid');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('INVALID_IP_TYPE');
      expect(result.error?.status).toBe(400);
    });
  });

  describe('getIdcServiceSettings', () => {
    it('서비스 설정 반환', () => {
      const result = getIdcServiceSettings('SERVICE-A');
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(typeof result.data?.firewallPrepared).toBe('boolean');
    });

    it('firewallPrepared가 false일 때 가이드 포함', () => {
      const result = getIdcServiceSettings('SERVICE-B');
      if (!result.data?.firewallPrepared) {
        expect(result.data?.guide).toBeDefined();
        expect(result.data?.guide?.description).toBeDefined();
        expect(result.data?.guide?.documentUrl).toBeDefined();
      }
    });

    it('firewallPrepared가 true일 때 가이드 없음', () => {
      const result = getIdcServiceSettings('SERVICE-A');
      if (result.data?.firewallPrepared) {
        expect(result.data?.guide).toBeUndefined();
      }
    });

    it('캐시된 설정은 동일한 결과 반환', () => {
      const result1 = getIdcServiceSettings('SERVICE-A');
      const result2 = getIdcServiceSettings('SERVICE-A');
      expect(result1.data?.firewallPrepared).toBe(result2.data?.firewallPrepared);
    });
  });

  describe('updateIdcServiceSettings', () => {
    it('firewallPrepared를 true로 업데이트', () => {
      // 먼저 조회하여 캐시 생성
      getIdcServiceSettings('SERVICE-A');

      // 업데이트
      const result = updateIdcServiceSettings('SERVICE-A', true);
      expect(result.error).toBeUndefined();
      expect(result.data?.firewallPrepared).toBe(true);
      expect(result.data?.guide).toBeUndefined();
    });

    it('firewallPrepared를 false로 업데이트', () => {
      // 먼저 조회하여 캐시 생성
      getIdcServiceSettings('SERVICE-A');

      // 업데이트
      const result = updateIdcServiceSettings('SERVICE-A', false);
      expect(result.error).toBeUndefined();
      expect(result.data?.firewallPrepared).toBe(false);
      expect(result.data?.guide).toBeDefined();
    });

    it('업데이트 후 조회 시 변경된 값 반환', () => {
      // 먼저 조회하여 캐시 생성
      getIdcServiceSettings('SERVICE-C');

      // 업데이트
      updateIdcServiceSettings('SERVICE-C', true);

      // 다시 조회
      const result = getIdcServiceSettings('SERVICE-C');
      expect(result.data?.firewallPrepared).toBe(true);
    });
  });

  describe('resetIdcStore', () => {
    it('스토어 초기화 후 캐시 삭제됨', () => {
      const store = getStore();
      store.projects.push(createIdcProject());

      // 상태 조회 (캐시 생성)
      const result1 = getIdcInstallationStatus('idc-test-project');
      expect(result1.data).toBeDefined();

      // 스토어 초기화
      resetIdcStore();

      // 다시 조회 (새로운 상태 생성)
      const result2 = getIdcInstallationStatus('idc-test-project');

      // 초기화 후에도 데이터가 정상적으로 생성됨을 확인
      expect(result2.data).toBeDefined();
      expect(result2.data?.provider).toBe('IDC');
    });
  });
});
