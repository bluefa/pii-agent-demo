// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { IdcResourceView } from '@/app/lib/api/idc';

vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/app/lib/api', () => ({ updateResourceCredential: vi.fn() }));

import { IdcCredentialModal } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcCredentialModal';

const makeResource = (overrides: Partial<IdcResourceView> = {}): IdcResourceView => ({
  resourceId: 'idc-1',
  persisted: true,
  kind: 'SINGLE',
  hosts: ['10.0.0.1'],
  port: 3306,
  databaseTypeLabel: 'MySQL',
  databaseTypeWire: 'MYSQL',
  sourceIps: [],
  firewallOpen: true,
  connection: 'PENDING',
  health: null,
  done: null,
  excluded: false,
  ...overrides,
});

describe('IdcCredentialModal Credential 필터', () => {
  const resources = [
    makeResource({ resourceId: 'idc-1', hosts: ['10.0.0.1'], credentialId: 'Key1' }),
    makeResource({ resourceId: 'idc-2', hosts: ['10.0.0.2'] }),
    makeResource({ resourceId: 'idc-3', hosts: ['10.0.0.3'] }),
  ];

  const renderModal = () =>
    render(
      <IdcCredentialModal
        isOpen
        onClose={() => {}}
        resources={resources}
        credOptions={['Key1', 'Key2']}
        targetSourceId={1}
        onComplete={() => {}}
      />,
    );

  // IDC 는 모든 대상이 자격 증명을 요구하므로 지정 + 미등록 = 전체.
  it('counts every credential-less target as 미등록 and filters the table', () => {
    renderModal();
    const cardValue = (label: string) =>
      screen.getByRole('button', { name: new RegExp(`^${label}`) }).textContent;
    expect(cardValue('전체 리소스')).toContain('3');
    expect(cardValue('Credential 지정한 리소스')).toContain('1');
    expect(cardValue('Credential 미등록 리소스')).toContain('2');

    fireEvent.click(screen.getByRole('button', { name: /^Credential 미등록 리소스/ }));
    expect(screen.queryByText('10.0.0.1')).toBeNull();
    expect(screen.getByText('10.0.0.2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Credential 지정한 리소스/ }));
    expect(screen.getByText('10.0.0.1')).toBeTruthy();
    expect(screen.queryByText('10.0.0.2')).toBeNull();
  });
});
