// @vitest-environment jsdom
/**
 * 헤더 「관련 페이지」의 Jira 티켓 — 열 주소가 없어도 티켓 번호는 화면에 남는다.
 *
 * `docs/api/jira-tickets.md` 가 정한 규칙이고 (`browseUrl` 이 없거나 http(s) 가 아니면
 * 링크가 아니라 글자), 서비스 운영·설치 가이드 두 화면이 이미 지킨다. 이 화면은 티켓을
 * 그리는 자리가 헤더 한 곳뿐이라, 그 분기가 죽으면 티켓 번호가 어디에도 안 남는다.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

const getRawTargetSourceDetail = vi.fn();
const getTargetJiraTicket = vi.fn();

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (...args: unknown[]) => getRawTargetSourceDetail(...args),
}));
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: vi.fn(async () => ({ content: [], totalPages: 1 })),
  startScan: vi.fn(async () => null),
}));
vi.mock('@/app/lib/api', () => ({
  getProcessStatus: vi.fn(async () => null),
  updateTargetSourceDescription: vi.fn(async () => undefined),
}));
vi.mock('@/app/hooks/useTestConnectionPolling', () => ({ fetchLatestTest: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/aws', () => ({ getAwsRoleVerification: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/ops', () => ({
  getCollaborationChannel: vi.fn(async () => null),
  getTargetJiraTicket: (...args: unknown[]) => getTargetJiraTicket(...args),
  updateTargetSourceDoesSupportRaw: vi.fn(async () => undefined),
  getDagStatus: vi.fn(() => Promise.reject(new Error('no dag-status fixture'))),
}));
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: vi.fn(async () => null),
  getTestConnectionResults: vi.fn(async () => []),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1018');
  getRawTargetSourceDetail.mockResolvedValue({
    target_source_id: 1018,
    service_name: 'AWS',
    service_code: 'aws',
    cloud_provider: 'AWS',
    metadata: { is_sdu_type: false },
  });
});

describe('OpsTargetView — 관련 페이지의 Jira 티켓', () => {
  it('열 주소가 있으면 링크로 선다', async () => {
    getTargetJiraTicket.mockResolvedValue({
      issueKey: 'BDCDIP-1353',
      browseUrl: 'https://jira.example.com/browse/BDCDIP-1353',
    });
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    // 링크 이름이 곧 티켓 번호다 — 「Jira Ticket」 이라는 낱말은 마크가 대신한다.
    const link = await screen.findByRole('link', { name: /BDCDIP-1353/ });
    expect(link.getAttribute('href')).toBe('https://jira.example.com/browse/BDCDIP-1353');
  });

  it('열 주소가 없으면 링크 대신 티켓 번호가 남는다', async () => {
    getTargetJiraTicket.mockResolvedValue({ issueKey: 'BDCDIP-1353', browseUrl: null });
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    expect(await screen.findByText('BDCDIP-1353')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /BDCDIP/ })).toBeNull();
  });

  it('http(s) 가 아닌 주소도 링크가 아니다 — 스킴 가드', async () => {
    getTargetJiraTicket.mockResolvedValue({ issueKey: 'BDCDIP-9', browseUrl: '/browse/BDCDIP-9' });
    render(<OpsTargetView targetSourceId={1018} initialTab="진행 상태" />);
    expect(await screen.findByText('BDCDIP-9')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /BDCDIP/ })).toBeNull();
  });
});
