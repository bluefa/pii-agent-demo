import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateScanRequest,
  createScanJob,
  calculateScanStatus,
  getScanHistory,
  canScan,
  generateAwsResource,
  generateAzureResource,
  generateGcpResource,
} from '@/lib/mock-scan';
import { getStore } from '@/lib/mock-store';
import { Project, ProcessStatus, ScanJob } from '@/lib/types';
import { MAX_RESOURCES, SCAN_COOLDOWN_MS } from '@/lib/constants/scan';
import { createInitialProjectStatus } from '@/lib/process';

// 테스트용 프로젝트 생성 헬퍼
const createTestProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'test-project-1',
  targetSourceId: 9001,
  projectCode: 'TEST-001',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  status: createInitialProjectStatus(),
  resources: [],
  terraformState: { bdcTf: 'PENDING' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  name: 'Test Project',
  description: 'Test Description',
  isRejected: false,
  ...overrides,
});

// Store 초기화
const resetStore = () => {
  const store = getStore();
  store.scans = [];
  store.scanHistory = [];
};

describe('mock-scan', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('validateScanRequest', () => {
    describe('Provider별 스캔 가능 여부', () => {
      it('AWS 프로젝트는 스캔 가능', () => {
        const project = createTestProject({ cloudProvider: 'AWS' });
        const result = validateScanRequest(project);
        expect(result.valid).toBe(true);
      });

      it('Azure 프로젝트는 스캔 가능', () => {
        const project = createTestProject({ cloudProvider: 'Azure' });
        const result = validateScanRequest(project);
        expect(result.valid).toBe(true);
      });

      it('GCP 프로젝트는 스캔 가능', () => {
        const project = createTestProject({ cloudProvider: 'GCP' });
        const result = validateScanRequest(project);
        expect(result.valid).toBe(true);
      });

    });

    describe('리소스 최대 개수 검증', () => {
      // MAX_RESOURCES 는 목이 새 리소스를 몇 개까지 지어낼지 정하는 상한이지
      // 스캔 거부 조건이 아니다. 꽉 찬 대상도 "발견 0건"으로 정상 완료해야 한다.
      it('리소스가 MAX_RESOURCES 만큼 차 있어도 스캔 가능', () => {
        const project = createTestProject({
          resources: Array(MAX_RESOURCES).fill(null).map((_, i) => ({
            id: `res-${i}`,
            type: 'RDS',
            resourceId: `arn:aws:rds:ap-northeast-2:123456789012:db:test-${i}`,
            databaseType: 'MYSQL' as const,
            connectionStatus: 'PENDING' as const,
            isSelected: false,
            integrationCategory: 'TARGET' as const,
          })),
        });
        const result = validateScanRequest(project);
        expect(result.valid).toBe(true);
      });
    });

    describe('중복 스캔 검증', () => {
      it('진행 중인 스캔이 있으면 스캔 불가 (SCAN_IN_PROGRESS)', () => {
        const project = createTestProject();
        const store = getStore();

        // 진행 중인 스캔 추가
        store.scans.push({
          id: 'scan-1',
          targetSourceId: project.targetSourceId,
          provider: 'AWS',
          status: 'SCANNING',
          startedAt: new Date().toISOString(),
          estimatedEndAt: new Date(Date.now() + 10000).toISOString(),
          progress: 50,
        });

        const result = validateScanRequest(project);
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('SCAN_IN_PROGRESS');
        expect(result.httpStatus).toBe(409);
        expect(result.existingScanId).toBe('scan-1');
      });
      // 저장 구간(SAVING)은 스캔이 끝났지만 결과를 아직 쓰는 중이다 — 여기서 새 스캔이
      // 들어오면 두 스캔이 같은 target_resource 를 동시에 쓴다. 쿨다운이 0이라 이 창은
      // 실제로 열려 있고, 막는 건 이 판정뿐이다.
      it('저장 중(SAVING)인 스캔이 있으면 스캔 불가 (SCAN_IN_PROGRESS)', () => {
        const project = createTestProject();
        const store = getStore();

        store.scanHistory.push({
          id: 'history-saving',
          targetSourceId: project.targetSourceId,
          scanId: 'scan-saving',
          version: 1,
          provider: 'AWS',
          status: 'SUCCESS',
          startedAt: new Date(Date.now() - 5000).toISOString(),
          completedAt: new Date(Date.now() - 500).toISOString(), // 저장 창(3초) 안
          duration: 4.5,
          result: { totalFound: 1, byResourceType: [] },
          resourceCountBefore: 0,
          resourceCountAfter: 1,
          addedResourceIds: [],
        });

        const result = validateScanRequest(project);
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('SCAN_IN_PROGRESS');
        expect(result.httpStatus).toBe(409);
        expect(result.existingScanId).toBe('scan-saving');
      });

      // 실패로 끝난 스캔은 쓸 결과가 없다 — 저장 구간을 갖지 않는다.
      it('방금 실패한 스캔은 저장 구간이 없으므로 스캔 가능', () => {
        const project = createTestProject();
        const store = getStore();

        store.scanHistory.push({
          id: 'history-fail',
          targetSourceId: project.targetSourceId,
          scanId: 'scan-fail',
          version: 1,
          provider: 'AWS',
          status: 'FAIL',
          startedAt: new Date(Date.now() - 5000).toISOString(),
          completedAt: new Date(Date.now() - 500).toISOString(),
          duration: 4.5,
          result: { totalFound: 0, byResourceType: [] },
          resourceCountBefore: 0,
          resourceCountAfter: 0,
          addedResourceIds: [],
        });

        expect(validateScanRequest(project).valid).toBe(true);
      });
    });

    describe('쿨다운 검증', () => {
      it('쿨다운이 0이므로 최근 완료된 스캔이 있어도 스캔 가능', () => {
        const project = createTestProject();
        const store = getStore();

        store.scanHistory.push({
          id: 'history-1',
          targetSourceId: project.targetSourceId,
          scanId: 'scan-old',
          version: 1,
          provider: 'AWS',
          status: 'SUCCESS',
          startedAt: new Date(Date.now() - 60000).toISOString(),
          completedAt: new Date(Date.now() - 30000).toISOString(),
          duration: 30,
          result: { totalFound: 1, byResourceType: [] },
          resourceCountBefore: 0,
          resourceCountAfter: 1,
          addedResourceIds: [],
        });

        const result = validateScanRequest(project, false);
        expect(result.valid).toBe(true);
      });

      it('5분 이상 지났으면 스캔 가능', () => {
        const project = createTestProject();
        const store = getStore();

        // 6분 전 완료된 스캔 이력 추가. 쿨다운이 0이라 `- 1000` 은 "1초 전"이 되어
        // 저장 구간(SAVING) 안에 떨어진다 — 이름대로 실제로 오래된 시각을 준다.
        store.scanHistory.push({
          id: 'history-1',
          targetSourceId: project.targetSourceId,
          scanId: 'scan-old',
          version: 1,
          provider: 'AWS',
          status: 'SUCCESS',
          startedAt: new Date(Date.now() - 400000).toISOString(),
          completedAt: new Date(Date.now() - SCAN_COOLDOWN_MS - 370000).toISOString(),
          duration: 30,
          result: { totalFound: 1, byResourceType: [] },
          resourceCountBefore: 0,
          resourceCountAfter: 1,
          addedResourceIds: [],
        });

        const result = validateScanRequest(project, false);
        expect(result.valid).toBe(true);
      });
    });

    it('프로젝트가 없으면 NOT_FOUND', () => {
      const result = validateScanRequest(undefined);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('NOT_FOUND');
      expect(result.httpStatus).toBe(404);
    });
  });

  describe('createScanJob', () => {
    it('스캔 작업을 생성하고 store에 저장', () => {
      const project = createTestProject();
      const scanJob = createScanJob(project);

      expect(scanJob.id).toMatch(/^scan-/);
      expect(scanJob.targetSourceId).toBe(project.targetSourceId);
      expect(scanJob.provider).toBe('AWS');
      expect(scanJob.status).toBe('SCANNING');
      expect(scanJob.progress).toBe(0);
      expect(scanJob.startedAt).toBeDefined();
      expect(scanJob.estimatedEndAt).toBeDefined();

      // Store에 저장되었는지 확인
      const store = getStore();
      expect(store.scans).toContainEqual(scanJob);
    });

    it('예상 완료 시간은 3~10초 후', () => {
      const project = createTestProject();
      const scanJob = createScanJob(project);

      const startTime = new Date(scanJob.startedAt).getTime();
      const endTime = new Date(scanJob.estimatedEndAt).getTime();
      const duration = endTime - startTime;

      expect(duration).toBeGreaterThanOrEqual(3000);
      expect(duration).toBeLessThanOrEqual(10000);
    });
  });

  describe('calculateScanStatus', () => {
    it('완료 시간 전이면 SCANNING으로 업데이트', () => {
      const now = Date.now();
      const scan: ScanJob = {
        id: 'scan-1',
        targetSourceId: 9001,
        provider: 'AWS',
        status: 'SCANNING',
        startedAt: new Date(now - 2000).toISOString(),
        estimatedEndAt: new Date(now + 3000).toISOString(),
        progress: 0,
      };

      const store = getStore();
      store.scans.push(scan);

      const result = calculateScanStatus(scan);
      expect(result.status).toBe('SCANNING');
      expect(result.progress).toBeGreaterThan(0);
      expect(result.progress).toBeLessThan(100);
    });

    it('완료 시간 이후면 SUCCESS로 업데이트', () => {
      const now = Date.now();
      const scan: ScanJob = {
        id: 'scan-1',
        targetSourceId: 9001,
        provider: 'AWS',
        status: 'SCANNING',
        startedAt: new Date(now - 5000).toISOString(),
        estimatedEndAt: new Date(now - 1000).toISOString(),
        progress: 0,
      };

      // 프로젝트도 store에 추가
      const store = getStore();
      store.projects.push(createTestProject());
      store.scans.push(scan);

      const result = calculateScanStatus(scan);
      expect(result.status).toBe('SUCCESS');
      expect(result.progress).toBe(100);
      expect(result.completedAt).toBeDefined();
    });

    it('이미 SUCCESS인 스캔은 변경 없음', () => {
      const scan: ScanJob = {
        id: 'scan-1',
        targetSourceId: 9001,
        provider: 'AWS',
        status: 'SUCCESS',
        startedAt: new Date(Date.now() - 5000).toISOString(),
        estimatedEndAt: new Date(Date.now() - 1000).toISOString(),
        completedAt: new Date(Date.now() - 1000).toISOString(),
        progress: 100,
        result: { totalFound: 1, byResourceType: [] },
      };

      const result = calculateScanStatus(scan);
      expect(result).toEqual(scan);
    });
  });

  describe('canScan', () => {
    it('스캔 가능한 프로젝트', () => {
      const project = createTestProject();
      const result = canScan(project);
      expect(result.canScan).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('리소스 최대 개수에 도달해도 스캔 가능', () => {
      const project = createTestProject({
        resources: Array(MAX_RESOURCES).fill(null).map((_, i) => ({
          id: `res-${i}`,
          type: 'RDS',
          resourceId: `arn:aws:rds:ap-northeast-2:123456789012:db:test-${i}`,
          databaseType: 'MYSQL' as const,
          connectionStatus: 'PENDING' as const,
          isSelected: false,
          integrationCategory: 'TARGET' as const,
        })),
      });
      const result = canScan(project);
      expect(result.canScan).toBe(true);
    });
  });

  describe('getScanHistory', () => {
    it('빈 이력 반환', () => {
      const result = getScanHistory(9001);
      expect(result.history).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('이력 조회 및 페이징', () => {
      const store = getStore();

      // 12개 이력 추가
      for (let i = 0; i < 12; i++) {
        store.scanHistory.push({
          id: `history-${i}`,
          targetSourceId: 9001,
          scanId: `scan-${i}`,
          version: i + 1,
          provider: 'AWS',
          status: 'SUCCESS',
          startedAt: new Date(Date.now() - (i + 1) * 60000).toISOString(),
          completedAt: new Date(Date.now() - i * 60000).toISOString(),
          duration: 60,
          result: { totalFound: i, byResourceType: [] },
          resourceCountBefore: 0,
          resourceCountAfter: i,
          addedResourceIds: [],
        });
      }

      // 기본 조회 (limit=10)
      const result1 = getScanHistory(9001);
      expect(result1.history).toHaveLength(10);
      expect(result1.total).toBe(12);

      // limit=5
      const result2 = getScanHistory(9001, 5);
      expect(result2.history).toHaveLength(5);
      expect(result2.total).toBe(12);

      // offset=10
      const result3 = getScanHistory(9001, 10, 10);
      expect(result3.history).toHaveLength(2);
      expect(result3.total).toBe(12);
    });
  });

  describe('Provider-specific MockResource Generation', () => {
    const AWS_TYPES = ['RDS', 'RDS_CLUSTER', 'DYNAMODB', 'ATHENA', 'REDSHIFT', 'EC2'];
    const AZURE_TYPES = ['AZURE_MSSQL', 'AZURE_POSTGRESQL', 'AZURE_MYSQL', 'AZURE_MARIADB', 'AZURE_COSMOS_NOSQL', 'AZURE_SYNAPSE', 'AZURE_VM'];
    const GCP_TYPES = ['CLOUD_SQL', 'BIGQUERY'];

    describe('generateAwsResource', () => {
      it('AWS 리소스 타입만 생성', () => {
        for (let i = 0; i < 20; i++) {
          const resource = generateAwsResource();
          expect(AWS_TYPES).toContain(resource.type);
          expect(resource.awsType).toBeDefined();
          expect(AWS_TYPES).toContain(resource.awsType);
          expect(resource.region).toBeDefined();
        }
      });

      it('AWS ARN 형식의 resourceId 생성', () => {
        const resource = generateAwsResource();
        expect(resource.resourceId).toMatch(/^arn:aws:/);
      });

      it('기본 속성 설정', () => {
        const resource = generateAwsResource();
        expect(resource.id).toMatch(/^res-/);
        expect(resource.connectionStatus).toBe('PENDING');
        expect(resource.isSelected).toBe(false);
      });

      it('RDS 타입은 MYSQL 또는 POSTGRESQL', () => {
        for (let i = 0; i < 20; i++) {
          const resource = generateAwsResource();
          if (resource.awsType === 'RDS' || resource.awsType === 'RDS_CLUSTER') {
            expect(['MYSQL', 'POSTGRESQL']).toContain(resource.databaseType);
          }
        }
      });

      it('DYNAMODB 타입은 DYNAMODB databaseType', () => {
        for (let i = 0; i < 50; i++) {
          const resource = generateAwsResource();
          if (resource.awsType === 'DYNAMODB') {
            expect(resource.databaseType).toBe('DYNAMODB');
          }
        }
      });
    });

    describe('generateAzureResource', () => {
      it('Azure 리소스 타입만 생성', () => {
        for (let i = 0; i < 20; i++) {
          const resource = generateAzureResource();
          expect(AZURE_TYPES).toContain(resource.type);
        }
      });

      it('Azure resourceId 형식 생성', () => {
        const resource = generateAzureResource();
        expect(resource.resourceId).toMatch(/^\/subscriptions\//);
      });

      it('AZURE_MSSQL은 MSSQL databaseType', () => {
        for (let i = 0; i < 50; i++) {
          const resource = generateAzureResource();
          if (resource.type === 'AZURE_MSSQL') {
            expect(resource.databaseType).toBe('MSSQL');
          }
        }
      });

      it('AZURE_COSMOS_NOSQL은 COSMOSDB databaseType', () => {
        for (let i = 0; i < 50; i++) {
          const resource = generateAzureResource();
          if (resource.type === 'AZURE_COSMOS_NOSQL') {
            expect(resource.databaseType).toBe('COSMOSDB');
          }
        }
      });

      it('AWS 타입이 생성되지 않음', () => {
        for (let i = 0; i < 20; i++) {
          const resource = generateAzureResource();
          expect(AWS_TYPES).not.toContain(resource.type);
          expect(resource.awsType).toBeUndefined();
        }
      });
    });

    describe('generateGcpResource', () => {
      it('GCP 리소스 타입만 생성', () => {
        for (let i = 0; i < 20; i++) {
          const resource = generateGcpResource();
          expect(GCP_TYPES).toContain(resource.type);
        }
      });

      it('CLOUD_SQL은 projects/ 형식 resourceId', () => {
        for (let i = 0; i < 50; i++) {
          const resource = generateGcpResource();
          if (resource.type === 'CLOUD_SQL') {
            expect(resource.resourceId).toMatch(/^projects\//);
          }
        }
      });

      it('BIGQUERY는 bigquery:// URI 형식', () => {
        for (let i = 0; i < 50; i++) {
          const resource = generateGcpResource();
          if (resource.type === 'BIGQUERY') {
            expect(resource.resourceId).toMatch(/^bigquery:\/\//);
            expect(resource.databaseType).toBe('BIGQUERY');
          }
        }
      });

      it('AWS/Azure 타입이 생성되지 않음', () => {
        for (let i = 0; i < 20; i++) {
          const resource = generateGcpResource();
          expect(AWS_TYPES).not.toContain(resource.type);
          expect(AZURE_TYPES).not.toContain(resource.type);
          expect(resource.awsType).toBeUndefined();
        }
      });
    });
  });
});
