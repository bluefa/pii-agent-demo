// @vitest-environment jsdom
/**
 * 협업 채널 모달 — 상태 보조 줄(한 줄 한 사실) · 다시 생성(접수 · 배너 넷) · watcher 표와
 * 등록 · 페이저.
 */
import { act, render, screen } from '@testing-library/react';
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
  watcherSize: 10,
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

const retryButton = () => screen.getByRole('button', { name: '티켓 다시 생성' });
const clickRetry = async () => {
  await act(async () => {
    fireEvent.click(retryButton());
  });
};

const ticketModal = (row: JiraWorklistRow = ROW, onClose = vi.fn()) =>
  render(<JiraChannelModal kind="jira-ticket-failed" row={row} onClose={onClose} />);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('JiraChannelModal — 상태 보조 줄', () => {
  it('FAILED: 만료 시각 한 줄, 「N회 모두 실패」 는 없다', () => {
    ticketModal();
    expect(screen.getByText('자동 생성 실패')).toBeDefined();
    expect(screen.getByText('자동 재시도 종료 09-28 00:00')).toBeDefined();
    expect(screen.queryByText(/모두 실패/)).toBeNull();
  });

  it('RETRYING LONG_TERM(max null): 태그는 접미 없이, 실패 횟수 · 다음 시도 · 종료 예정 순', () => {
    ticketModal({
      ...ROW,
      channel: channel({
        status: 'RETRYING', attemptCount: 6, maxAttempts: null, retryPhase: 'LONG_TERM',
        nextAttemptAt: '2026-10-01T00:50:00', retryExpiresAt: '2026-10-14T00:00:00',
      }),
    });
    expect(screen.getByText('재시도 중')).toBeDefined();
    const status = screen.getByText('재시도 중').parentElement as HTMLElement;
    const lines = Array.from(status.querySelectorAll('span.tabular-nums')).map((el) => el.textContent);
    expect(lines).toEqual(['실패 6회', '다음 시도 10-01 00:50', '자동 재시도 종료 예정 10-14 00:00']);
  });

  it('RETRYING attempt 0: 실패 횟수 줄이 빠진다', () => {
    ticketModal({
      ...ROW,
      channel: channel({ status: 'RETRYING', attemptCount: 0, maxAttempts: 6, nextAttemptAt: '2026-09-30T14:20:00', retryExpiresAt: null }),
    });
    expect(screen.queryByText(/실패 \d+회/)).toBeNull();
    expect(screen.getByText('다음 시도 09-30 14:20')).toBeDefined();
  });
});

describe('JiraChannelModal — 티켓 다시 생성', () => {
  it('입력도 [티켓 연결] 도 없다 — 동작은 다시 생성 하나', () => {
    ticketModal();
    expect(screen.getByRole('heading', { name: '티켓 다시 생성' })).toBeDefined();
    expect(screen.queryByLabelText('Jira 이슈 키')).toBeNull();
    expect(screen.queryByRole('button', { name: '티켓 연결' })).toBeNull();
    expect(retryButton()).toBeDefined();
  });

  it('접수: POST → toast·refresh → 재조회 → 접수 배너 + 잠긴 버튼; [다시 조회] 는 watcherSize 5 로 읽는다', async () => {
    retryCollaborationChannel.mockResolvedValue(undefined);
    getCollaborationChannel
      .mockResolvedValueOnce(channel({ status: 'RETRYING', manualRetryPending: true, manualRetryRequestedAt: '2026-09-30T15:02:00' }))
      .mockResolvedValueOnce(created('BDCDIP-5001'));
    ticketModal({ ...ROW, channel: channel({ status: 'RETRYING', attemptCount: 2, maxAttempts: 6 }) });
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
    ticketModal({ ...ROW, channel: channel({ status: 'RETRYING', manualRetryPending: true, manualRetryRequestedAt: '2026-09-30T15:02:00' }) });
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

  it('CREATED: 티켓 링크가 서고 버튼은 없다', () => {
    ticketModal({ ...ROW, channel: created('BDCDIP-77') });
    expect(screen.getByRole('link', { name: /BDCDIP-77/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: '티켓 다시 생성' })).toBeNull();
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
      failedWatchersTotal: 2,
    });
  const watcherModal = (row: JiraWorklistRow) =>
    render(<JiraChannelModal kind="jira-watcher-failed" row={row} onClose={vi.fn()} />);

  it('사용자 표(FAILED/PENDING 문구 · 다음 시도 · 등록 버튼)를 그리고 입력은 없다; 한 페이지면 페이저도 없다', () => {
    watcherModal(two());
    expect(screen.getByText('bae.jh')).toBeDefined();
    expect(screen.getByText('등록 실패')).toBeDefined();
    expect(screen.getByText('재시도 중')).toBeDefined();
    expect(screen.getByText('09-30 14:40')).toBeDefined();
    expect(screen.getByRole('button', { name: 'bae.jh 등록' })).toBeDefined();
    expect(screen.getByRole('button', { name: '이 페이지 모두 등록' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '복사' })).toBeNull();
    expect(screen.queryByLabelText('Jira 이슈 키')).toBeNull();
    expect(screen.queryByRole('button', { name: '티켓 연결' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: '페이지' })).toBeNull();
    expect(screen.getByRole('link', { name: /BDCDIP-1799/ })).toBeDefined();
    expect(screen.getByText(/등록 결과는 Jira 에서 확인됩니다/)).toBeDefined();
  });

  it('등록: 서비스 코드 · 대문자 provider · username 으로 POST 하고 행이 등록됨이 된다 (재조회 없음)', async () => {
    addJiraTicketWatcher.mockResolvedValue(undefined);
    watcherModal(two());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'bae.jh 등록' }));
    });
    expect(addJiraTicketWatcher).toHaveBeenCalledWith('DLV', 'AZURE', 'bae.jh');
    expect(screen.getByText('등록됨')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'bae.jh 등록' })).toBeNull();
    expect(screen.getByRole('button', { name: 'kim.cs 등록' })).toBeDefined();
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
    expect(screen.getByText('등록 실패')).toBeDefined();
    expect(screen.getByRole('button', { name: 'bae.jh 등록' })).toBeDefined();
  });

  it('SDU 대상은 provider SDU 로 보낸다', async () => {
    addJiraTicketWatcher.mockResolvedValue(undefined);
    watcherModal(watcherRow(
      { failedWatchers: [watcher('bae.jh')], failedWatchersTotal: 1 },
      { serviceCode: 'SDU', cloudProvider: 'AWS', isSduType: true },
    ));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'bae.jh 등록' }));
    });
    expect(addJiraTicketWatcher).toHaveBeenCalledWith('SDU', 'SDU', 'bae.jh');
  });

  it('계약 밖 클라우드는 버튼이 막히고 이유가 title 에 선다', () => {
    watcherModal(watcherRow({ failedWatchers: [watcher('bae.jh')], failedWatchersTotal: 1 }, { cloudProvider: null }));
    const button = screen.getByRole('button', { name: 'bae.jh 등록' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('title')).toBe('등록할 수 없는 클라우드');
    fireEvent.click(button);
    expect(addJiraTicketWatcher).not.toHaveBeenCalled();
  });

  it('이 페이지 모두 등록: 아직 안 된 사람만 차례로, 실패해도 다음으로 간다', async () => {
    const order: string[] = [];
    addJiraTicketWatcher.mockImplementation(async (_code: string, _pv: string, userId: string) => {
      order.push(userId);
      if (userId === 'bae.jh') throw new AppError({ status: 500, code: 'INTERNAL_ERROR', message: 'jira down', retriable: false });
    });
    watcherModal(watcherRow({
      failedWatchers: [watcher('ahn.sy'), watcher('bae.jh'), watcher('choi.mr')],
      failedWatchersTotal: 3,
    }));
    // 한 명은 먼저 손으로 등록해 둔다 — 모두 등록은 이 사람을 건너뛴다.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ahn.sy 등록' }));
    });
    expect(order).toEqual(['ahn.sy']);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '이 페이지 모두 등록' }));
    });
    expect(order).toEqual(['ahn.sy', 'bae.jh', 'choi.mr']);
    expect(screen.getAllByText('등록됨')).toHaveLength(2);
    expect(screen.getByRole('alert').textContent).toBe('jira down');
    expect(screen.getByRole('button', { name: 'bae.jh 등록' })).toBeDefined();
  });

  it('표 영역은 10행 높이로 고정이고, 100명이면 페이저가 10쪽이다', async () => {
    const names = Array.from({ length: 10 }, (_, i) => watcher(`user.${String(i).padStart(2, '0')}`));
    const lastPage = created('BDCDIP-1799', {
      failedWatchers: [watcher('zed.a'), watcher('zed.b')], failedWatchersTotal: 100, watcherPage: 9, watcherSize: 10,
    });
    getCollaborationChannel.mockResolvedValue(lastPage);
    watcherModal(watcherRow({ failedWatchers: names, failedWatchersTotal: 100, watcherSize: 10 }));
    const box = screen.getByTestId('watcher-table-box');
    expect(box.className).toContain('h-[212px]');
    expect(screen.getAllByRole('button', { name: /^user\.\d\d 등록$/ })).toHaveLength(10);
    expect(screen.getByRole('navigation', { name: '페이지' })).toBeDefined();
    // 창은 5쪽씩 — 첫 창은 1..5, 마지막 쪽(10)은 넘겨서 확인한다
    expect(screen.getByRole('button', { name: '5' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '10' })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '5' }));
    });
    expect(getCollaborationChannel).toHaveBeenCalledWith(1799, { watcherSize: 5, watcherPage: 4 });
    // 서버가 9쪽(마지막)을 돌려주면 10 이 현재 쪽이고, 2행짜리 상자 높이는 그대로다
    expect(screen.getByRole('button', { name: '10' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getAllByRole('button', { name: /^zed\.[ab] 등록$/ })).toHaveLength(2);
    expect(screen.getByTestId('watcher-table-box').className).toContain('h-[212px]');
  });

  it('페이지를 넘기면 watcher_page 로 다시 읽고 등록 표시는 비운다', async () => {
    addJiraTicketWatcher.mockResolvedValue(undefined);
    getCollaborationChannel.mockResolvedValue(
      created('BDCDIP-1799', { failedWatchers: [watcher('lee.mj')], failedWatchersTotal: 12, watcherPage: 1, watcherSize: 10 }),
    );
    watcherModal(watcherRow({ failedWatchers: [watcher('ahn.sy')], failedWatchersTotal: 12, watcherSize: 10 }));
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
  });
});
