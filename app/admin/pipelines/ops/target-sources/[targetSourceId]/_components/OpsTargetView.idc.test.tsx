// @vitest-environment jsdom
/**
 * IDC drops the 스캔 tab — OpsTargetView shrinks the tab list per target kind.
 *
 * A test on ScanTab itself cannot catch this: the tab component is perfectly fine
 * while still being reachable. What is measured here is which target loses the tab,
 * and whether a link pointing at the dropped tab leaves screen and URL saying the
 * same thing. Deleting the filter outright keeps every existing test green — the
 * SDU sibling file makes the same argument for its own gate.
 *
 * The provider is read normalized: the contract types cloud_provider as a plain
 * string, so casing is not guaranteed. Reverting to a raw compare breaks the
 * lowercase case below.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

const getRawTargetSourceDetail = vi.fn();

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (...args: unknown[]) => getRawTargetSourceDetail(...args),
}));

// The scan tab's own data flow — kept as a spy, not a stub, because "never mounted"
// is asserted through it below.
const getScanHistory = vi.fn(async () => ({ content: [], totalPages: 1 }));
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: () => getScanHistory(),
  startScan: vi.fn(async () => null),
}));

// Side loads the tab shell fires once mounted — not this test's concern.
vi.mock('@/app/lib/api', () => ({ getProcessStatus: vi.fn(async () => null) }));
vi.mock('@/app/hooks/useTestConnectionPolling', () => ({ fetchLatestTest: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/aws', () => ({ getAwsRoleVerification: vi.fn(async () => null) }));
// `getTargetJiraTicket` landed in #677 while this file landed in #676. Git merged both without
// conflict and left the mock one export short, so the view's own fetch threw on every run here.
vi.mock('@/app/lib/api/ops', () => ({
  getCollaborationChannel: vi.fn(async () => null),
  getTargetJiraTicket: vi.fn(async () => null),
  // 헤더의 연동 완료 도장 — 이 파일의 관심사가 아니라 완료 아님으로 못 박는다.
  NOT_COMPLETED: { completed: false, completedAt: null },
  getIntegrationCompletion: vi.fn(async () => ({ completed: false, completedAt: null })),
}));
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: vi.fn(async () => null),
  getTestConnectionResults: vi.fn(async () => []),
}));

const detail = (over: Record<string, unknown> = {}) => ({
  target_source_id: 1583,
  service_name: '재고 실시간 동기화 관리',
  service_code: 'IVT',
  cloud_provider: 'IDC',
  metadata: { is_sdu_type: false },
  ...over,
});

/** What the strip actually drew — the list itself is the assertion target. */
const tabNames = async (): Promise<Array<string | null>> => {
  await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));
  return screen.getAllByRole('tab').map((el) => el.textContent);
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1583');
});

describe('OpsTargetView — IDC 스캔 탭', () => {
  it('IDC 대상에는 스캔 탭이 없다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1583} initialTab="진행 상태" />);
    // The whole list, not just the absence: only 스캔 leaves, and the other six keep
    // their order. Asserting absence alone lets a broadened filter pass.
    expect(await tabNames()).toEqual([
      '진행 상태',
      '연동 요청 정보',
      '확정 정보',
      '인프라 작업',
      'Test Connection',
      '관리자 승인',
    ]);
  });

  it('IDC 가 아니면 스캔 탭은 그대로 있다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ target_source_id: 1010, cloud_provider: 'AWS' }),
    );
    render(<OpsTargetView targetSourceId={1010} initialTab="진행 상태" />);
    expect(await tabNames()).toContain('스캔');
  });

  it('cloud_provider 대소문자가 달라도 걸러진다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail({ cloud_provider: 'idc' }));
    render(<OpsTargetView targetSourceId={1583} initialTab="진행 상태" />);
    expect(await tabNames()).not.toContain('스캔');
  });

  it('?tab=scan 으로 들어오면 진행 상태로 떨어지고 URL 도 따라 정리된다', async () => {
    window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1583?tab=scan');
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1583} initialTab="스캔" />);

    const status = await screen.findByRole('tab', { name: '진행 상태' });
    await waitFor(() => expect(status.getAttribute('aria-selected')).toBe('true'));
    // Fixing the screen but leaving the URL keeps reload and re-share pointing at a
    // tab that is not there.
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('?tab=scan 딥링크여도 스캔 탭은 한 번도 마운트되지 않는다', async () => {
    // The panel guard is separate from the strip: were it still keyed on the URL's
    // tab, the strip would hide 스캔 while ScanTab mounted underneath and queried a
    // target that has no scan concept. Only a request assertion catches that.
    window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1583?tab=scan');
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1583} initialTab="스캔" />);

    await screen.findByRole('tab', { name: '진행 상태' });
    await waitFor(() => expect(getRawTargetSourceDetail).toHaveBeenCalled());
    expect(getScanHistory).not.toHaveBeenCalled();
  });
});
