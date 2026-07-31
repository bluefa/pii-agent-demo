// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getApprovedIntegrationMock = vi.fn();

vi.mock('@/app/lib/api', () => ({
  getApprovedIntegration: (...args: unknown[]) => getApprovedIntegrationMock(...args),
}));

import { ApplyingApprovedCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedCard';

// 2 INTEGRATED + 1 NOT_INTEGRATED (pending) selected rows + 1 excluded row.
const buildResponse = () => ({
  approved_integration: {
    id: 'ai-1',
    request_id: 'req-1',
    approved_at: '2026-04-30T00:00:00Z',
    approved_by: 'admin',
    resource_infos: [
      {
        resource_id: 'mysql-integrated-01',
        resource_type: 'MySQL',
        endpoint_config: null,
        credential_id: null,
        database_region: 'ap-northeast-1',
        resource_name: 'sea-integrated-01',
        scan_status: 'NEW_SCAN' as const,
        integration_status: 'INTEGRATED' as const,
      },
      {
        resource_id: 'mysql-integrated-02',
        resource_type: 'MySQL',
        endpoint_config: null,
        credential_id: null,
        database_region: 'ap-northeast-1',
        resource_name: 'sea-integrated-02',
        scan_status: 'NEW_SCAN' as const,
        integration_status: 'INTEGRATED' as const,
      },
      {
        resource_id: 'pg-pending-01',
        resource_type: 'PostgreSQL',
        endpoint_config: null,
        credential_id: null,
        database_region: 'ap-northeast-2',
        resource_name: 'sea-pending-01',
        scan_status: 'NEW_SCAN' as const,
        integration_status: 'NOT_INTEGRATED' as const,
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
        scan_status: 'UNCHANGED' as const,
        integration_status: null,
      },
    ],
    exclusion_reason: undefined,
  },
});

describe('ApplyingApprovedCard step-3 toolbar', () => {
  beforeEach(() => {
    getApprovedIntegrationMock.mockReset();
  });

  // Toolbar filters live in a popover behind the icon button — open it, then click a row.
  const openFilterMenu = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /필터/ }));
    return screen.getByRole('group', { name: '필터 옵션' });
  };

  it('renders the 연동 상태 filter (not Region) with Integrated/Pending counts + 제외', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    const menu = await openFilterMenu();
    const status = within(menu).getByRole('radiogroup', { name: '연동 상태 필터' });
    expect(within(status).getByText('Integrated (2)')).toBeTruthy();
    expect(within(status).getByText('Pending (1)')).toBeTruthy();
    expect(within(status).getByText('제외')).toBeTruthy();

    // step 3 must NOT expose the Region filter.
    expect(within(menu).queryByRole('radiogroup', { name: 'Region 필터' })).toBeNull();
    // DB Type filter stays.
    expect(within(menu).getByRole('radiogroup', { name: 'Database Type 필터' })).toBeTruthy();
  });

  it('filtering 연동 상태 = Integrated keeps only integrated rows', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    const menu = await openFilterMenu();
    fireEvent.click(
      within(within(menu).getByRole('radiogroup', { name: '연동 상태 필터' })).getByText('Integrated (2)'),
    );

    await waitFor(() => {
      expect(screen.queryByText('pg-pending-01')).toBeNull();
    });
    expect(screen.getByText('mysql-integrated-01')).toBeTruthy();
    expect(screen.getByText('mysql-integrated-02')).toBeTruthy();
    expect(screen.queryByText('pg-excluded-01')).toBeNull();
  });

  it('filtering 연동 상태 = Pending keeps only the not-yet-integrated target', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    const menu = await openFilterMenu();
    fireEvent.click(
      within(within(menu).getByRole('radiogroup', { name: '연동 상태 필터' })).getByText('Pending (1)'),
    );

    await waitFor(() => {
      expect(screen.getByText('pg-pending-01')).toBeTruthy();
    });
    expect(screen.queryByText('mysql-integrated-01')).toBeNull();
    expect(screen.queryByText('pg-excluded-01')).toBeNull();
  });

  it('filtering 연동 상태 = 제외 keeps only excluded rows', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    const menu = await openFilterMenu();
    fireEvent.click(
      within(within(menu).getByRole('radiogroup', { name: '연동 상태 필터' })).getByText('제외'),
    );

    await waitFor(() => {
      expect(screen.getByText('pg-excluded-01')).toBeTruthy();
    });
    expect(screen.queryByText('mysql-integrated-01')).toBeNull();
    expect(screen.queryByText('pg-pending-01')).toBeNull();
  });
});
