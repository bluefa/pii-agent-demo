// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getApprovedIntegrationMock = vi.fn();

vi.mock('@/app/lib/api', () => ({
  getApprovedIntegration: (...args: unknown[]) => getApprovedIntegrationMock(...args),
}));

import { ApplyingApprovedCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedCard';

// 2 selected rows + 1 excluded row. integration_status/scan_status are NOT part of
// TargetSourceResourceItemDto (LIN-51) and must not drive any step-3 UI.
const buildResponse = () => ({
  approved_integration: {
    id: 'ai-1',
    request_id: 'req-1',
    approved_at: '2026-04-30T00:00:00Z',
    approved_by: 'admin',
    resource_infos: [
      {
        resource_id: 'mysql-01',
        resource_type: 'MySQL',
        endpoint_config: null,
        credential_id: null,
        database_region: 'ap-northeast-1',
        resource_name: 'sea-01',
      },
      {
        resource_id: 'pg-01',
        resource_type: 'PostgreSQL',
        endpoint_config: null,
        credential_id: null,
        database_region: 'ap-northeast-2',
        resource_name: 'sea-02',
      },
    ],
    excluded_resource_ids: ['pg-excluded-01'],
    excluded_resource_infos: [
      {
        resource_id: 'pg-excluded-01',
        exclusion_reason: 'Stg DB',
        resource_name: 'sea-excluded-01',
        database_type: 'PostgreSQL',
        database_region: 'ap-northeast-1',
      },
    ],
    exclusion_reason: undefined,
  },
});

describe('ApplyingApprovedCard step-3 toolbar', () => {
  beforeEach(() => {
    getApprovedIntegrationMock.mockReset();
  });

  it('renders rows without any integration-status surface (off-contract field removed)', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    expect(await screen.findByText('mysql-01')).toBeTruthy();
    expect(screen.getByText('pg-excluded-01')).toBeTruthy();

    // The 연동 상태 filter, 연동 이력 column, and Integrated/Pending tags are gone.
    expect(screen.queryByLabelText('연동 상태 필터')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: '연동 이력' })).toBeNull();
    expect(screen.queryByText('Integrated')).toBeNull();
    expect(screen.queryByText('Pending')).toBeNull();

    // step 3 exposes neither the Region filter (v16) — DB Type stays.
    expect(screen.queryByLabelText('Region 필터')).toBeNull();
    expect(screen.getByLabelText('DB Type 필터')).toBeTruthy();
  });

  it('banner shows no per-resource completion count (no contract source)', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    await screen.findByText('mysql-01');
    expect(screen.getByText(/승인이 완료되어 시스템에 반영 중입니다/)).toBeTruthy();
    expect(screen.queryByText(/건 완료/)).toBeNull();
  });
});
