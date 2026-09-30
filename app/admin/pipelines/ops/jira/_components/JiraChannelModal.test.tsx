// @vitest-environment jsdom
/**
 * 협업 채널 모달 — 상태 보조 줄(한 줄 한 사실) · 다시 생성(접수 · 배너 넷) · watcher 표와
 * 등록 · 페이저.
 */
import { act, render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors';
import type { CollaborationChannel, FailedWatcher } from '@/lib/types/collaboration-channel';
import type { JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const refreshCounts = vi.hoisted(() => vi.fn());
const retryCollaborationChannel = vi.hoisted(() => vi.fn());
const getCollaborationChannel = vi.hoisted(() => vi.fn());
const addJiraTicketWatcher = vi.hoisted(() => vi.fn());
const toastShow = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }), usePathname: () => '/x' }));
vi.mock('@/app/admin/pipelines/_components/usePlToast', () => ({
  usePlToast: () => ({ message: null, show: toastShow, dismiss: vi.fn() }),
}));
vi.mock('@/app/admin/pipelines/_components/NavCountsRefresh', () => ({
  useNavCountsRefresh: () => refreshCounts,
}));
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
/** 사실 칸의 라벨 → 값. */
const fact = (label: string): string =>
  within(screen.getByTestId('facts')).getByText(label).nextElementSibling?.textContent ?? '';
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

describe('JiraChannelModal — 머리 · 대상 카드 · 사실 칸', () => {
  it('제목 22 + 한 줄 설명 + X 닫기; 카드는 Cloud 태그 · 설명 · Target 줄 · 상태 태그', () => {
    const onClose = vi.fn();
    ticketModal(ROW, onClose);
    expect(screen.getByRole('heading', { name: '티켓 다시 생성' })).toBeDefined();
    expect(screen.getByText(/14일 기한은 그대로예요/)).toBeDefined();
    // X (머리) 와 [닫기] (바닥) 둘 다 닫는다 — 앞의 것이 X 다
    fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]);
    expect(onClose).toHaveBeenCalled();

    const card = screen.getByTestId('target-card');
    expect(within(card).getByText('AWS')).toBeDefined();
    expect(within(card).getByText('결제 승인 원장 RDS')).toBeDefined();
    expect(within(card).getByText(/Target/).textContent).toBe('Target 2113 · PAY 결제서비스');
    expect(within(card).getByText('자동 생성 실패')).toBeDefined();
  });

  it('FAILED: 실패 횟수 · 다음 시도 — · 자동 재시도 종료; 상태 칸은 없다', () => {
    ticketModal();
    expect(fact('실패 횟수')).toBe('9회');
    expect(fact('다음 시도')).toBe('—');
    expect(fact('자동 재시도 종료')).toBe('09-28 00:00');
    expect(within(screen.getByTestId('facts')).queryByText('상태')).toBeNull();
    expect(screen.queryByText(/모두 실패/)).toBeNull();
  });

  it('RETRYING LONG_TERM(max null): 태그는 접미 없이, 횟수 · 다음 시도 · 종료 예정', () => {
    ticketModal({
      ...ROW,
      channel: channel({
        status: 'RETRYING', attemptCount: 6, maxAttempts: null, retryPhase: 'LONG_TERM',
        nextAttemptAt: '2026-10-01T00:50:00', retryExpiresAt: '2026-10-14T00:00:00',
      }),
    });
    expect(within(screen.getByTestId('target-card')).getByText('재시도 중')).toBeDefined();
    expect(fact('실패 횟수')).toBe('6회');
    expect(fact('다음 시도')).toBe('10-01 00:50');
    expect(fact('자동 재시도 종료 예정')).toBe('10-14 00:00');
  });

  it('RETRYING attempt 0: 실패 횟수 칸은 남고 값만 —', () => {
    ticketModal({
      ...ROW,
      channel: channel({ status: 'RETRYING', attemptCount: 0, maxAttempts: 6, nextAttemptAt: '2026-09-30T14:20:00', retryExpiresAt: null }),
    });
    expect(fact('실패 횟수')).toBe('—');
    expect(fact('다음 시도')).toBe('09-30 14:20');
    expect(fact('자동 재시도 종료 예정')).toBe('—');
  });
});

describe('JiraChannelModal — 티켓 다시 생성', () => {
  it('입력도 [티켓 연결] 도 없다 — 동작 띠에 주 버튼 하나', () => {
    ticketModal();
    expect(screen.queryByLabelText('Jira 이슈 키')).toBeNull();
    expect(screen.queryByRole('button', { name: '티켓 연결' })).toBeNull();
    const band = screen.getByTestId('action-band');
    expect(within(band).getByText('지금 한 번 더 생성을 요청합니다')).toBeDefined();
    expect(within(band).getByRole('button', { name: '티켓 다시 생성' })).toBeDefined();
  });

  it('접수: POST → refresh → 재조회 → 띠가 기다리는 상태(다시 조회 없음)', async () => {
    retryCollaborationChannel.mockResolvedValue(undefined);
    getCollaborationChannel.mockResolvedValue(
      channel({ status: 'RETRYING', manualRetryPending: true, manualRetryRequestedAt: '2026-09-30T15:02:00' }),
    );
    ticketModal({ ...ROW, channel: channel({ status: 'RETRYING', attemptCount: 2, maxAttempts: 6 }) });
    await clickRetry();
    expect(retryCollaborationChannel).toHaveBeenCalledWith(2113);
    expect(refresh).toHaveBeenCalled();
    expect(getCollaborationChannel).toHaveBeenCalledWith(2113, { watcherSize: 5 });
    const band = screen.getByTestId('action-band');
    expect(within(band).getByText('재시도를 접수했어요')).toBeDefined();
    expect(within(band).getByText('요청 09-30 15:02 · 결과를 확인하는 중입니다')).toBeDefined();
    expect(within(band).queryByRole('button')).toBeNull();
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
      [failure(503, 'JIRA_MANUAL_RETRY_DISABLED'), '서버의 자동 생성 기능이 꺼져 있습니다. 서비스 운영 화면에서 티켓을 직접 연결해 주세요.'],
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

  it('CREATED: 티켓 링크 · 실패 횟수 — · 다음 시도 —, 띠는 없다', () => {
    ticketModal({ ...ROW, channel: created('BDCDIP-77') });
    expect(within(screen.getByTestId('facts')).getByRole('link', { name: /BDCDIP-77/ }).getAttribute('href')).toBe(
      'https://jira.example.com/browse/BDCDIP-77',
    );
    expect(fact('실패 횟수')).toBe('—');
    expect(fact('다음 시도')).toBe('—');
    expect(screen.queryByTestId('action-band')).toBeNull();
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
      watcherSize: 5,
    });
  const watcherModal = (row: JiraWorklistRow) =>
    render(<JiraChannelModal kind="jira-watcher-failed" row={row} onClose={vi.fn()} />);

  it('머리 줄 「사용자 N명 · p / P 페이지」 + 모두 등록, 사실 칸(티켓 · 등록 실패 · 가장 빠른 다음 시도), 5행 상자, 페이저', () => {
    watcherModal(two());
    expect(screen.getByRole('heading', { name: 'Watcher 등록 실패' })).toBeDefined();
    expect(screen.getByText(/결과는 Jira 에서 확인됩니다/)).toBeDefined();
    const heading = screen.getByText(/페이지$/);
    expect(heading.textContent).toBe('사용자 12명 · 1 / 3 페이지');
    expect(heading.closest('div')?.parentElement?.querySelector('button')?.textContent).toBe('전체 등록');
    expect(within(screen.getByTestId('facts')).getByRole('link', { name: /BDCDIP-1799/ })).toBeDefined();
    expect(fact('등록 실패')).toBe('12명');
    expect(fact('가장 빠른 다음 시도')).toBe('09-30 14:40');
    expect(within(screen.getByTestId('target-card')).getByText('생성됨')).toBeDefined();
    expect(screen.getByText('bae.jh')).toBeDefined();
    expect(screen.getByText('등록 실패', { selector: 'td' })).toBeDefined();
    expect(screen.getByText('재시도 중')).toBeDefined();
    expect(screen.getByRole('button', { name: 'bae.jh 등록' })).toBeDefined();
    expect(screen.getByTestId('watcher-table-box').className).toContain('h-[212px]');
    expect(screen.queryByLabelText('Jira 이슈 키')).toBeNull();
    expect(screen.getByRole('navigation', { name: '페이지' })).toBeDefined();
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
    expect(screen.getByText('등록 실패', { selector: 'td' })).toBeDefined();
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

  it('전체 등록: 100명씩 끝까지 모아(120명 → 2쪽) 중복·이미 등록된 사람은 빼고 차례로, 실패해도 계속, 결과 toast + 보던 쪽 재조회', async () => {
    const chunk = (names: string[], page: number) =>
      created('BDCDIP-1799', { failedWatchers: names.map((n) => watcher(n)), failedWatchersTotal: 120, watcherPage: page, watcherSize: 100 });
    getCollaborationChannel.mockImplementation(async (_id: number, opts: { watcherPage?: number; watcherSize?: number }) => {
      if (opts.watcherSize === 100) return opts.watcherPage === 0 ? chunk(['ahn.sy', 'bae.jh', 'choi.mr'], 0) : chunk(['choi.mr', 'do.hk'], 1);
      // 보던 쪽(5명씩) 재조회
      return created('BDCDIP-1799', { failedWatchers: [watcher('ahn.sy'), watcher('bae.jh')], failedWatchersTotal: 120, watcherPage: 0, watcherSize: 5 });
    });
    const order: string[] = [];
    addJiraTicketWatcher.mockImplementation(async (_code: string, _pv: string, userId: string) => {
      order.push(userId);
      if (userId === 'bae.jh') throw new AppError({ status: 500, code: 'INTERNAL_ERROR', message: 'jira down', retriable: false });
    });
    watcherModal(watcherRow({ failedWatchers: [watcher('ahn.sy'), watcher('bae.jh')], failedWatchersTotal: 120, watcherSize: 5 }));
    // 한 명은 먼저 손으로 등록해 둔다 — 전체 등록은 이 사람을 건너뛴다.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ahn.sy 등록' }));
    });
    expect(order).toEqual(['ahn.sy']);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '전체 등록' }));
    });
    const gathers = getCollaborationChannel.mock.calls.filter((c) => c[1]?.watcherSize === 100);
    expect(gathers.map((c) => c[1].watcherPage)).toEqual([0, 1]);
    // 전원 한 번씩, 이미 된 ahn.sy 는 빼고, 실패한 bae.jh 뒤로도 계속
    expect(order).toEqual(['ahn.sy', 'bae.jh', 'choi.mr', 'do.hk']);
    expect(toastShow).toHaveBeenCalledWith('watcher 2명 등록, 1명 실패');
    expect(getCollaborationChannel).toHaveBeenLastCalledWith(1799, { watcherSize: 5, watcherPage: 0 });
    // 보이는 행은 결과를 입는다
    expect(screen.getByText('등록됨')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('jira down');
    expect(screen.getByRole('button', { name: 'bae.jh 등록' })).toBeDefined();
  });

  it('등록 표시는 창이 살아 있는 동안 남는다 — 페이지를 넘겼다 돌아와도 제 행에 선다', async () => {
    addJiraTicketWatcher.mockResolvedValue(undefined);
    getCollaborationChannel
      .mockResolvedValueOnce(created('BDCDIP-1799', { failedWatchers: [watcher('lee.mj')], failedWatchersTotal: 12, watcherPage: 1, watcherSize: 5 }))
      .mockResolvedValueOnce(created('BDCDIP-1799', { failedWatchers: [watcher('ahn.sy')], failedWatchersTotal: 12, watcherPage: 0, watcherSize: 5 }));
    watcherModal(watcherRow({ failedWatchers: [watcher('ahn.sy')], failedWatchersTotal: 12, watcherSize: 5 }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ahn.sy 등록' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    });
    expect(getCollaborationChannel).toHaveBeenCalledWith(1799, { watcherSize: 5, watcherPage: 1 });
    expect(screen.getByText('lee.mj')).toBeDefined();
    expect(screen.queryByText('등록됨')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }));
    });
    expect(screen.getByText('등록됨')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'ahn.sy 등록' })).toBeNull();
  });

  it('500명이 넘으면 전체 등록이 막히고 이유가 title 에 선다', () => {
    watcherModal(watcherRow({ failedWatchers: [watcher('ahn.sy')], failedWatchersTotal: 501, watcherSize: 5 }));
    const button = screen.getByRole('button', { name: '전체 등록' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('title')).toBe('500명까지 한 번에 등록할 수 있어요');
    fireEvent.click(button);
    expect(getCollaborationChannel).not.toHaveBeenCalled();
  });

  it('빈 목록과 조회 실패는 다른 문장을 받는다', () => {
    const { unmount } = watcherModal(watcherRow({ failedWatchers: [], failedWatchersTotal: 0 }));
    expect(screen.getByText('등록에 실패한 사용자가 없습니다.')).toBeDefined();
    unmount();
    watcherModal({ ...ROW, channel: null });
    expect(screen.getByText('추가할 사용자를 응답에서 읽지 못했어요.')).toBeDefined();
    expect(fact('티켓')).toBe('—');
    expect(within(screen.getByTestId('target-card')).getByText('조회 실패')).toBeDefined();
  });
});

describe('JiraChannelModal — 접수 뒤 폴링', () => {
  const pendingChannel = () =>
    channel({ status: 'RETRYING', attemptCount: 2, maxAttempts: 6, manualRetryPending: true, manualRetryRequestedAt: '2026-09-30T15:02:00' });
  const openPending = () => ticketModal({ ...ROW, channel: pendingChannel() });
  const tick = async (ms = 5000) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pending 으로 열리면 5초마다 읽고, CREATED 가 오면 띠가 사라지고 toast · refresh', async () => {
    getCollaborationChannel.mockResolvedValueOnce(pendingChannel()).mockResolvedValueOnce(created('BDCDIP-5001'));
    openPending();
    expect(within(screen.getByTestId('action-band')).queryByRole('button')).toBeNull();
    await tick();
    expect(getCollaborationChannel).toHaveBeenCalledTimes(1);
    expect(getCollaborationChannel).toHaveBeenCalledWith(2113, { watcherSize: 5 });
    // 아직 pending — 계속 기다린다
    expect(screen.getByTestId('action-band')).toBeDefined();
    await tick();
    expect(getCollaborationChannel).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('action-band')).toBeNull();
    expect(within(screen.getByTestId('target-card')).getByText('생성됨')).toBeDefined();
    expect(within(screen.getByTestId('facts')).getByRole('link', { name: /BDCDIP-5001/ })).toBeDefined();
    expect(toastShow).toHaveBeenCalledWith('티켓이 생성됐어요 · BDCDIP-5001');
    expect(refresh).toHaveBeenCalled();
    // 멈췄다 — 더 읽지 않는다
    await tick(20000);
    expect(getCollaborationChannel).toHaveBeenCalledTimes(2);
  });

  it('RETRYING 으로 돌아오면 띠는 기본 상태 + 경고 배너, 사실 칸은 새 값', async () => {
    getCollaborationChannel.mockResolvedValue(
      channel({ status: 'RETRYING', attemptCount: 7, maxAttempts: null, nextAttemptAt: '2026-10-02T00:50:00', manualRetryPending: false }),
    );
    openPending();
    await tick();
    const band = screen.getByTestId('action-band');
    expect((within(band).getByRole('button', { name: '티켓 다시 생성' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('이번 재시도도 실패했어요. 상태와 다음 시도 시각을 확인해 주세요.');
    expect(fact('실패 횟수')).toBe('7회');
    expect(fact('다음 시도')).toBe('10-02 00:50');
    expect(toastShow).not.toHaveBeenCalled();
  });

  it('2분이 지나도 pending 이면 멈추고 [다시 조회] 가 돌아온다; 손 조회 뒤에도 pending 이면 그대로', async () => {
    getCollaborationChannel.mockResolvedValue(pendingChannel());
    openPending();
    await tick(24 * 5000);
    expect(getCollaborationChannel).toHaveBeenCalledTimes(24);
    const band = screen.getByTestId('action-band');
    expect(within(band).getByText('아직 처리 중입니다')).toBeDefined();
    expect(within(band).getByText('요청 09-30 15:02 · 잠시 뒤 다시 조회해 주세요')).toBeDefined();
    await tick(20000);
    expect(getCollaborationChannel).toHaveBeenCalledTimes(24);
    await act(async () => {
      fireEvent.click(within(band).getByRole('button', { name: '다시 조회' }));
    });
    expect(getCollaborationChannel).toHaveBeenCalledTimes(25);
    expect(within(screen.getByTestId('action-band')).getByText('아직 처리 중입니다')).toBeDefined();
  });

  it('조회 실패 tick 은 넘기고, 세 번 연속이면 멈춰 [다시 조회] 상태', async () => {
    getCollaborationChannel.mockRejectedValue(new Error('down'));
    openPending();
    await tick();
    await tick();
    expect(within(screen.getByTestId('action-band')).getByText('재시도를 접수했어요')).toBeDefined();
    expect(screen.queryByText('조회 실패')).toBeNull();
    await tick();
    expect(within(screen.getByTestId('action-band')).getByRole('button', { name: '다시 조회' })).toBeDefined();
    await tick(20000);
    expect(getCollaborationChannel).toHaveBeenCalledTimes(3);
  });

  it('unmount 하면 interval 이 지워진다', async () => {
    getCollaborationChannel.mockResolvedValue(pendingChannel());
    const { unmount } = openPending();
    await tick();
    expect(getCollaborationChannel).toHaveBeenCalledTimes(1);
    unmount();
    await tick(30000);
    expect(getCollaborationChannel).toHaveBeenCalledTimes(1);
  });
});


describe('JiraChannelModal — retry and pagination regressions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('keeps retry disabled when POST is accepted but immediate channel GET fails', async () => {
    retryCollaborationChannel.mockResolvedValue(undefined);
    getCollaborationChannel.mockRejectedValue(new Error('temporary GET failure'));
    ticketModal();
    await clickRetry();
    expect(retryCollaborationChannel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '티켓 다시 생성' })).toBeNull();
    expect(screen.getByText('재시도를 접수했어요')).toBeDefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '티켓 다시 생성' })).toBeNull();
    expect(retryCollaborationChannel).toHaveBeenCalledTimes(1);
    getCollaborationChannel.mockResolvedValueOnce(created('BDCDIP-9999'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '다시 조회' })); });
    expect(screen.getByRole('link', { name: /BDCDIP-9999/ })).toBeDefined();
  });

  it('refreshes the list after a timed-out retry resolves on manual refetch', async () => {
    const pending = channel({ status: 'RETRYING', manualRetryPending: true });
    getCollaborationChannel.mockResolvedValue(pending);
    ticketModal({ ...ROW, channel: pending });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    refresh.mockClear();
    refreshCounts.mockClear();
    getCollaborationChannel.mockResolvedValueOnce(created('BDCDIP-9999'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
    });
    expect(screen.getByRole('link', { name: /BDCDIP-9999/ })).toBeDefined();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refreshCounts).toHaveBeenCalledTimes(1);
    expect(toastShow).toHaveBeenCalledWith('티켓이 생성됐어요 · BDCDIP-9999');
  });

  it('lets an operator retry a failed watcher page read without closing the modal', async () => {
    getCollaborationChannel.mockRejectedValue(new Error('temporary GET failure'));
    render(<JiraChannelModal kind="jira-watcher-failed" row={{ ...ROW,
      channel: created('BDCDIP-1', {
        failedWatchers: [watcher('first.user')], failedWatchersTotal: 12, watcherSize: 5,
      }),
    }} onClose={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    });
    expect(screen.getByRole('button', { name: '다시 조회' })).toBeDefined();
    getCollaborationChannel.mockResolvedValueOnce(created('BDCDIP-1', {
      failedWatchers: [watcher('recovered.user')], failedWatchersTotal: 12, watcherSize: 5,
    }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '다시 조회' })); });
    expect(screen.getByRole('button', { name: 'recovered.user 등록' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: '페이지' })).toBeDefined();
  });

  it('keeps the last selected watcher page when responses arrive in reverse order', async () => {
    let resolveSecond: (v: CollaborationChannel) => void = () => {};
    let resolveThird: (v: CollaborationChannel) => void = () => {};
    getCollaborationChannel.mockImplementation((_id: number, opts: { watcherPage?: number }) =>
      new Promise<CollaborationChannel>((resolve) => {
        if (opts.watcherPage === 1) resolveSecond = resolve;
        else resolveThird = resolve;
      }),
    );
    render(<JiraChannelModal kind="jira-watcher-failed" row={{ ...ROW,
      channel: created('BDCDIP-1', {
        failedWatchers: [watcher('first.user')], failedWatchersTotal: 12, watcherSize: 5,
      }),
    }} onClose={vi.fn()} />);
    const pager = screen.getByRole('navigation', { name: '페이지' });
    await act(async () => { fireEvent.click(within(pager).getByRole('button', { name: '2' })); });
    await act(async () => { fireEvent.click(within(pager).getByRole('button', { name: '3' })); });
    await act(async () => { resolveThird(created('BDCDIP-1', {
      failedWatchers: [watcher('third.user')], failedWatchersTotal: 12, watcherPage: 2, watcherSize: 5,
    })); });
    expect(screen.getByText('third.user')).toBeDefined();
    await act(async () => { resolveSecond(created('BDCDIP-1', {
      failedWatchers: [watcher('second.user')], failedWatchersTotal: 12, watcherPage: 1, watcherSize: 5,
    })); });
    expect(screen.getByText('third.user')).toBeDefined();
  });
});


describe('JiraChannelModal — stale page failures', () => {
  it('ignores an older failed read and stays busy until the latest read settles', async () => {
    let rejectOlder: (err: Error) => void = () => {};
    let resolveLatest: (value: CollaborationChannel) => void = () => {};
    getCollaborationChannel.mockImplementation((_id: number, opts: { watcherPage?: number }) =>
      new Promise<CollaborationChannel>((resolve, reject) => {
        if (opts.watcherPage === 1) rejectOlder = reject;
        else resolveLatest = resolve;
      }),
    );
    render(<JiraChannelModal kind="jira-watcher-failed" row={{ ...ROW,
      channel: created('BDCDIP-1', {
        failedWatchers: [watcher('first.user')], failedWatchersTotal: 12, watcherSize: 5,
      }),
    }} onClose={vi.fn()} />);
    const pager = screen.getByRole('navigation', { name: '페이지' });
    await act(async () => { fireEvent.click(within(pager).getByRole('button', { name: '2' })); });
    await act(async () => { fireEvent.click(within(pager).getByRole('button', { name: '3' })); });
    await act(async () => { rejectOlder(new Error('older request failed')); });
    expect(screen.getByText('first.user')).toBeDefined();
    expect((screen.getByRole('button', { name: 'first.user 등록' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolveLatest(created('BDCDIP-1', {
      failedWatchers: [watcher('third.user')], failedWatchersTotal: 12, watcherPage: 2, watcherSize: 5,
    })); });
    expect((screen.getByRole('button', { name: 'third.user 등록' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('can recover an initially unreadable watcher channel', async () => {
    getCollaborationChannel.mockResolvedValueOnce(created('BDCDIP-1', {
      failedWatchers: [watcher('recovered.user')], failedWatchersTotal: 1, watcherSize: 5,
    }));
    render(<JiraChannelModal kind="jira-watcher-failed" row={{ ...ROW, channel: null }} onClose={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '다시 조회' })); });
    expect(getCollaborationChannel).toHaveBeenCalledWith(2113, { watcherSize: 5, watcherPage: 0 });
    expect(screen.getByRole('button', { name: 'recovered.user 등록' })).toBeDefined();
  });
});
