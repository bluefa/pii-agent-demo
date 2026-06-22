// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}));

vi.mock(
  '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader',
  () => ({ LogicalDbModalLoader: () => null }),
);

import { ConnectionTestCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestCard';

const makeResource = (overrides: Partial<ConfirmedResource> = {}): ConfirmedResource => ({
  resourceId: 'res-1',
  type: 'RDS',
  databaseType: 'mysql',
  region: 'ap-northeast-2',
  resourceName: 'space-prod',
  host: 'localhost',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: 'Key1',
  connectionStatus: 'CONNECTED',
  ...overrides,
});

const renderCard = (confirmed: ConfirmedResource[]) =>
  render(
    <ConnectionTestCard confirmed={confirmed} providerLabel="Azure Infrastructure" refreshProject={() => {}} />,
  );

describe('ConnectionTestCard', () => {
  it('renders the 7 v16 connection-test columns', () => {
    renderCard([makeResource()]);
    for (const header of [
      'Database Type',
      'Resource ID',
      'Region',
      'Resource Name',
      'DB Credential',
      'Connection Status',
      '논리 DB 확인',
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeTruthy();
    }
  });

  it('opens every credentialed row as Pending (step5 is pre-test)', () => {
    renderCard([makeResource({ credentialId: 'Key1', connectionStatus: 'CONNECTED' })]);
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.queryByText('Success')).toBeNull();
  });

  it('shows 자격 증명 필요 and disables Run Test + 설정 when a row has no credential', () => {
    renderCard([makeResource({ credentialId: null })]);
    expect(screen.getByText('자격 증명 필요')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '설정' })).toHaveProperty('disabled', true);
  });

  it('enables Run Test when every row has a credential selected', () => {
    renderCard([makeResource({ credentialId: 'Key1' }), makeResource({ resourceId: 'res-2', credentialId: 'Key2' })]);
    expect(screen.getByRole('button', { name: /Run Test/ })).toHaveProperty('disabled', false);
  });

  it('settles credentialed rows to Success and enables 설정 after Run Test', async () => {
    vi.useFakeTimers();
    try {
      renderCard([makeResource({ credentialId: 'Key1' })]);
      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.getByRole('button', { name: '설정' })).toHaveProperty('disabled', true);

      fireEvent.click(screen.getByRole('button', { name: /Run Test/ }));
      await act(async () => {
        vi.advanceTimersByTime(1800);
      });

      expect(screen.getByText('Success')).toBeTruthy();
      expect(screen.getByRole('button', { name: '설정' })).toHaveProperty('disabled', false);
    } finally {
      vi.useRealTimers();
    }
  });
});
