import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getGcpInstallationStatus,
  checkGcpInstallation,
  resetGcpStore,
} from '@/lib/mock-gcp';
import { resetStore, getStore } from '@/lib/mock-store';
import type { MockResource } from '@/lib/types';

// ===== Fixtures =====

const GCP_TARGET_SOURCE_ID = 1002;
const AWS_TARGET_SOURCE_ID = 1006;
const NONEXISTENT_TARGET_SOURCE_ID = 99999;

const FIXED_DATE = new Date('2026-04-23T00:00:00.000Z');
const FIXED_ISO = FIXED_DATE.toISOString();

// Hash-chosen 고정: charCodeSum % 3 = 0 → PRIVATE_IP_MODE, +offsets % 5 = 1 → 모든 step COMPLETED.
const CLOUD_SQL_RESOURCE_ID = 'cloud-sql-test-01';

// Hash-chosen 고정: BIGQUERY → subType null, subnet SKIP, svcTf/bdcTf COMPLETED.
const BIGQUERY_RESOURCE_ID = 'bq-dataset-1';

const injectGcpResources = (resources: MockResource[]): void => {
  const store = getStore();
  const project = store.projects.find((p) => p.targetSourceId === GCP_TARGET_SOURCE_ID);
  if (!project) throw new Error(`GCP project (targetSourceId=${GCP_TARGET_SOURCE_ID}) not found in store`);
  project.resources = resources;
};

const cloudSqlResource = (): MockResource => ({
  id: 'gcp-res-cloud-sql',
  type: 'CLOUD_SQL',
  resourceId: CLOUD_SQL_RESOURCE_ID,
  databaseType: 'MYSQL',
  connectionStatus: 'PENDING',
  isSelected: true,
  integrationCategory: 'TARGET',
});

const bigqueryResource = (): MockResource => ({
  id: 'gcp-res-bigquery',
  type: 'BIGQUERY',
  resourceId: BIGQUERY_RESOURCE_ID,
  databaseType: 'MYSQL',
  connectionStatus: 'PENDING',
  isSelected: true,
  integrationCategory: 'TARGET',
});

describe('mock-gcp behavior lock-in', () => {
  beforeEach(() => {
    resetStore();
    resetGcpStore();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
    // 기본: 진행 없음
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getGcpInstallationStatus', () => {
    it('resources 없는 GCP project → 빈 resources 배열 반환', () => {
      const result = getGcpInstallationStatus(GCP_TARGET_SOURCE_ID);

      expect(result.error).toBeUndefined();
      expect(result.data?.provider).toBe('GCP');
      expect(result.data?.resources).toEqual([]);
      expect(result.data?.lastCheckedAt).toBe(FIXED_ISO);
    });

    it('CLOUD_SQL 리소스 → PRIVATE_IP_MODE + 3 step 활성 (모두 COMPLETED)', () => {
      injectGcpResources([cloudSqlResource()]);
      const result = getGcpInstallationStatus(GCP_TARGET_SOURCE_ID);

      expect(result.data?.resources).toHaveLength(1);
      const [res] = result.data!.resources;
      expect(res.resourceId).toBe(CLOUD_SQL_RESOURCE_ID);
      expect(res.resourceName).toBe(CLOUD_SQL_RESOURCE_ID);
      expect(res.resourceType).toBe('CLOUD_SQL');
      expect(res.resourceSubType).toBe('PRIVATE_IP_MODE');
      expect(res.installationStatus).toBe('COMPLETED');
      expect(res.serviceSideSubnetCreation).toEqual({ status: 'COMPLETED', guide: null });
      expect(res.serviceSideTerraformApply).toEqual({ status: 'COMPLETED', guide: null });
      expect(res.bdcSideTerraformApply).toEqual({ status: 'COMPLETED', guide: null });
    });

    it('BIGQUERY 리소스 → subType null + subnet SKIP + svcTf/bdcTf COMPLETED', () => {
      injectGcpResources([bigqueryResource()]);
      const result = getGcpInstallationStatus(GCP_TARGET_SOURCE_ID);

      expect(result.data?.resources).toHaveLength(1);
      const [res] = result.data!.resources;
      expect(res.resourceType).toBe('BIGQUERY');
      expect(res.resourceSubType).toBeNull();
      expect(res.installationStatus).toBe('COMPLETED');
      expect(res.serviceSideSubnetCreation).toEqual({ status: 'SKIP' });
      expect(res.serviceSideTerraformApply).toEqual({ status: 'COMPLETED', guide: null });
      expect(res.bdcSideTerraformApply).toEqual({ status: 'COMPLETED', guide: null });
    });

    it('isSelected=false 리소스는 필터링됨', () => {
      injectGcpResources([
        { ...cloudSqlResource(), isSelected: false },
        bigqueryResource(),
      ]);
      const result = getGcpInstallationStatus(GCP_TARGET_SOURCE_ID);

      expect(result.data?.resources).toHaveLength(1);
      expect(result.data?.resources[0].resourceType).toBe('BIGQUERY');
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = getGcpInstallationStatus(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.data).toBeUndefined();
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.status).toBe(404);
    });

    it('비-GCP project → NOT_GCP_PROJECT 에러', () => {
      const result = getGcpInstallationStatus(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_GCP_PROJECT');
      expect(result.error?.status).toBe(400);
    });

    it('캐시: 두번째 호출도 동일 객체 반환 (reference equality)', () => {
      injectGcpResources([cloudSqlResource()]);
      const first = getGcpInstallationStatus(GCP_TARGET_SOURCE_ID);
      const second = getGcpInstallationStatus(GCP_TARGET_SOURCE_ID);
      expect(second.data).toBe(first.data);
    });
  });

  describe('checkGcpInstallation', () => {
    it('캐시 삭제 후 재생성 → lastCheckedAt 갱신', () => {
      injectGcpResources([cloudSqlResource()]);
      getGcpInstallationStatus(GCP_TARGET_SOURCE_ID);

      vi.setSystemTime(new Date('2026-04-23T00:10:00.000Z'));
      const result = checkGcpInstallation(GCP_TARGET_SOURCE_ID);

      expect(result.data?.lastCheckedAt).toBe('2026-04-23T00:10:00.000Z');
      expect(result.data?.resources).toHaveLength(1);
    });

    it('COMPLETED 상태는 Math.random=0 에도 유지 (advance 는 IN_PROGRESS 만 대상)', () => {
      injectGcpResources([cloudSqlResource()]);
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = checkGcpInstallation(GCP_TARGET_SOURCE_ID);

      expect(result.data?.resources[0].installationStatus).toBe('COMPLETED');
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = checkGcpInstallation(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('비-GCP project → NOT_GCP_PROJECT 에러', () => {
      const result = checkGcpInstallation(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_GCP_PROJECT');
    });
  });

  describe('resetGcpStore', () => {
    it('reset 후 캐시 삭제됨 (lastCheckedAt 갱신 가능)', () => {
      injectGcpResources([cloudSqlResource()]);
      getGcpInstallationStatus(GCP_TARGET_SOURCE_ID);

      vi.setSystemTime(new Date('2026-04-23T00:05:00.000Z'));
      resetGcpStore();

      const result = getGcpInstallationStatus(GCP_TARGET_SOURCE_ID);
      expect(result.data?.lastCheckedAt).toBe('2026-04-23T00:05:00.000Z');
    });
  });
});
