import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestConnectionJob,
  getLatestJob,
  getJobHistory,
  hasPendingJob,
  clearJobHistory,
  toJobResponse,
} from '@/lib/mock-test-connection';
import { getStore, resetStore } from '@/lib/mock-store';
import type { Project } from '@/lib/types';

// ===== Fixtures =====

const AWS_PROJECT_ID = 'proj-1';
const AWS_TARGET_SOURCE_ID = 1006;
const SDU_PROJECT_ID = 'proj-sdu-001';
const SDU_TARGET_SOURCE_ID = 1001;
const NONEXISTENT_TARGET_SOURCE_ID = 99999;

const FIXED_DATE = new Date('2026-04-23T00:00:00.000Z');
const FIXED_ISO = FIXED_DATE.toISOString();

// proj-1 은 seed 에서 모든 리소스가 isSelected:false. 테스트용으로 앞 2개를 select.
// Seed 오염 방지를 위해 structuredClone 으로 deep copy 후 store 내 슬롯 교체.
const SELECTED_RESOURCE_COUNT = 2;

const getAwsProjectWithSelectedResources = (): Project => {
  const store = getStore();
  const idx = store.projects.findIndex((p) => p.id === AWS_PROJECT_ID);
  if (idx === -1) throw new Error(`${AWS_PROJECT_ID} not found`);
  const cloned = structuredClone(store.projects[idx]);
  cloned.resources.slice(0, SELECTED_RESOURCE_COUNT).forEach((r) => {
    r.isSelected = true;
  });
  store.projects[idx] = cloned;
  return cloned;
};

const getSduProjectClone = (): Project => {
  const store = getStore();
  const idx = store.projects.findIndex((p) => p.id === SDU_PROJECT_ID);
  if (idx === -1) throw new Error(`${SDU_PROJECT_ID} not found`);
  const cloned = structuredClone(store.projects[idx]);
  store.projects[idx] = cloned;
  return cloned;
};

describe('mock-test-connection behavior lock-in', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('createTestConnectionJob', () => {
    it('PENDING job 을 생성하고 store 에 저장', () => {
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      expect(selectedCount).toBeGreaterThan(0);

      const job = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'tester@example.com');

      expect(job.target_source_id).toBe(AWS_TARGET_SOURCE_ID);
      expect(job.status).toBe('PENDING');
      expect(job.requested_at).toBe(FIXED_ISO);
      expect(job.completed_at).toBeNull();
      expect(job.requested_by).toBe('tester@example.com');
      expect(job.resource_results).toEqual([]);
      expect(job.id).toMatch(/^tc-\d+-[a-z0-9]+$/);

      const store = getStore();
      expect(store.testConnectionJobs).toHaveLength(1);
      expect(store.testConnectionJobs[0].id).toBe(job.id);
    });

    it('selected 리소스가 없어도 job 생성 (빈 schedule)', () => {
      const project = getAwsProjectWithSelectedResources();
      project.resources = []; // selected 없음

      const job = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'tester@example.com');
      expect(job.status).toBe('PENDING');
      expect(job.resource_results).toEqual([]);
    });

    it('두번 호출 시 jobs 에 2개 저장', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      vi.setSystemTime(new Date('2026-04-23T00:00:01.000Z'));
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'b@example.com');

      const store = getStore();
      expect(store.testConnectionJobs).toHaveLength(2);
    });
  });

  describe('getLatestJob', () => {
    it('job 이 없는 project → undefined', () => {
      expect(getLatestJob(AWS_TARGET_SOURCE_ID)).toBeUndefined();
    });

    it('최근 requested_at 순으로 첫번째 job 반환', () => {
      const project = getAwsProjectWithSelectedResources();
      const first = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      vi.setSystemTime(new Date('2026-04-23T00:00:05.000Z'));
      const second = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'b@example.com');

      const latest = getLatestJob(AWS_TARGET_SOURCE_ID);
      expect(latest?.id).toBe(second.id);
      expect(latest?.id).not.toBe(first.id);
    });

    it('다른 project 의 job 은 무시', () => {
      const awsProject = getAwsProjectWithSelectedResources();
      createTestConnectionJob(awsProject, AWS_TARGET_SOURCE_ID, 'a@example.com');

      expect(getLatestJob(SDU_TARGET_SOURCE_ID)).toBeUndefined();
    });

    it('PENDING job 은 시간 진행 시 SUCCESS 로 전환 (Math.random=0)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      // 모든 리소스가 5초 간격으로 스케줄 → 전체 완료 시점까지 시간 진행
      const advanceMs = selectedCount * 5000 + 1000;
      vi.setSystemTime(new Date(FIXED_DATE.getTime() + advanceMs));

      const latest = getLatestJob(AWS_TARGET_SOURCE_ID);
      expect(latest?.status).toBe('SUCCESS');
      expect(latest?.completed_at).toBeDefined();
      expect(latest?.resource_results).toHaveLength(selectedCount);
      latest?.resource_results.forEach((r) => {
        expect(r.status).toBe('SUCCESS');
        expect(r.error_status).toBeNull();
        expect(r.guide).toBeNull();
      });
    });

    it('Math.random=0.9 → FAIL (리소스 일부 FAIL → 전체 FAIL)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      const advanceMs = selectedCount * 5000 + 1000;
      vi.setSystemTime(new Date(FIXED_DATE.getTime() + advanceMs));

      const latest = getLatestJob(AWS_TARGET_SOURCE_ID);
      expect(latest?.status).toBe('FAIL');
      expect(latest?.completed_at).toBeDefined();
      latest?.resource_results.forEach((r) => {
        expect(r.status).toBe('FAIL');
        expect(r.error_status).toBe('PERMISSION_DENIED');
        expect(r.guide).toBeTruthy();
      });
    });

    it('project 가 삭제되면 job 은 FAIL 로 전환', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      // project 제거
      const store = getStore();
      store.projects = store.projects.filter((p) => p.id !== AWS_PROJECT_ID);

      const latest = getLatestJob(AWS_TARGET_SOURCE_ID);
      expect(latest?.status).toBe('FAIL');
      expect(latest?.resource_results).toEqual([]);
    });
  });

  describe('getJobHistory', () => {
    it('job 이 없는 project → 빈 content + total 0', () => {
      const result = getJobHistory(AWS_TARGET_SOURCE_ID, 0, 10);
      expect(result).toEqual({ content: [], total: 0 });
    });

    it('최신순 정렬 + 페이지네이션', () => {
      const project = getAwsProjectWithSelectedResources();
      for (let i = 0; i < 5; i += 1) {
        vi.setSystemTime(new Date(FIXED_DATE.getTime() + i * 1000));
        createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, `user-${i}@example.com`);
      }

      const page0 = getJobHistory(AWS_TARGET_SOURCE_ID, 0, 2);
      expect(page0.total).toBe(5);
      expect(page0.content).toHaveLength(2);
      expect(page0.content[0].requested_by).toBe('user-4@example.com');
      expect(page0.content[1].requested_by).toBe('user-3@example.com');

      const page1 = getJobHistory(AWS_TARGET_SOURCE_ID, 1, 2);
      expect(page1.content).toHaveLength(2);
      expect(page1.content[0].requested_by).toBe('user-2@example.com');

      const page2 = getJobHistory(AWS_TARGET_SOURCE_ID, 2, 2);
      expect(page2.content).toHaveLength(1);
      expect(page2.content[0].requested_by).toBe('user-0@example.com');
    });

    it('다른 project 의 job 은 포함 안됨', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      const sduHistory = getJobHistory(SDU_TARGET_SOURCE_ID, 0, 10);
      expect(sduHistory).toEqual({ content: [], total: 0 });
    });
  });

  describe('hasPendingJob', () => {
    it('job 없으면 false', () => {
      expect(hasPendingJob(AWS_TARGET_SOURCE_ID)).toBe(false);
    });

    it('PENDING job 있으면 true', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');
      expect(hasPendingJob(AWS_TARGET_SOURCE_ID)).toBe(true);
    });

    it('모든 job 이 SUCCESS 면 false', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const project = getAwsProjectWithSelectedResources();
      const selectedCount = project.resources.filter((r) => r.isSelected).length;
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      vi.setSystemTime(new Date(FIXED_DATE.getTime() + selectedCount * 5000 + 1000));

      // 시간 진행 후 getLatestJob 호출로 status 재계산 → SUCCESS 고정
      getLatestJob(AWS_TARGET_SOURCE_ID);

      expect(hasPendingJob(AWS_TARGET_SOURCE_ID)).toBe(false);
    });

    it('다른 project 의 PENDING job 은 무시', () => {
      const project = getAwsProjectWithSelectedResources();
      createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      expect(hasPendingJob(SDU_TARGET_SOURCE_ID)).toBe(false);
    });
  });

  describe('clearJobHistory', () => {
    it('해당 project 의 jobs 만 삭제', () => {
      const awsProject = getAwsProjectWithSelectedResources();
      const sduProject = getSduProjectClone();

      createTestConnectionJob(awsProject, AWS_TARGET_SOURCE_ID, 'a@example.com');
      createTestConnectionJob(sduProject, SDU_TARGET_SOURCE_ID, 'b@example.com');

      clearJobHistory(AWS_TARGET_SOURCE_ID);

      const store = getStore();
      expect(store.testConnectionJobs).toHaveLength(1);
      expect(store.testConnectionJobs[0].target_source_id).toBe(SDU_TARGET_SOURCE_ID);
    });

    it('job 없는 project → no-op', () => {
      expect(() => clearJobHistory(NONEXISTENT_TARGET_SOURCE_ID)).not.toThrow();
    });
  });

  describe('toJobResponse', () => {
    it('내부 필드 (projectId, estimated_end_at, resource_schedule) 제외', () => {
      const project = getAwsProjectWithSelectedResources();
      const job = createTestConnectionJob(project, AWS_TARGET_SOURCE_ID, 'a@example.com');

      const response = toJobResponse(job);

      expect(response).toEqual({
        id: job.id,
        target_source_id: AWS_TARGET_SOURCE_ID,
        status: 'PENDING',
        requested_at: job.requested_at,
        completed_at: null,
        requested_by: 'a@example.com',
        resource_results: [],
      });
      expect(response).not.toHaveProperty('projectId');
      expect(response).not.toHaveProperty('estimated_end_at');
      expect(response).not.toHaveProperty('resource_schedule');
    });
  });
});
