// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getApprovalRequestDetail = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getApprovalRequestDetail: (...args: unknown[]) => getApprovalRequestDetail(...args),
}));

import { ApprovalRequestDetailModal } from '@/app/components/features/process-status/ApprovalRequestDetailModal';

const resource = (index: number, selected: boolean) => ({
  resource_id: `res-${index}`,
  resource_name: `resource-${index}`,
  resource_type: 'AZURE_MYSQL',
  selected,
  integration_category: 'TARGET',
  ...(selected ? {} : { exclusion_reason: '스테이징 전용' }),
  metadata: { database_type: 'MYSQL', region: 'ap-northeast-2' },
});

const item = {
  request: {
    id: 7,
    requested_by: 'ops',
    requested_at: '2026-07-31T05:00:00Z',
    resource_total_count: 23,
    resource_selected_count: 20,
  },
  result: {
    result: 'REJECTED',
    processed_at: '2026-07-31T09:00:00Z',
    process_info: { user_id: 'admin', reason: '스테이징 인스턴스가 섞여 있습니다.' },
  },
};

const open = () =>
  render(
    <ApprovalRequestDetailModal isOpen onClose={() => {}} item={item} targetSourceId={2002} />,
  );

describe('ApprovalRequestDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApprovalRequestDetail.mockResolvedValue({
      resources: Array.from({ length: 23 }, (_, i) => resource(i, i % 5 !== 0)),
    });
  });

  /** The list is one filterable table, not two stacked ones — the tiles ARE the split. */
  it('surfaces the request size as filter tiles over a single table', async () => {
    open();

    expect(await screen.findByRole('button', { name: /전체 요청/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /연동 요청 대상/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /연동 요청 제외대상/ })).toBeTruthy();
    // 23 rows, 5 excluded (every 5th) → 18 targets.
    expect(screen.getByRole('button', { name: /전체 요청 23/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /연동 요청 제외대상 5/ })).toBeTruthy();
  });

  it('filters the table when a tile is picked', async () => {
    open();

    // Page 1 of 10 under the default filter starts at resource-0 (an excluded row).
    expect(await screen.findByText('resource-1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /연동 요청 제외대상/ }));
    // Only the every-5th rows survive.
    expect(screen.getByText('resource-0')).toBeTruthy();
    expect(screen.getByText('resource-5')).toBeTruthy();
    expect(screen.queryByText('resource-1')).toBeNull();
  });

  it('pages the table instead of rendering every row', async () => {
    open();

    expect(await screen.findByText('resource-0')).toBeTruthy();
    expect(screen.getByText('resource-9')).toBeTruthy();
    expect(screen.queryByText('resource-10')).toBeNull();
  });

  it('quotes the admin reason once, and states the verdict once', async () => {
    open();
    await screen.findByText('resource-0');

    expect(screen.getByText('처리 사유')).toBeTruthy();
    expect(screen.getByText('스테이징 인스턴스가 섞여 있습니다.')).toBeTruthy();
    // The verdict used to appear as both a panel badge and a 처리 결과 badge.
    expect(screen.getAllByText('반려됨')).toHaveLength(1);
  });

  it('falls back to the summary counts when the resource fetch fails', async () => {
    getApprovalRequestDetail.mockRejectedValueOnce(new Error('boom'));
    open();

    // Same tiles, driven by the summary — not a different-looking modal.
    expect(await screen.findByText('23')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
