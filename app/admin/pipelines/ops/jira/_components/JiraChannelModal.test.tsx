// @vitest-environment jsdom
/**
 * 협업 채널 모달 — 사실 띠 · 다시 생성(접수·배너 넷) · watcher 표와 등록 · 페이저.
 */
import { act, render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors';
import type { CollaborationChannel, FailedWatcher } from '@/lib/types/collaboration-channel';
import type { JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const retryCollaborationChannel = vi.hoisted(() => vi.fn());
const getCollaborationChannel = vi.hoisted(() => vi.fn());
const addJiraTicketWatcher = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }), usePathname: () => '/x' }));
vi.mock('@/app/lib/api/ops', () => ({
  retryCollaborationChannel,
  getCollaborationChannel,
  addJiraTicketWatcher,
  JIRA_CLOUD_PROVIDERS: ['AWS', 'GCP', 'AZURE', 'IDC', 'SDU'],
}));

import { JiraChannelModal } from '@/app/admin/pipelines/ops/jira/_components/JiraChannelModal';

const channel = (over: Partial<CollaborationChannel>): CollaborationChannel => ({
  issueKey: null,
  url: null,
  status: 'FAILED',
  attemptCount: 9,
  maxAttempts: null,
  nextAttemptAt: null,
  retryPhase: null,
  retryExpiresAt: '2026-09-28T00:00:00',
  failedWatchers: [],
  failedWatchersTotal: 0,
  watcherPage: 0,
  watcherSize: 5,
  manualRetryPending: false,
  manualRetryRequestedAt: null,
  ...over,
});

const watcher = (username: string, over: Partial<FailedWatcher> = {}): FailedWatcher => ({
  username, status: 'FAILED', attemptCount: 6, retryPhase: null, nextAttemptAt: null, retryExpiresAt: null, ...over,
});

const ROW: JiraWorklistRow = {
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
  isChinaRegion: false,
  channel: channel({}),
};

const created = (issueKey: string, over: Partial<CollaborationChannel> = {}) =>
  channel({ status: 'CREATED', issueKey, url: `https://jira.example.com/browse/${issueKey}`, retryExpiresAt: null, ...over });

const failure = (status: number, rawCode?: string) =>
  new AppError({ status, code: status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR', message: 'server says', retriable: false, rawCode });

const ticketModal = (over: Partial<CollaborationChannel> = {}) =>
  render(<JiraChannelModal kind="jira-ticket-failed" row={{ ...ROW, channel: channel(over) }} onClose={vi.fn()} />);

const retryButton = () => screen.getByRole('button', { name: '티켓 다시 생성' });
const clickRetry = async () => {
  await act(async () => {
    fireEvent.click(retryButton());
  });
};
/** 사실 띠의 라벨 → 값 (라벨 span 의 형제). */
const fact = (label: string): string =>
  within(screen.getByTestId('facts-band')).getByText(label).nextElementSibling?.textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('JiraChannelModal — 머리와 사실 띠', () => {
  it('제목 · Cloud 태그 · 정체성 한 줄 · FAILED 는 종료 시각 라벨', () => {
    ticketModal();
    expect(screen.getByRole('heading', { name: '티켓 다시 생성' })).toBeDefined();
    expect(screen.getByText('AWS')).toBeDefined();
    expect(screen.getByText(/Target 2113/).parentElement?.textContent).toBe(
      'Target 2113 · PAY 결제서비스 · 결제 승인 원장 RDS',
    );
    expect(fact('상태')).toBe('자동 생성 실패');
    expect(fact('실패 횟수')).toBe('9회');
    expect(fact('다음 시도')).toBe('—');
    expect(fact('자동 재시도 종료')).toBe('09-28 00:00');
    // 입력은 이 콘솔에 없다
    expect(screen.queryByLabelText('Jira 이슈 키')).toBeNull();
    expect(screen.queryByRole('button', { name: '티켓 연결' })).toBeNull();
  });

  it('RETRYING LONG_TERM(max null): 태그는 접미 없이, 횟수 · 다음 시도 · 종료 예정', () => {
    ticketModal({
      status: 'RETRYING', attemptCount: 6, maxAttempts: null, retryPhase: 'LONG_TERM',
      nextAttemptAt: '2026-10-01T00:50:00', retryExpiresAt: '2026-10-14T00:00:00',
    });
    expect(fact('상태')).toBe('재시도 중');
    expect(fact('실패 횟수')).toBe('6회');
    expect(fact('다음 시도')).toBe('10-01 00:50');
    expect(fact('자동 재시도 종료 예정')).toBe('10-14 00:00');
  });

  it('CREATED: 티켓 링크가 서고 버튼은 없다', () => {
    ticketModal(created('BDCDIP-77'));
    expect(fact('상태')).toBe('생성됨');
    expect(screen.getByRole('link', { name: /BDCDIP-77/ }).getAttribute('href')).toBe('https://jira.example.com/browse/BDCDIP-77');
    expect(screen.queryByRole('button', { name: '티켓 다시 생성' })).toBeNull();
    expect(within(screen.getByTestId('facts-band')).queryByText('실패 횟수')).toBeNull();
  });
});

describe('JiraChannelModal — 다시 생성', () => {
  it('접수: POST → toast·refresh → 재조회 → 접수 배너 + 잠긴 버튼; [다시 조회] 는 watcherSize 5 로 읽는다', async () => {
    retryCollaborationChannel.mockResolvedValue(undefined);
    getCollaborationChannel
      .mockResolvedValueOnce(channel({ status: 'RETRYING', manualRetryPending: true, manualRetryRequestedAt: '2026-09-30T15:02:00' }))
      .mockResolvedValueOnce(created('BDCDIP-5001'));
    ticketModal({ status: 'RETRYING', attemptCount: 2, maxAttempts: 6 });
    await clickRetry();
    expect(retryCollaborationChannel).toHaveBeenCalledWith(2113);
    expect(refresh).toHaveBeenCalled();
    expect(getCollaborationChannel).toHaveBeenCalledWith(2113, { watcherSize: 5 });
    expect(screen.getByRole('status').textContent).toContain('재시도를 접수했어요');
    expect(screen.getByText('요청 09-30 15:02')).toBeDefined();
    expect((retryButton() as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
    });
    expect(getCollaborationChannel).toHaveBeenLastCalledWith(2113, { watcherSize: 5 });
    expect(screen.getByRole('link', { name: /BDCDIP-5001/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: '티켓 다시 생성' })).toBeNull();
  });

  it('pending 으로 열리면 버튼이 잠겨 있고, 조회가 RETRYING·pending=false 로 오면 다시 풀린다', async () => {
    getCollaborationChannel.mockResolvedValue(channel({ status: 'RETRYING', manualRetryPending: false }));
    ticketModal({ status: 'RETRYING', manualRetryPending: true, manualRetryRequestedAt: '2026-09-30T15:02:00' });
    expect((retryButton() as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
    });
    expect((retryButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('BUSY: 경고 배너 + [다시 조회]', async () => {
    retryCollaborationChannel.mockRejectedValue(failure(409, 'JIRA_MANUAL_RETRY_BUSY'));
    ticketModal();
    await clickRetry();
    expect(screen.getByRole('status').textContent).toContain('이미 접수돼 처리 중입니다');
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeDefined();
    expect(getCollaborationChannel).not.toHaveBeenCalled();
  });

  it('UNAVAILABLE: 안내 배너 + 자동 재조회', async () => {
    retryCollaborationChannel.mockRejectedValue(failure(409, 'JIRA_MANUAL_RETRY_UNAVAILABLE'));
    getCollaborationChannel.mockResolvedValue(created('BDCDIP-1'));
    ticketModal();
    await clickRetry();
    expect(screen.getByRole('status').textContent).toContain('다시 생성할 수 없는 상태입니다');
    expect(getCollaborationChannel).toHaveBeenCalledWith(2113, { watcherSize: 5 });
    expect(screen.getByRole('link', { name: /BDCDIP-1/ })).toBeDefined();
  });

  it('NOT_FOUND · DISABLED · 403 · 그 밖: 한 줄 오류 배너', async () => {
    const cases: [AppError, string][] = [
      [failure(404, 'JIRA_TICKET_NOT_FOUND'), '저장된 생성 요청이 없습니다.'],
      [failure(503, 'JIRA_MANUAL_RETRY_DISABLED'), '서버의 자동 생성 기능이 꺼져 있습니다.'],
      [failure(403, 'FORBIDDEN'), '권한이 없습니다.'],
      [failure(500), 'server says'],
    ];
    for (const [err, text] of cases) {
      retryCollaborationChannel.mockRejectedValueOnce(err);
      const { unmount } = ticketModal();
      await clickRetry();
      expect(screen.getByRole('status').textContent).toBe(text);
      unmount();
    }
    expect(getCollaborationChannel).not.toHaveBeenCalled();
  });
});

describe('JiraChannelModal — watcher 버킷', () => {
  const watcherRow = (over: Partial<CollaborationChannel>, rowOver: Partial<JiraWorklistRow> = {}): JiraWorklistRow => ({
    ...ROW,
    targetSourceId: 1799,
    serviceCode: 'DLV',
    serviceName: '배송서비스',
    cloudProvider: 'AZURE',
    channel: created('BDCDIP-1799', over),
    ...rowOver,
  });
  const two = () =>
    watcherRow({
      failedWatchers: [
        watcher('bae.jh'),
        watcher('kim.cs', { status: 'PENDING', attemptCount: 3, retryPhase: 'SHORT_TERM', nextAttemptAt: '2026-09-30T14:40:00' }),
      ],
      failedWatchersTotal: 12,
    });
  const watcherModal = (row: JiraWorklistRow) =>
    render(<JiraChannelModal kind="jira-watcher-failed" row={row} onClose={vi.fn()} />);

  it('사실 띠(티켓 · 상태 · 등록 실패 N명 · 가장 이른 다음 시도), 표, 머리 줄의 모두 등록', () => {
    watcherModal(two());
    expect(screen.getByRole('heading', { name: 'Watcher 등록 실패' })).toBeDefined();
    expect(screen.getByRole('link', { name: /BDCDIP-1799/ })).toBeDefined();
    expect(fact('상태')).toBe('생성됨');
    expect(fact('등록 실패')).toBe('12명');
    expect(fact('다음 시도')).toBe('09-30 14:40');
    expect(screen.getByText('bae.jh')).toBeDefined();
    expect(screen.getByText('재시도 중')).toBeDefined();
    expect(screen.getByRole('button', { name: 'bae.jh 등록' })).toBeDefined();
    const heading = screen.getByRole('heading', { name: '등록 실패한 사용자' });
    expect(heading.parentElement?.querySelector('button')?.textContent).toBe('이 페이지 모두 등록');
    expect(screen.getByTestId('watcher-table-box').className).toContain('h-[212px]');
    expect(screen.queryByLabelText('Jira 이슈 키')).toBeNull();
    // 12명 · 5명씩 → 페이저
    expect(screen.getByRole('navigation', { name: '페이지' })).toBeDefined();
  });

  it('등록: 서비스 코드 · 대문자 provider · username 으로 POST, 행이 등록됨 (재조회 없음)', async () => {
    addJiraTicketWatcher.mockResolvedValue(undefined);
    watcherModal(two());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'bae.jh 등록' }));
    });
    expect(addJiraTicketWatcher).toHaveBeenCalledWith('DLV', 'AZURE', 'bae.jh');
    expect(screen.getByText('등록됨')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'bae.jh 등록' })).toBeNull();
    expect(getCollaborationChannel).not.toHaveBeenCalled();
  });

  it('실패: 서버 문구가 줄로 서고 버튼은 남는다', async () => {
    addJiraTicketWatcher.mockRejectedValue(
      new AppError({ status: 409, code: 'CONFLICT', message: '이미 watcher로 등록된 사용자입니다.', retriable: false }),
    );
    watcherModal(two());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'bae.jh 등록' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('이미 watcher로 등록된 사용자입니다.');
    expect(screen.getByRole('button', { name: 'bae.jh 등록' })).toBeDefined();
  });

  it('SDU 대상은 provider SDU 로, 계약 밖 클라우드는 막힌 버튼 + title', async () => {
    addJiraTicketWatcher.mockResolvedValue(undefined);
    const { unmount } = watcherModal(watcherRow(
      { failedWatchers: [watcher('bae.jh')], failedWatchersTotal: 1 },
      { serviceCode: 'SDU', cloudProvider: 'AWS', isSduType: true },
    ));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'bae.jh 등록' }));
    });
    expect(addJiraTicketWatcher).toHaveBeenCalledWith('SDU', 'SDU', 'bae.jh');
    unmount();

    watcherModal(watcherRow({ failedWatchers: [watcher('bae.jh')], failedWatchersTotal: 1 }, { cloudProvider: null }));
    const button = screen.getByRole('button', { name: 'bae.jh 등록' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('title')).toBe('등록할 수 없는 클라우드');
  });

  it('이 페이지 모두 등록: 아직 안 된 사람만 차례로, 실패해도 다음으로 간다', async () => {
    const order: string[] = [];
    addJiraTicketWatcher.mockImplementation(async (_code: string, _pv: string, userId: string) => {
      order.push(userId);
      if (userId === 'bae.jh') throw new AppError({ status: 500, code: 'INTERNAL_ERROR', message: 'jira down', retriable: false });
    });
    watcherModal(watcherRow({ failedWatchers: [watcher('ahn.sy'), watcher('bae.jh'), watcher('choi.mr')], failedWatchersTotal: 3 }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ahn.sy 등록' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '이 페이지 모두 등록' }));
    });
    expect(order).toEqual(['ahn.sy', 'bae.jh', 'choi.mr']);
    expect(screen.getAllByText('등록됨')).toHaveLength(2);
    expect(screen.getByRole('alert').textContent).toBe('jira down');
  });

  it('페이지를 넘기면 watcher_page 로 다시 읽고(5명씩) 등록 표시는 비운다', async () => {
    addJiraTicketWatcher.mockResolvedValue(undefined);
    getCollaborationChannel.mockResolvedValue(
      created('BDCDIP-1799', { failedWatchers: [watcher('lee.mj')], failedWatchersTotal: 12, watcherPage: 1, watcherSize: 5 }),
    );
    watcherModal(watcherRow({ failedWatchers: [watcher('ahn.sy')], failedWatchersTotal: 12, watcherSize: 5 }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ahn.sy 등록' }));
    });
    expect(screen.getByText('등록됨')).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    });
    expect(getCollaborationChannel).toHaveBeenCalledWith(1799, { watcherSize: 5, watcherPage: 1 });
    expect(screen.getByText('lee.mj')).toBeDefined();
    expect(screen.queryByText('등록됨')).toBeNull();
  });

  it('빈 목록과 조회 실패는 다른 문장을 받는다', () => {
    const { unmount } = watcherModal(watcherRow({ failedWatchers: [], failedWatchersTotal: 0 }));
    expect(screen.getByText('등록에 실패한 사용자가 없습니다.')).toBeDefined();
    unmount();
    watcherModal({ ...ROW, channel: null });
    expect(screen.getByText('추가할 사용자를 응답에서 읽지 못했어요.')).toBeDefined();
    expect(fact('상태')).toBe('조회 실패');
  });
});
