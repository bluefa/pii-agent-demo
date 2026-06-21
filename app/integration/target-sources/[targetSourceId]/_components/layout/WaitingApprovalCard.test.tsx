// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getApprovedIntegrationMock = vi.fn();
const getApprovalRequestLatestMock = vi.fn();

vi.mock('@/app/lib/api', () => ({
  getApprovedIntegration: (...args: unknown[]) => getApprovedIntegrationMock(...args),
  getApprovalRequestLatest: (...args: unknown[]) => getApprovalRequestLatestMock(...args),
}));

import { WaitingApprovalCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard';

const buildResponse = () => ({
  approved_integration: {
    id: 'ai-1',
    request_id: 'req-1',
    approved_at: '2026-04-30T00:00:00Z',
    resource_infos: [
      {
        resource_id: 'mysql-prod-01',
        resource_type: 'MySQL',
        endpoint_config: null,
        credential_id: null,
        database_region: 'ap-northeast-1',
        resource_name: 'sea-live-space-prod',
        scan_status: 'NEW_SCAN' as const,
        integration_status: null,
      },
    ],
    excluded_resource_ids: ['pg-analytics-03'],
    excluded_resource_infos: [
      {
        resource_id: 'pg-analytics-03',
        exclusion_reason: 'Stg DB',
        resource_name: 'sea-live-space-prd',
        database_type: 'PostgreSQL',
        database_region: 'ap-northeast-1',
        scan_status: 'UNCHANGED' as const,
        integration_status: null,
      },
    ],
    exclusion_reason: undefined,
  },
});

const buildApprovalRequestLatest = () => ({
  request: {
    id: 1,
    target_source_id: 1003,
    status: 'PENDING',
    requested_by: { user_id: 'tester' },
    requested_at: '2026-04-29T05:30:00Z',
    resource_total_count: 2,
    resource_selected_count: 1,
  },
  result: {
    request_id: null,
    status: 'PENDING',
    processed_by: { user_id: '' },
    processed_at: '',
    reason: null,
  },
});

describe('WaitingApprovalCard', () => {
  beforeEach(() => {
    getApprovedIntegrationMock.mockReset();
    getApprovalRequestLatestMock.mockReset();
    getApprovalRequestLatestMock.mockRejectedValue(new Error('not mocked'));
  });

  it('renders the card title with the cardStyles.cardTitle token', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    const heading = screen.getByRole('heading', { name: '연동 대상 승인 대기' });
    expect(heading.className).toContain('text-[26px]');
    expect(heading.className).toContain('font-extrabold');

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
  });

  it('renders title, sub-text, status pill, and banner copy', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
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

  it('falls back to empty table on missing approved-integration (404)', async () => {
    const error = Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
    Object.setPrototypeOf(error, (await import('@/lib/errors')).AppError.prototype);
    getApprovedIntegrationMock.mockRejectedValueOnce(error);

    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('표시할 리소스가 없습니다.')).toBeTruthy();
    });
  });

  it('renders cancelSlot and reselectSlot when provided', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
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
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
    expect(screen.queryByTestId('cancel-slot')).toBeNull();
    expect(screen.queryByTestId('reselect-slot')).toBeNull();
  });

  it('renders stats with selected/excluded counts and percentages', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildLargeResponse(3, 2));
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('전체 요청')).toBeTruthy();
    });
    expect(screen.getByText('연동 대상')).toBeTruthy();
    expect(screen.getAllByText('비대상').length).toBeGreaterThanOrEqual(1);

    const tiles = screen.getAllByText(/^\d+$/);
    expect(tiles.some((el) => el.textContent === '5')).toBe(true);
    expect(tiles.some((el) => el.textContent === '3')).toBe(true);
    expect(tiles.some((el) => el.textContent === '2')).toBe(true);

    expect(screen.getByText(/60\.0%/)).toBeTruthy();
    expect(screen.getByText(/40\.0%/)).toBeTruthy();
  });

  it('filter "대상" hides excluded rows', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
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
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
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
    getApprovedIntegrationMock.mockResolvedValueOnce(buildLargeResponse(12, 0));
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
    getApprovedIntegrationMock.mockResolvedValueOnce(buildLargeResponse(5, 0));
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByLabelText('다음 페이지')).toBeTruthy();
    });

    expect(screen.getByLabelText('다음 페이지').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('끝 페이지').hasAttribute('disabled')).toBe(true);
  });

  it('empty response renders zero-count stats and the table empty state', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce({
      approved_integration: {
        id: 'ai-empty',
        request_id: 'req-empty',
        approved_at: '2026-04-30T00:00:00Z',
        resource_infos: [],
        excluded_resource_ids: [],
        excluded_resource_infos: [],
        exclusion_reason: undefined,
      },
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
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
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
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('pg-analytics-03')).toBeTruthy();
    });
    expect(screen.getAllByText('Stg DB').length).toBeGreaterThanOrEqual(1);
  });

  it('selected row shows a dash placeholder in 제외 사유 column', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('renders 요청일시 + 요청자 in the subtitle when getApprovalRequestLatest returns metadata', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    getApprovalRequestLatestMock.mockReset();
    getApprovalRequestLatestMock.mockResolvedValueOnce(buildApprovalRequestLatest());

    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText(/요청일시/)).toBeTruthy();
    });
    expect(screen.getByText('tester')).toBeTruthy();
  });

  it('falls back to bare subtitle when getApprovalRequestLatest rejects', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    // getApprovalRequestLatestMock is set to reject by default in beforeEach
    render(<WaitingApprovalCard targetSourceId={1003} />);

    await waitFor(() => {
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    });
    expect(screen.queryByText(/요청일시/)).toBeNull();
    expect(screen.queryByText(/요청자/)).toBeNull();
  });
});

const buildLargeResponse = (selectedCount: number, excludedCount: number) => ({
  approved_integration: {
    id: 'ai-large',
    request_id: 'req-large',
    approved_at: '2026-04-30T00:00:00Z',
    resource_infos: Array.from({ length: selectedCount }, (_, idx) => ({
      resource_id: `sel-${String(idx).padStart(2, '0')}`,
      resource_type: 'MySQL',
      endpoint_config: null,
      credential_id: null,
      database_region: 'ap-northeast-1',
      resource_name: `selected-${idx}`,
      scan_status: 'NEW_SCAN' as const,
      integration_status: null,
    })),
    excluded_resource_ids: Array.from({ length: excludedCount }, (_, idx) => `exc-${String(idx).padStart(2, '0')}`),
    excluded_resource_infos: Array.from({ length: excludedCount }, (_, idx) => ({
      resource_id: `exc-${String(idx).padStart(2, '0')}`,
      exclusion_reason: 'Stg DB',
      resource_name: `excluded-${idx}`,
      database_type: 'PostgreSQL',
      database_region: 'ap-northeast-1',
      scan_status: 'UNCHANGED' as const,
      integration_status: null,
    })),
    exclusion_reason: undefined,
  },
});
