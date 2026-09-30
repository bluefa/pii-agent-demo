// @vitest-environment jsdom
/**
 * Jira Ticket — 서버 쪽 축: 목록 한 페이지 + 행마다 협업 채널 GET. 한 행의 채널 조회
 * 실패는 그 행만 '조회 실패' 이고, 목록 실패는 자기 문장을 받는다.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAlertTargetSources = vi.hoisted(() => vi.fn());
const getCollaborationChannel = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }));

vi.mock('@/lib/bff/client', () => ({
  bff: { taskQueue: { getAlertTargetSources }, ops: { getCollaborationChannel } },
}));
vi.mock('next/navigation', () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/x',
}));

import { JiraWorklistSection } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklistSection';

const page = (content: unknown[]) => ({
  content, number: 0, totalPages: 1, totalElements: content.length, size: 10,
  first: true, last: true, numberOfElements: content.length, empty: content.length === 0,
});

beforeEach(() => vi.clearAllMocks());

describe('JiraWorklistSection', () => {
  it('reads one channel per row; a failed channel GET is 조회 실패 for that row only', async () => {
    getAlertTargetSources.mockResolvedValue(
      page([
        { targetSourceId: 2113, serviceCode: 'PAY', serviceName: '결제서비스', cloudProvider: 'AWS' },
        { targetSourceId: 1980, serviceCode: 'MBR', serviceName: '회원서비스', cloudProvider: 'GCP' },
      ]),
    );
    getCollaborationChannel
      .mockResolvedValueOnce({ status: 'RETRYING', issue_key: '', attempt_count: 0, max_attempts: 6, next_attempt_at: '2026-09-30T14:30:00.000000' })
      .mockRejectedValueOnce(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(await JiraWorklistSection({ kind: 'jira-ticket-failed', pageIndex: 0, size: 10, count: 2 }));

    expect(getAlertTargetSources).toHaveBeenCalledWith({ kind: 'jira-ticket-failed', page: 0, size: 10 });
    expect(getCollaborationChannel).toHaveBeenCalledTimes(2);
    // attempt_count 0 → no (n/m)
    expect(screen.getByText('재시도 중')).toBeDefined();
    expect(screen.getByText('14:30')).toBeDefined();
    expect(screen.getByText('조회 실패')).toBeDefined();
    warn.mockRestore();
  });

  it('a failed list keeps the table and says so', async () => {
    getAlertTargetSources.mockRejectedValue(new Error('upstream 503'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(await JiraWorklistSection({ kind: 'jira-watcher-failed', pageIndex: 0, size: 10, count: null }));
    expect(screen.getByText('목록을 불러오지 못했습니다.')).toBeDefined();
    expect(getCollaborationChannel).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('an out-of-range page redirects to the last page', async () => {
    getAlertTargetSources.mockResolvedValue({ ...page([]), totalPages: 2 });
    await expect(
      JiraWorklistSection({ kind: 'jira-ticket-failed', pageIndex: 5, size: 10, count: 1 }),
    ).rejects.toThrow('REDIRECT:/admin/pipelines/ops/jira?kind=jira-ticket-failed&page=2');
  });
});
