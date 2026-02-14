import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  verifyTfRole,
  initializeInstallation,
  getInstallationStatus,
  checkInstallation,
  getTerraformScript,
} from '@/lib/mock-installation';
import { getStore } from '@/lib/mock-store';
import type { Project } from '@/lib/types';
import { ProcessStatus } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process';

const createAwsProject = (id: string, resources?: Project['resources']): Project => ({
  id,
  projectCode: `AWS-${id}`,
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.INSTALLING,
  status: createInitialProjectStatus(),
  resources: resources ?? [
    {
      id: 'res-1', type: 'RDS', resourceId: 'arn:aws:rds:ap-northeast-2:123:db:test-1',
      databaseType: 'MYSQL', connectionStatus: 'PENDING', isSelected: true,
      lifecycleStatus: 'INSTALLING', awsType: 'RDS', integrationCategory: 'TARGET',
    },
  ],
  terraformState: { bdcTf: 'PENDING' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  name: 'Test',
  description: '',
  isRejected: false,
  awsAccountId: id.includes('fail') ? '123456789012' : '123456789012',
  targetSourceId: 9999,
});

// Store 초기화
const resetStore = () => {
  const store = getStore();
  store.awsInstallations = new Map();
  store.projects = [];
};

describe('mock-installation', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('verifyTfRole', () => {
    it('유효한 Role ARN으로 검증 성공', () => {
      const result = verifyTfRole({ accountId: '123456789012' });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.roleArn).toBe('arn:aws:iam::123456789012:role/TerraformExecutionRole');
        expect(result.permissions.canCreateResources).toBe(true);
        expect(result.permissions.canManageIam).toBe(true);
        expect(result.permissions.canAccessS3).toBe(true);
      }
    });

    it('커스텀 roleArn 사용', () => {
      const result = verifyTfRole({
        accountId: '123456789012',
        roleArn: 'arn:aws:iam::123456789012:role/CustomRole',
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.roleArn).toBe('arn:aws:iam::123456789012:role/CustomRole');
      }
    });

    it('존재하지 않는 Role → ROLE_NOT_FOUND', () => {
      const result = verifyTfRole({ accountId: '123456789000' });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errorCode).toBe('ROLE_NOT_FOUND');
        expect(result.guide).toBeDefined();
        expect(result.guide.title).toBe('TerraformExecutionRole 생성 필요');
      }
    });

    it('권한 부족 → INSUFFICIENT_PERMISSIONS', () => {
      const result = verifyTfRole({ accountId: '123456789111' });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errorCode).toBe('INSUFFICIENT_PERMISSIONS');
        expect(result.guide).toBeDefined();
      }
    });

    it('접근 거부 → ACCESS_DENIED', () => {
      const result = verifyTfRole({ accountId: '123456789222' });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errorCode).toBe('ACCESS_DENIED');
        expect(result.guide).toBeDefined();
      }
    });
  });

  describe('initializeInstallation', () => {
    it('TF 권한 있음 → 자동 설치 시작', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-1'));
      const status = initializeInstallation('project-1', true);

      expect(status.provider).toBe('AWS');
      expect(status.hasTfPermission).toBe(true);
      expect(status.serviceTfCompleted).toBe(false);
      expect(status.bdcTfCompleted).toBe(false);
    });

    it('TF 권한 없음 → 수동 설치 대기', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-2'));
      const status = initializeInstallation('project-2', false);

      expect(status.provider).toBe('AWS');
      expect(status.hasTfPermission).toBe(false);
      expect(status.serviceTfCompleted).toBe(false);
      expect(status.bdcTfCompleted).toBe(false);
    });
  });

  describe('getInstallationStatus', () => {
    it('존재하지 않는 프로젝트 → null', () => {
      const result = getInstallationStatus('non-existent');
      expect(result).toBeNull();
    });

    it('초기 상태 조회', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-1'));
      initializeInstallation('project-1', true);
      const status = getInstallationStatus('project-1');

      expect(status).not.toBeNull();
      expect(status?.serviceTfCompleted).toBe(false);
      expect(status?.bdcTfCompleted).toBe(false);
    });

    it('자동 설치: Service TF 완료 (10초 후)', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-1'));
      initializeInstallation('project-1', true);

      // 10초 경과
      vi.advanceTimersByTime(10000);

      const status = getInstallationStatus('project-1');
      expect(status?.serviceTfCompleted).toBe(true);
      expect(status?.bdcTfCompleted).toBe(false);
    });

    it('자동 설치: 모든 TF 완료 (Service TF 후 BDC TF)', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-1'));
      initializeInstallation('project-1', true);

      // Service TF 완료 대기
      vi.advanceTimersByTime(10000);
      // 첫 번째 조회로 BDC TF 시작 트리거
      getInstallationStatus('project-1');

      // BDC TF 완료 대기
      vi.advanceTimersByTime(5000);

      const status = getInstallationStatus('project-1');
      expect(status?.serviceTfCompleted).toBe(true);
      expect(status?.bdcTfCompleted).toBe(true);
      expect(status?.completedAt).toBeDefined();
    });
  });

  describe('checkInstallation', () => {
    it('존재하지 않는 프로젝트 → null', () => {
      const result = checkInstallation('non-existent');
      expect(result).toBeNull();
    });

    it('수동 설치: 검증 성공 → serviceTfCompleted = true', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-1'));
      initializeInstallation('project-1', false);
      const result = checkInstallation('project-1');

      expect(result).not.toBeNull();
      expect(result?.serviceTfCompleted).toBe(true);
      expect(result?.lastCheckedAt).toBeDefined();
    });

    it('수동 설치: 검증 실패 → error 응답', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-fail'));
      initializeInstallation('project-fail', false);
      const result = checkInstallation('project-fail');

      expect(result).not.toBeNull();
      expect(result?.error).toBeDefined();
      expect(result?.error?.code).toBe('VALIDATION_FAILED');
      expect(result?.error?.guide).toBeDefined();
    });

    it('수동 설치: Service TF 완료 후 BDC TF 자동 시작', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-1'));
      initializeInstallation('project-1', false);

      // 첫 번째 확인: Service TF 완료
      checkInstallation('project-1');

      // BDC TF 완료 시간 경과
      vi.advanceTimersByTime(5000);

      const result = checkInstallation('project-1');
      expect(result?.bdcTfCompleted).toBe(true);
      expect(result?.completedAt).toBeDefined();
    });

    it('lastCheckedAt 업데이트', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-1'));
      initializeInstallation('project-1', true);

      const result1 = checkInstallation('project-1');
      const firstCheckedAt = result1?.lastCheckedAt;

      vi.advanceTimersByTime(1000);

      const result2 = checkInstallation('project-1');
      expect(result2?.lastCheckedAt).not.toBe(firstCheckedAt);
    });
  });

  describe('getTerraformScript', () => {
    it('TF 권한 있음 → null (스크립트 불필요)', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-1'));
      initializeInstallation('project-1', true);
      const result = getTerraformScript('project-1');

      expect(result).toBeNull();
    });

    it('TF 권한 없음 → 다운로드 정보 반환', () => {
      const store = getStore();
      store.projects.push(createAwsProject('project-1'));
      initializeInstallation('project-1', false);
      const result = getTerraformScript('project-1');

      expect(result).not.toBeNull();
      expect(result?.downloadUrl).toContain('project-1');
      expect(result?.fileName).toContain('project-1');
      expect(result?.expiresAt).toBeDefined();
    });

    it('존재하지 않는 프로젝트 → null', () => {
      const result = getTerraformScript('non-existent');
      expect(result).toBeNull();
    });
  });
});
