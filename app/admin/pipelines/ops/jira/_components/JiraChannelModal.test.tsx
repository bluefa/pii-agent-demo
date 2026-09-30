// @vitest-environment jsdom
/**
 * 협업 채널 모달 — 빈 키 차단 · PUT 은 다듬은 키로 · 진행 중 409 배너 · watcher 표.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors';
import type { JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const putCollaborationChannel = vi.hoisted(() => vi.fn());
const getCollaborationChannel = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }), usePathname: () => '/x' }));
vi.mock('@/app/lib/api/ops', () => ({ putCollaborationChannel, getCollaborationChannel }));

import { JiraChannelModal } from '@/app/admin/pipelines/ops/jira/_components/JiraChannelModal';

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
  failedWatchers: null,
  channel: {
    issueKey: null,
    url: null,
    status: 'FAILED',
    attemptCount: 6,
    maxAttempts: 6,
    nextAttemptAt: null,
  },
};

const conflict = (rawCode: string) =>
  new AppError({ status: 409, code: 'CONFLICT', message: 'conflict', retriable: false, rawCode });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('JiraChannelModal — 티켓 버킷', () => {
  it('상태 줄은 표와 같은 태그 + 실패 횟수, 본문은 서비스·클라우드 단위를 말한다', () => {
    render(<JiraChannelModal kind="jira-ticket-failed" row={ROW} onClose={vi.fn()} />);
    expect(screen.getByText('자동 생성 실패')).toBeDefined();
    expect(screen.getByText('6회 모두 실패')).toBeDefined();
    expect(screen.getByText('PAY')).toBeDefined();
    expect(screen.getByText('AWS', { selector: 'span.font-semibold' })).toBeDefined();
  });

  it('빈 키는 보내지 않는다', () => {
    render(<JiraChannelModal kind="jira-ticket-failed" row={ROW} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '티켓 연결' }));
    expect(screen.getByRole('alert').textContent).toBe('이슈 키를 입력해 주세요.');
    expect(putCollaborationChannel).not.toHaveBeenCalled();
  });

  it('성공: 다듬은 키로 PUT 하고 닫고 새로고침한다', async () => {
    putCollaborationChannel.mockResolvedValue({ status: 'CREATED', issueKey: 'BDCDIP-1234' });
    const onClose = vi.fn();
    render(<JiraChannelModal kind="jira-ticket-failed" row={ROW} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Jira 이슈 키'), { target: { value: '  BDCDIP-1234 ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '티켓 연결' }));
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(putCollaborationChannel).toHaveBeenCalledWith(2113, 'BDCDIP-1234');
    expect(refresh).toHaveBeenCalled();
  });

  it('JIRA_TICKET_CREATION_IN_PROGRESS 는 진행 중 배너 + 다시 조회', async () => {
    putCollaborationChannel.mockRejectedValue(conflict('JIRA_TICKET_CREATION_IN_PROGRESS'));
    getCollaborationChannel.mockResolvedValue({
      issueKey: 'BDCDIP-777', url: 'https://jira.example.com/browse/BDCDIP-777',
      status: 'CREATED', attemptCount: null, maxAttempts: null, nextAttemptAt: null,
    });
    render(<JiraChannelModal kind="jira-ticket-failed" row={ROW} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Jira 이슈 키'), { target: { value: 'BDCDIP-409' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '티켓 연결' }));
    });
    expect(screen.getByRole('status').textContent).toContain('자동 생성이 진행 중입니다');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
    });
    expect(getCollaborationChannel).toHaveBeenCalledWith(2113);
    // CREATED 로 돌아오면 입력은 사라지고 키가 링크로 선다.
    expect(screen.queryByLabelText('Jira 이슈 키')).toBeNull();
    expect(screen.getByRole('link', { name: /BDCDIP-777/ }).getAttribute('href')).toBe(
      'https://jira.example.com/browse/BDCDIP-777',
    );
  });

  it('그 밖의 409 는 다른 경로가 먼저 연결한 것 — 현재 값을 다시 읽는다', async () => {
    putCollaborationChannel.mockRejectedValue(conflict('CONFLICT'));
    getCollaborationChannel.mockResolvedValue({
      issueKey: 'BDCDIP-1', url: null, status: 'CREATED', attemptCount: null, maxAttempts: null, nextAttemptAt: null,
    });
    render(<JiraChannelModal kind="jira-ticket-failed" row={ROW} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Jira 이슈 키'), { target: { value: 'BDCDIP-2' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '티켓 연결' }));
    });
    expect(screen.getByRole('status').textContent).toContain('먼저 연결됐습니다');
    expect(screen.getByText('생성됨')).toBeDefined();
  });
});

describe('JiraChannelModal — watcher 버킷', () => {
  it('사용자 표를 그리고 입력은 없다', () => {
    render(
      <JiraChannelModal
        kind="jira-watcher-failed"
        row={{
          ...ROW,
          targetSourceId: 1861,
          channel: {
            issueKey: 'BDCDIP-2211', url: 'https://jira.example.com/browse/BDCDIP-2211',
            status: 'CREATED', attemptCount: null, maxAttempts: null, nextAttemptAt: null,
          },
          failedWatchers: [
            { username: 'hong.gildong', status: 'FAILED', attemptCount: 6 },
            { username: 'kim.cs', status: 'RETRYING', attemptCount: 3 },
          ],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('hong.gildong')).toBeDefined();
    expect(screen.getByText('등록 실패')).toBeDefined();
    expect(screen.getByText('재시도 중')).toBeDefined();
    expect(screen.getAllByRole('button', { name: '복사' })).toHaveLength(2);
    expect(screen.queryByLabelText('Jira 이슈 키')).toBeNull();
    expect(screen.queryByRole('button', { name: '티켓 연결' })).toBeNull();
    expect(screen.getByRole('link', { name: /BDCDIP-2211/ })).toBeDefined();
  });

  it('failed_watchers 가 없으면 한 줄로 말한다', () => {
    render(<JiraChannelModal kind="jira-watcher-failed" row={ROW} onClose={vi.fn()} />);
    expect(screen.getByText('추가할 사용자를 응답에서 읽지 못했어요.')).toBeDefined();
  });
});
