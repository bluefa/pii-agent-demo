// @vitest-environment jsdom
/**
 * Jira Ticket 콘솔 — 타일·메타·상태 태그 문구. 데이터는 서버가 props 로 내린다.
 */
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';

import { passRoutes } from '@/lib/routes';
import type { CollaborationChannel } from '@/lib/types/collaboration-channel';

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }), usePathname: () => '/x' }));

import { JiraHeader } from '@/app/admin/pipelines/ops/jira/_components/JiraHeader';
import { JiraWorklist, type JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';
import { EMPTY_JIRA_COUNTS, defaultJiraKind } from '@/app/admin/pipelines/ops/jira/_components/jiraBuckets';
import { channelTagCopy } from '@/app/admin/pipelines/ops/jira/_components/ChannelTag';

const channel = (over: Partial<CollaborationChannel>): CollaborationChannel => ({
  issueKey: null,
  url: null,
  status: 'RETRYING',
  attemptCount: 3,
  maxAttempts: 6,
  nextAttemptAt: '2026-09-30T14:20:00.000000',
  ...over,
});

const row = (over: Partial<JiraWorklistRow>): JiraWorklistRow => ({
  targetSourceId: 2113,
  serviceName: '결제서비스',
  description: '결제 승인 원장 RDS',
  serviceCode: 'PAY',
  cloudProvider: 'AWS',
  confirmStatus: 'CONFIRMED',
  createdAt: null,
  latestApprovalRequest: null,
  installationLifecycleStatus: null,
  isSduType: false,
  failedWatchers: null,
  channel: channel({}),
  ...over,
});

const worklist = (props: Partial<Parameters<typeof JiraWorklist>[0]> = {}) => (
  <JiraWorklist
    kind="jira-ticket-failed"
    label="티켓 생성 실패"
    owner="관리자"
    count={4}
    icon="jira"
    rows={[row({})]}
    page={0}
    totalPages={1}
    failed={false}
    {...props}
  />
);

describe('기본 버킷과 타일', () => {
  it('건수 있는 첫 버킷을 고르고, 전부 0 이면 첫 버킷', () => {
    expect(defaultJiraKind({ ...EMPTY_JIRA_COUNTS, jiraWatcherFailedCount: 1 })).toBe('jira-watcher-failed');
    expect(defaultJiraKind(EMPTY_JIRA_COUNTS)).toBe('jira-ticket-failed');
  });

  it('타일은 ?kind= 링크이고 선택된 하나만 aria-current 다', () => {
    render(
      <JiraHeader
        total={6}
        counts={{ jiraTicketFailedCount: 4, jiraWatcherFailedCount: 2 }}
        selected="jira-ticket-failed"
      />,
    );
    const selected = screen.getByRole('link', { name: /티켓 생성 실패/ });
    expect(selected.getAttribute('href')).toBe(`${passRoutes.pipelines.ops.jira}?kind=jira-ticket-failed`);
    expect(selected.getAttribute('aria-current')).toBe('page');
    const other = screen.getByRole('link', { name: /Watcher 등록 실패/ });
    expect(other.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('6')).toBeDefined();
  });

  it('요약 실패는 0 이 아니다 — 문장이 바뀐다', () => {
    render(<JiraHeader total={null} counts={null} selected="jira-ticket-failed" />);
    expect(screen.getByText(/건수를 불러오지 못했어요/)).toBeDefined();
  });
});

describe('상태 태그 문구', () => {
  it('RETRYING 은 둘 다 있을 때만 (n/m) 을 붙인다', () => {
    expect(channelTagCopy(channel({})).text).toBe('재시도 중 (3/6)');
    expect(channelTagCopy(channel({ attemptCount: 0 })).text).toBe('재시도 중');
    expect(channelTagCopy(channel({ attemptCount: null })).text).toBe('재시도 중');
    expect(channelTagCopy(channel({ maxAttempts: null })).text).toBe('재시도 중');
  });

  it('나머지 상태와 조회 실패', () => {
    expect(channelTagCopy(channel({ status: 'CREATED' })).text).toBe('생성됨');
    expect(channelTagCopy(channel({ status: 'PENDING' })).text).toBe('티켓 생성 중');
    expect(channelTagCopy(channel({ status: 'FAILED' })).text).toBe('자동 생성 실패');
    expect(channelTagCopy(channel({ status: 'NONE' })).text).toBe('티켓 없음');
    expect(channelTagCopy(null)).toEqual({ text: '조회 실패', tone: 'off' });
  });
});

describe('JiraWorklist', () => {
  it('티켓 버킷: 메타 줄 · 상태 태그 · 다음 시도 HH:mm · 행이 모달을 연다', () => {
    render(worklist());
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('관리자')).toBeDefined();
    expect(screen.getByText('재시도 중 (3/6)')).toBeDefined();
    expect(screen.getByText('14:20')).toBeDefined();
    expect(screen.getByText('다음 시도')).toBeDefined();

    fireEvent.click(screen.getByText('결제서비스').closest('tr') as HTMLElement);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('button', { name: '티켓 연결' })).toBeDefined();
    // 행은 운영 화면으로 가지 않는다.
    expect(push).not.toHaveBeenCalled();
  });

  it('watcher 버킷: Watcher N명 실패 + 사용자 줄, 티켓 열은 채널의 키', () => {
    render(
      worklist({
        kind: 'jira-watcher-failed',
        label: 'Watcher 등록 실패',
        icon: 'user-plus',
        rows: [
          row({
            targetSourceId: 1861,
            channel: channel({ status: 'CREATED', issueKey: 'BDCDIP-2211' }),
            failedWatchers: [
              { username: 'hong.gildong', status: 'FAILED', attemptCount: 6 },
              { username: 'kim.cs', status: 'RETRYING', attemptCount: 3 },
            ],
          }),
        ],
      }),
    );
    expect(screen.getByText('Watcher 2명 실패')).toBeDefined();
    expect(screen.getByText('hong.gildong, kim.cs')).toBeDefined();
    expect(screen.getByText('BDCDIP-2211')).toBeDefined();
    expect(screen.getByText('티켓')).toBeDefined();
  });

  it('SDU 대상은 Cloud 셀이 SDU 다', () => {
    render(worklist({ rows: [row({ targetSourceId: 1099, isSduType: true })] }));
    expect(screen.getByText('SDU')).toBeDefined();
  });

  it('실패와 0 건은 다른 문장을 받는다', () => {
    const { unmount } = render(worklist({ rows: [], failed: true }));
    expect(screen.getByText('목록을 불러오지 못했습니다.')).toBeDefined();
    unmount();
    render(worklist({ rows: [] }));
    expect(screen.getByText('해당 단계의 대상이 없습니다.')).toBeDefined();
  });

  it('페이지 이동은 ?kind=&page= 주소를 민다', () => {
    push.mockClear();
    render(worklist({ totalPages: 3 }));
    fireEvent.click(screen.getByRole('button', { name: /다음/ }));
    expect(push).toHaveBeenCalledWith(`${passRoutes.pipelines.ops.jira}?kind=jira-ticket-failed&page=2`);
  });
});
