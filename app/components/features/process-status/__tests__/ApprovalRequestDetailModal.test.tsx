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

  /**
   * A host-based resource has no region, so reading only `metadata.region` left the
   * column empty and the endpoint that was actually approved went unrecorded.
   */
  it('shows the endpoint as 위치 for a host-based resource', async () => {
    getApprovalRequestDetail.mockResolvedValue({
      resources: [
        {
          resource_id: 'idc-1',
          resource_name: 'oracle-order-prod',
          resource_type: 'IDC',
          selected: true,
          metadata: { database_type: 'ORACLE', host: '10.20.1.11', port: 1521 },
        },
      ],
    });
    open();

    expect(await screen.findByText('10.20.1.11:1521')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '위치' })).toBeTruthy();
  });

  /**
   * INSTALL_INELIGIBLE is the scan's verdict, not a user's choice. Dropping
   * integration_category from the adapter rendered it as a revisable 제외 pill.
   */
  it('keeps the scan verdict distinct from a user exclusion', async () => {
    getApprovalRequestDetail.mockResolvedValue({
      resources: [
        {
          resource_id: 'res-x',
          resource_name: 'ineligible-db',
          resource_type: 'AZURE_MYSQL',
          selected: false,
          integration_category: 'INSTALL_INELIGIBLE',
          metadata: { database_type: 'MYSQL', region: 'ap-northeast-2' },
        },
      ],
    });
    open();

    expect(await screen.findByText('ineligible-db')).toBeTruthy();
    expect(screen.getByText('연동 불가')).toBeTruthy();
    expect(screen.queryByText('제외')).toBeNull();
  });

  /** An IDC resource_id is an internal NLB-PUT key (design-spec §8). */
  it('never surfaces an IDC resource_id', async () => {
    getApprovalRequestDetail.mockResolvedValue({
      resources: [
        {
          resource_id: 'idc-r-8f21',
          resource_type: 'IDC',
          selected: true,
          metadata: {
            database_type: 'ORACLE',
            host: '10.20.1.11',
            port: 1521,
            idc_host_format: 'IP',
          },
        },
      ],
    });
    open();

    // The endpoint stands in for the name; the internal id appears nowhere.
    expect((await screen.findAllByText('10.20.1.11:1521')).length).toBeGreaterThan(0);
    expect(screen.queryByText('idc-r-8f21')).toBeNull();
  });

  /** ADR-006: a null processor means the request was approved automatically. */
  it('names the processor 시스템 when the result carries no user', async () => {
    render(
      <ApprovalRequestDetailModal
        isOpen
        onClose={() => {}}
        item={{
          ...item,
          result: { result: 'APPROVED', processed_at: '2026-07-31T09:00:00Z', process_info: {} },
        }}
        targetSourceId={2002}
      />,
    );

    expect(await screen.findByText('시스템')).toBeTruthy();
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
