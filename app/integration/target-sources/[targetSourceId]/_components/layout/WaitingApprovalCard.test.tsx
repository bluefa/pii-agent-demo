// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getApprovalRequestLatestMock = vi.fn();

// Step 2 now sources both the table (resources, split by `selected`) and the request
// meta from the single approval-requests/latest call — approved-integration is no
// longer fetched here (it stays on step 3).
vi.mock('@/app/lib/api', () => ({
  getApprovalRequestLatest: (...args: unknown[]) => getApprovalRequestLatestMock(...args),
}));

import { WaitingApprovalCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard';

interface ResourceOpts {
  selected: boolean;
  reason?: string;
  dbType?: string;
  region?: string;
}

const res = (resourceId: string, opts: ResourceOpts) => ({
  resource_id: resourceId,
  resource_name: `${resourceId}-name`,
  resource_type: opts.dbType ?? 'MySQL',
  selected: opts.selected,
  integration_category: 'TARGET' as const,
  ...(opts.reason ? { exclusion_reason: opts.reason } : {}),
  metadata: {
    provider: 'AWS',
    region: opts.region ?? 'ap-northeast-1',
    database_type: opts.dbType ?? 'MySQL',
  },
});

const requestMeta = {
  id: 1,
  target_source_id: 1003,
  status: 'PENDING' as const,
  requested_by: { user_id: 'tester' },
  requested_at: '2026-04-29T05:30:00Z',
  resource_total_count: 2,
  resource_selected_count: 1,
};

// Single latest response: request meta + resources (table source).
const buildResponse = () => ({
  request: requestMeta,
  resources: [
    res('mysql-prod-01', { selected: true }),
    res('pg-analytics-03', { selected: false, reason: 'Stg DB', dbType: 'PostgreSQL' }),
  ],
  result: { request_id: 1, status: 'PENDING' as const },
});

const buildLargeResponse = (selectedCount: number, excludedCount: number) => ({
  request: {
    ...requestMeta,
    resource_total_count: selectedCount + excludedCount,
    resource_selected_count: selectedCount,
  },
  resources: [
    ...Array.from({ length: selectedCount }, (_, idx) =>
      res(`sel-${String(idx).padStart(2, '0')}`, { selected: true })),
    ...Array.from({ length: excludedCount }, (_, idx) =>
      res(`exc-${String(idx).padStart(2, '0')}`, { selected: false, reason: 'Stg DB', dbType: 'PostgreSQL' })),
  ],
  result: { request_id: 1, status: 'PENDING' as const },
});

describe('WaitingApprovalCard', () => {
  beforeEach(() => {
    getApprovalRequestLatestMock.mockReset();
    getApprovalRequestLatestMock.mockRejectedValue(new Error('not mocked'));
  });

  it('step-2 toolbar keeps the Region filter and omits the 연동 상태 filter', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
    expect(screen.getByLabelText('Region 필터')).toBeTruthy();
    expect(screen.getByLabelText('DB Type 필터')).toBeTruthy();
    expect(screen.queryByLabelText('연동 상태 필터')).toBeNull();
  });

  it('renders the card title with the cardStyles.cardTitle token', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    const heading = screen.getByRole('heading', { name: '연동 대상 승인 대기' });
    expect(heading.className).toContain('text-[26px]');
    expect(heading.className).toContain('font-extrabold');

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
  });

  it('renders title, sub-text, status pill, and banner copy', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    expect(screen.getByText('연동 대상 승인 대기')).toBeTruthy();
    expect(
      screen.getByText('요청하신 DB 목록을 관리자가 확인하고 있어요.'),
    ).toBeTruthy();
    expect(screen.getByText('승인 대기')).toBeTruthy();
    expect(screen.getByText('관리자 승인을 기다리고 있어요.')).toBeTruthy();
    expect(
      screen.getByText(/평균 1영업일 내 검토되며, 승인되면 메일로 안내됩니다/),
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
    expect(screen.getByText('pg-analytics-03')).toBeTruthy();
  });

  it('falls back to empty table on missing latest request (404)', async () => {
    const error = Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
    Object.setPrototypeOf(error, (await import('@/lib/errors')).AppError.prototype);
    getApprovalRequestLatestMock.mockRejectedValueOnce(error);

    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('표시할 리소스가 없습니다.')).toBeTruthy();
    });
  });

  it('renders cancelSlot and reselectSlot when provided', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(
      <WaitingApprovalCard
        targetSourceId={1003}
        cancelSlot={<button data-testid="cancel-slot">취소</button>}
        reselectSlot={<button data-testid="reselect-slot">다시</button>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('cancel-slot')).toBeTruthy();
    });
    expect(screen.getByTestId('reselect-slot')).toBeTruthy();
  });

  it('does not render footer when no slots are provided', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
    expect(screen.queryByTestId('cancel-slot')).toBeNull();
    expect(screen.queryByTestId('reselect-slot')).toBeNull();
  });

  it('renders stats with selected/excluded counts and percentages', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildLargeResponse(3, 2));
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('전체 요청')).toBeTruthy();
    });
    expect(screen.getAllByText('연동 대상').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('비대상').length).toBeGreaterThanOrEqual(1);

    const tiles = screen.getAllByText(/^\d+$/);
    expect(tiles.some((el) => el.textContent === '5')).toBe(true);
    expect(tiles.some((el) => el.textContent === '3')).toBe(true);
    expect(tiles.some((el) => el.textContent === '2')).toBe(true);

    expect(screen.getByText(/60\.0%/)).toBeTruthy();
    expect(screen.getByText(/40\.0%/)).toBeTruthy();
  });

  it('filter "대상" hides excluded rows', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
    expect(screen.getByText('pg-analytics-03')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^대상/ }));

    await waitFor(() => {
      expect(screen.queryByText('pg-analytics-03')).toBeNull();
    });
    expect(screen.getByText('mysql-prod-01')).toBeTruthy();
  });

  it('search filters by resourceId case-insensitively', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('리소스 검색'), { target: { value: 'MYSQL' } });

    await waitFor(() => {
      expect(screen.queryByText('pg-analytics-03')).toBeNull();
    });
    expect(screen.getByText('mysql-prod-01')).toBeTruthy();
  });

  it('changing page size resets page to first', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildLargeResponse(12, 0));
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByLabelText('다음 페이지')).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText('다음 페이지'));
    await waitFor(() => {
      const currentPage = screen.getByRole('button', { current: 'page' });
      expect(currentPage.textContent).toBe('2');
    });

    fireEvent.change(screen.getByLabelText('페이지당 표시 건수'), { target: { value: '20' } });

    await waitFor(() => {
      const currentPage = screen.getByRole('button', { current: 'page' });
      expect(currentPage.textContent).toBe('1');
    });
  });

  it('"다음 페이지" is disabled when on the last page', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildLargeResponse(5, 0));
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByLabelText('다음 페이지')).toBeTruthy();
    });

    expect(screen.getByLabelText('다음 페이지').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('끝 페이지').hasAttribute('disabled')).toBe(true);
  });

  it('empty response renders zero-count stats and the table empty state', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce({
      request: { ...requestMeta, resource_total_count: 0, resource_selected_count: 0 },
      resources: [],
      result: { request_id: 1, status: 'PENDING' as const },
    });
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('표시할 리소스가 없습니다.')).toBeTruthy();
    });
    expect(screen.getByText('전체 요청')).toBeTruthy();
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it('filter combination yielding no results shows the filter empty message', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('리소스 검색'), { target: { value: 'no-such-resource' } });

    await waitFor(() => {
      expect(screen.getByText('조건에 맞는 결과가 없어요.')).toBeTruthy();
    });
  });

  it('excluded row renders the reason chip in 제외 사유 column', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('pg-analytics-03')).toBeTruthy();
    });
    expect(screen.getAllByText('Stg DB').length).toBeGreaterThanOrEqual(1);
  });

  it('selected row shows a dash placeholder in 제외 사유 column', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('renders 요청일시 + 요청자 in the subtitle from the latest request meta', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildResponse());

    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText(/요청일시/)).toBeTruthy();
    });
    expect(screen.getByText('tester')).toBeTruthy();
  });

  it('renders a bare subtitle (table still loads) when the response has no request meta', async () => {
    getApprovalRequestLatestMock.mockResolvedValueOnce({
      request: null,
      resources: buildResponse().resources,
      result: { request_id: 0, status: 'PENDING' as const },
    });
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
    expect(screen.queryByText(/요청일시/)).toBeNull();
    expect(screen.queryByText(/요청자/)).toBeNull();
  });
});
