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

  // IDC 는 모든 대상이 자격 증명을 요구하므로 미등록은 곧 "아직 고르지 않은 행"이다.
  it('counts every credential-less target as 미선택 and filters the table', () => {
    renderModal();
    expect(screen.getByText(/DB Credential 미선택/).textContent).toContain('2건');

    fireEvent.click(screen.getByRole('button', { name: '미선택만 보기' }));
    expect(screen.queryByText('10.0.0.1')).toBeNull();
    expect(screen.getByText('10.0.0.2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    expect(screen.getByText('10.0.0.1')).toBeTruthy();
    expect(screen.getByText('10.0.0.2')).toBeTruthy();
  });
});
