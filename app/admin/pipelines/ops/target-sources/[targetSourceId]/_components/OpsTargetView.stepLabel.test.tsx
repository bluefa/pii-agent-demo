// @vitest-environment jsdom
/**
 * The 「현재 단계」 tag in the tab strip — one visible label on the tab the current
 * ProcessStatus is worked in (owner 2026-09-11). It replaced the corner dot and the
 * 연결 테스트 dot, so what is measured here is which tab carries it, and that no
 * other tab does: a label on two tabs says the work sits in two places.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';
import { STEP } from '@/app/admin/pipelines/queue/_components/StepStack';

const STEP_LABEL = '현재 단계';

const getRawTargetSourceDetail = vi.fn();
vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (...args: unknown[]) => getRawTargetSourceDetail(...args),
}));

const getProcessStatus = vi.fn();
vi.mock('@/app/lib/api', () => ({ getProcessStatus: () => getProcessStatus() }));

// Side loads the tab shell fires once mounted — not this test's concern.
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: vi.fn(async () => ({ content: [], totalPages: 1 })),
  startScan: vi.fn(async () => null),
}));
vi.mock('@/app/hooks/useTestConnectionPolling', () => ({ fetchLatestTest: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/aws', () => ({ getAwsRoleVerification: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/ops', () => ({
  getCollaborationChannel: vi.fn(async () => null),
  getTargetJiraTicket: vi.fn(async () => null),
  getDagStatus: vi.fn(() => Promise.reject(new Error('no dag-status fixture'))),
}));
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: vi.fn(async () => null),
  getTestConnectionResults: vi.fn(async () => []),
}));

const detail = (over: Record<string, unknown> = {}) => ({
  target_source_id: 1010,
  service_name: 'AWS',
  service_code: 'AWS',
  cloud_provider: 'AWS',
  metadata: { is_sdu_type: false },
  ...over,
});

const renderView = () =>
  render(<OpsTargetView targetSourceId={1010} initialTab="진행 상태" statusSlot={<div />} />);

/** Tabs whose content carries the label — the whole list, so a second carrier fails. */
const labelledTabs = (): string[] =>
  screen
    .getAllByRole('tab')
    .filter((el) => (el.textContent ?? '').includes(STEP_LABEL))
    .map((el) => (el.textContent ?? '').replace(STEP_LABEL, '').trim());

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1010');
});

describe('OpsTargetView — 「현재 단계」 탭 태그', () => {
  it.each([
    ['IDLE', '스캔'],
    ['PENDING', '연동 요청 정보'],
    ['CONFIRMING', '확정 정보'],
    ['CONFIRMED', '인프라 작업'],
    ['INSTALLED', '연결 테스트'],
    ['CONNECTED', '관리자 승인'],
  ])('COMPLETED → 「%s」 탭 하나에만 선다', async (status, tab) => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    getProcessStatus.mockResolvedValue({ process_status: status });
    renderView();

    await waitFor(() => expect(labelledTabs()).toEqual([tab]));
    // The visible word is the accessible name — no `.sr-only` twin, no `title`.
    const labelled = screen.getByRole('tab', { name: `${tab} ${STEP_LABEL}` });
    expect(labelled.getAttribute('title')).toBeNull();
    expect(labelled.querySelector('.sr-only')).toBeNull();
  });

  it('COMPLETED 는 어느 탭에도 서지 않는다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    getProcessStatus.mockResolvedValue({ process_status: 'COMPLETED' });
    renderView();

    // Absence only means something once the step has landed — the masthead pill says it has.
    await screen.findAllByText(STEP.COMPLETED.label);
    expect(labelledTabs()).toEqual([]);
  });

  it('IDC 의 IDLE 은 스캔 탭이 없으므로 다른 탭으로 옮겨 걸지 않는다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail({ cloud_provider: 'IDC' }));
    getProcessStatus.mockResolvedValue({ process_status: 'IDLE' });
    renderView();

    // Same wait: the masthead pill proves IDLE landed before absence is asserted.
    await screen.findAllByText(STEP.IDLE.label);
    expect(labelledTabs()).toEqual([]);
  });

  it('탭 줄에 상태 점이 남아 있지 않다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    getProcessStatus.mockResolvedValue({ process_status: 'INSTALLED' });
    renderView();

    await waitFor(() => expect(labelledTabs()).toEqual(['연결 테스트']));
    // The dots were the only aria-hidden children of a tab button.
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.querySelector('[aria-hidden]')).toBeNull();
    }
  });
});
