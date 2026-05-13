// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { ApprovedResource } from '@/lib/types/resources';
import { ApprovedIntegrationTable } from '@/app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationTable';

const buildResource = (overrides: Partial<ApprovedResource> = {}): ApprovedResource => ({
  resourceId: 'mysql-prod-01',
  type: 'RDS',
  databaseType: 'MYSQL',
  endpointConfig: null,
  credentialId: 'cred-1',
  ...overrides,
});

describe('ApprovedIntegrationTable', () => {
  it('renders an empty-state message when approved is empty', () => {
    render(<ApprovedIntegrationTable approved={[]} />);
    expect(screen.getByText('반영 중인 리소스가 없습니다.')).toBeTruthy();
  });

  it('renders the 연동 이력 column header', () => {
    render(<ApprovedIntegrationTable approved={[buildResource()]} />);
    expect(screen.getByText('연동 이력')).toBeTruthy();
  });

  it('renders a Pending scan-pill for every approved row', () => {
    render(
      <ApprovedIntegrationTable
        approved={[
          buildResource({ resourceId: 'mysql-prod-01' }),
          buildResource({ resourceId: 'pg-prod-02' }),
        ]}
      />,
    );
    // Two pending pills — both rows default to "pending" via deriveScanPill.
    const pendingPills = screen.getAllByText('Pending');
    expect(pendingPills.length).toBe(2);
  });

  it('renders 5 columns total (4 original + 연동 이력)', () => {
    render(<ApprovedIntegrationTable approved={[buildResource()]} />);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['리소스 ID', '유형', 'DB 타입', 'Credential', '연동 이력']);
  });
});
