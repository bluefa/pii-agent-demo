// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getApprovedIntegrationMock = vi.fn();

vi.mock('@/app/lib/api', () => ({
  getApprovedIntegration: (...args: unknown[]) => getApprovedIntegrationMock(...args),
}));

import { ApplyingApprovedCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedCard';

// 3 selected rows (2 MySQL + 1 PostgreSQL) + 1 excluded row.
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
        credential_id: null,
        database_region: 'ap-northeast-1',
        resource_name: 'sea-integrated-01',
        scan_status: 'NEW_SCAN' as const,
      },
      {
        resource_id: 'mysql-integrated-02',
        resource_type: 'MySQL',
        credential_id: null,
        database_region: 'ap-northeast-1',
        resource_name: 'sea-integrated-02',
        scan_status: 'NEW_SCAN' as const,
      },
      {
        resource_id: 'pg-pending-01',
        resource_type: 'PostgreSQL',
        credential_id: null,
        database_region: 'ap-northeast-2',
        resource_name: 'sea-pending-01',
        scan_status: 'NEW_SCAN' as const,
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
      },
    ],
    exclusion_reason: undefined,
  },
});

describe('ApplyingApprovedCard step-3 toolbar', () => {
  beforeEach(() => {
    getApprovedIntegrationMock.mockReset();
  });

  // Toolbar filters live in a popover behind the icon button.
  const openFilterMenu = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /필터/ }));
    return screen.getByRole('group', { name: '필터 옵션' });
  };

  it('offers Database Type and Region filters, and no 연동 상태 filter', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    const menu = await openFilterMenu();
    expect(within(menu).getByRole('radiogroup', { name: 'Database Type 필터' })).toBeTruthy();
    expect(within(menu).getByRole('radiogroup', { name: 'Region 필터' })).toBeTruthy();
    // integration_status is not in the contract, so the filter it fed is gone.
    expect(within(menu).queryByRole('radiogroup', { name: '연동 상태 필터' })).toBeNull();
  });

  it('renders no 연동 이력 column and no Integrated/Pending tag', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    await screen.findByText('mysql-integrated-01');
    expect(screen.queryByText('연동 이력')).toBeNull();
    expect(screen.queryByText('Pending')).toBeNull();
    expect(screen.queryByText('Integrated')).toBeNull();
    // The exclusion reason keeps its own column instead of stacking under the verdict.
    expect(screen.getByText('제외 사유')).toBeTruthy();
    expect(screen.getByText('Stg DB')).toBeTruthy();
  });

  it('filtering Database Type keeps only the matching rows', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce(buildResponse());
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    const menu = await openFilterMenu();
    fireEvent.click(
      within(within(menu).getByRole('radiogroup', { name: 'Database Type 필터' })).getByText('PostgreSQL'),
    );

    await waitFor(() => {
      expect(screen.queryByText('mysql-integrated-01')).toBeNull();
    });
    expect(screen.getByText('pg-pending-01')).toBeTruthy();
  });

  /**
   * `resource_type` is absent whenever the response echoes the step-1 payload — the request
   * adapter (approval-payload.ts) sends only metadata.{provider,region,database_type}. The
   * selected-row mapper has to fall back to metadata the same way its excluded-row sibling
   * does, because that field is the GROUPING key.
   */
  it('folds selected Athena rows by region when resource_type is absent', async () => {
    const athena = (db: string) => ({
      resource_id: `athena:804656952396:ap-northeast-1:AwsDataCatalog/${db}`,
      resource_name: db,
      credential_id: null,
      metadata: { provider: 'AWS', region: 'ap-northeast-1', database_type: 'athena' },
    });
    getApprovedIntegrationMock.mockResolvedValueOnce({
      approved_integration: {
        id: 'ai-2',
        request_id: 'req-2',
        approved_at: '2026-04-30T00:00:00Z',
        approved_by: 'admin',
        resource_infos: [athena('sampledb'), athena('integration')],
        excluded_resource_ids: [],
        excluded_resource_infos: [],
      },
    });
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    // The parent row exists only once the grouping key resolved; an empty resourceType
    // renders the two databases flat, with no toggle anywhere in the table.
    expect(
      await screen.findByRole('button', { name: /^Athena ap-northeast-1 그룹/ }),
    ).toBeTruthy();
  });
});

// Step 3 echoes the approved request. An EXCLUDED cluster chose no instance, so the row must
// not raise a 선택됨 chip even if the wire hands one back — the list is evidence, the choice
// is not. The selected half keeps both.
describe('ApplyingApprovedCard — RDS cluster rows', () => {
  const CANDIDATES = [
    { resource_id: 'arn:db:demo-1', resource_name: 'demo-1', availability_zone: 'ap-northeast-2a', cluster_member_role: 'WRITER' },
    { resource_id: 'arn:db:demo-2', resource_name: 'demo-2', availability_zone: 'ap-northeast-2b', cluster_member_role: 'READER' },
  ];
  const clusterMetadata = {
    region: 'ap-northeast-2',
    database_type: 'MySQL',
    rds_instance_candidates: CANDIDATES,
    selected_rds_instance_resource_id: 'arn:db:demo-2',
  };

  beforeEach(() => {
    getApprovedIntegrationMock.mockReset();
  });

  it('marks the chosen instance on a SELECTED cluster', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce({
      approved_integration: {
        id: 'ai-1',
        request_id: 'req-1',
        approved_at: '2026-04-30T00:00:00Z',
        approved_by: 'admin',
        resource_infos: [
          {
            resource_id: 'arn:cluster:demo',
            resource_type: 'AWS_DB_CLUSTER',
            credential_id: null,
            database_region: 'ap-northeast-2',
            resource_name: 'demo-cluster',
            scan_status: 'NEW_SCAN' as const,
            metadata: clusterMetadata,
          },
        ],
        excluded_resource_ids: [],
        excluded_resource_infos: [],
      },
    });
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    expect(await screen.findByText('demo-cluster')).toBeTruthy();
    expect(screen.getByText('RDS Cluster')).toBeTruthy();
    expect(screen.getAllByText('선택됨')).toHaveLength(1);
  });

  // The wire echoes the selection here on purpose — the adapter has to drop it anyway.
  it('lists an EXCLUDED cluster’s instances but never marks one', async () => {
    getApprovedIntegrationMock.mockResolvedValueOnce({
      approved_integration: {
        id: 'ai-1',
        request_id: 'req-1',
        approved_at: '2026-04-30T00:00:00Z',
        approved_by: 'admin',
        resource_infos: [],
        excluded_resource_ids: ['arn:cluster:demo'],
        excluded_resource_infos: [
          {
            resource_id: 'arn:cluster:demo',
            resource_type: 'AWS_DB_CLUSTER',
            exclusion_reason: '미사용 클러스터',
            resource_name: 'demo-cluster',
            database_type: 'MySQL',
            database_region: 'ap-northeast-2',
            scan_status: 'UNCHANGED' as const,
            metadata: clusterMetadata,
          },
        ],
      },
    });
    render(<ApplyingApprovedCard targetSourceId={1003} />);

    expect(await screen.findByText('demo-cluster')).toBeTruthy();
    expect(screen.getByText('RDS Cluster')).toBeTruthy();
    // An excluded cluster starts folded (useClusterFold): its members are reference, not review.
    expect(screen.queryByText('demo-1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
    // The members are still listed — they are the evidence for the exclusion.
    expect(screen.getByText('demo-1')).toBeTruthy();
    expect(screen.getByText('demo-2')).toBeTruthy();
    // …but nothing is marked, despite the wire naming a selection.
    expect(screen.queryByText('선택됨')).toBeNull();
  });
});
