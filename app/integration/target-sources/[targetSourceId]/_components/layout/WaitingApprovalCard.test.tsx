// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getApprovedIntegrationMock = vi.fn();

vi.mock('@/app/lib/api', () => ({
  getApprovedIntegration: (...args: unknown[]) => getApprovedIntegrationMock(...args),
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

describe('WaitingApprovalCard', () => {
  beforeEach(() => {
    getApprovedIntegrationMock.mockReset();
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
});
