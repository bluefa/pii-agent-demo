import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/lib/types';
import { BffError } from '@/lib/bff/errors';
import { TARGET_SOURCE_LOAD_FALLBACK } from '@/app/target-sources/[targetSourceId]/load-error';

const { getTargetSourceMock, getCurrentUserMock, getProcessStatusMock, getJiraTicketMock } =
  vi.hoisted(() => ({
    getTargetSourceMock: vi.fn(),
    getCurrentUserMock: vi.fn(),
    getProcessStatusMock: vi.fn(),
    getJiraTicketMock: vi.fn(),
  }));

vi.mock('@/lib/bff/client', () => ({
  bff: {
    targetSources: {
      get: getTargetSourceMock,
      getJiraTicket: getJiraTicketMock,
    },
    confirm: {
      getProcessStatus: getProcessStatusMock,
    },
    users: {
      me: getCurrentUserMock,
    },
  },
}));

vi.mock('@/app/target-sources/[targetSourceId]/_components/ProjectDetail', () => ({
  ProjectDetail: () => null,
}));

vi.mock('@/app/target-sources/[targetSourceId]/_components/common', () => ({
  ErrorState: () => null,
}));

import ProjectDetailPage from '@/app/target-sources/[targetSourceId]/page';

describe('GET /pass/target-sources/[targetSourceId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('current user 조회 없이 프로젝트만 전달한다 (ADR-019: snake wire → TargetSource)', async () => {
    // ADR-019: bff.targetSources.get returns raw snake TargetSourceDetail (no
    // process_status). Page fetches process_status from the process-status endpoint
    // and calls extractTargetSourceFromSnake to produce the TargetSource domain model.
    getTargetSourceMock.mockResolvedValue({
      target_source_id: 321,
      cloud_provider: 'AWS',
      created_at: '2026-04-01T00:00:00Z',
    });
    getProcessStatusMock.mockResolvedValue({
      target_source_id: 321,
      process_status: 'IDLE',
      healthy: 'HEALTHY',
      evaluated_at: '2026-04-01T00:00:00Z',
    });

    const element = await ProjectDetailPage({
      params: Promise.resolve({ targetSourceId: '321' }),
    }) as ReactElement<{
      initialProject: Project;
    }>;

    expect(getTargetSourceMock).toHaveBeenCalledWith(321);
    expect(getProcessStatusMock).toHaveBeenCalledWith(321);
    expect(getCurrentUserMock).not.toHaveBeenCalled();
    // Page transforms snake wire via extractTargetSourceFromSnake.
    expect(element.props).toMatchObject({
      initialProject: expect.objectContaining({ targetSourceId: 321 }),
    });
    expect(element.props).not.toHaveProperty('initialUser');
    expect(element.props).not.toHaveProperty('initialCredentials');
  });

  /**
   * A failed load must RESOLVE to an ErrorState, never reject. Rejecting hands the
   * failure to error.tsx, which in a production build no longer has the status —
   * every outage would read the same, under Next's own English notice.
   */
  describe('조회 실패', () => {
    const load = () =>
      ProjectDetailPage({ params: Promise.resolve({ targetSourceId: '321' }) }) as Promise<
        ReactElement<{ message?: string }>
      >;

    beforeEach(() => {
      getProcessStatusMock.mockResolvedValue({
        target_source_id: 321,
        process_status: 'IDLE',
        healthy: 'HEALTHY',
        evaluated_at: '2026-04-01T00:00:00Z',
      });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('404 는 대상을 못 찾았다고 말한다', async () => {
      getTargetSourceMock.mockRejectedValue(new BffError(404, 'NOT_FOUND', 'no such row'));
      expect((await load()).props.message).toContain('찾을 수 없어요');
    });

    /**
     * Next's dev overlay turns a server-side console.error into a red error card. A
     * 404 this page renders a proper screen for is not a fault, and logging it there
     * makes a working screen look broken to whoever is developing against it.
     */
    it('처리한 404 는 console.error 를 쓰지 않는다', async () => {
      getTargetSourceMock.mockRejectedValue(new BffError(404, 'NOT_FOUND', 'no such row'));
      await load();
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      // 그리고 에러 객체를 넘기지 않는다 — 오버레이가 되살릴 스택이 없어야 한다.
      expect(vi.mocked(console.warn).mock.calls[0].some((a) => a instanceof Error)).toBe(false);
    });

    it('분류 못 한 실패는 console.error 로 남긴다', async () => {
      getTargetSourceMock.mockRejectedValue(new BffError(500, 'UPSTREAM', 'boom'));
      await load();
      expect(console.error).toHaveBeenCalled();
    });

    it('403 은 권한 문제라고 말한다', async () => {
      getTargetSourceMock.mockRejectedValue(new BffError(403, 'FORBIDDEN', 'denied'));
      expect((await load()).props.message).toContain('권한이 없어요');
    });

    it('분류 못 하는 실패는 기본 문구로 떨어진다', async () => {
      getTargetSourceMock.mockRejectedValue(new BffError(500, 'UPSTREAM', 'boom'));
      expect((await load()).props.message).toBe(TARGET_SOURCE_LOAD_FALLBACK);

      getTargetSourceMock.mockRejectedValue(new TypeError('fetch failed'));
      expect((await load()).props.message).toBe(TARGET_SOURCE_LOAD_FALLBACK);
    });

    /**
     * 상세는 왔는데 상태 조회가 죽으면 화면 전체가 안내로 대체된다. `Promise.all` 이라
     * 한쪽 거절이 곧 전체 거절이고, process_status 없이는 어느 단계를 그릴지 알 수 없다.
     *
     * 지금은 이게 의도된 동작이다. 다만 jira 티켓은 같은 자리에서 일부러 'error' 로
     * 강등해 화면을 세우므로, 상태 조회도 같은 대우를 받을 수 있는지는 열린 질문이다.
     */
    it('상태 조회가 실패하면 화면 전체가 안내로 대체된다', async () => {
      getTargetSourceMock.mockResolvedValue({ target_source_id: 321, cloud_provider: 'AWS' });
      getProcessStatusMock.mockRejectedValue(new BffError(503, 'UNAVAILABLE', 'down'));
      expect((await load()).props.message).toBe(TARGET_SOURCE_LOAD_FALLBACK);
    });

    it('잘못된 식별자는 요청도 보내지 않는다', async () => {
      const element = (await ProjectDetailPage({
        params: Promise.resolve({ targetSourceId: 'abc' }),
      })) as ReactElement<{ message?: string }>;
      expect(element.props.message).toContain('올바르지 않아요');
      expect(getTargetSourceMock).not.toHaveBeenCalled();
    });
  });
});
