// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { type IdcResourceView } from '@/app/lib/api/idc';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { IdcConnStatusCell } from '@/app/target-sources/[targetSourceId]/_components/idc/cells';

// Stub the tooltip/pagination chrome so only the table cells under test render.
vi.mock('@/app/components/ui/Tooltip', () => ({
  InfoTooltip: () => null,
  IdentifierTip: () => null,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/components/ui/Pagination', () => ({ Pagination: () => null }));

const view = (over: Partial<IdcResourceView>): IdcResourceView => ({
  resourceId: 'r',
  persisted: true,
  kind: 'SINGLE',
  hosts: ['10.0.0.1'],
  port: 3306,
  databaseTypeLabel: 'MySQL',
  databaseTypeWire: 'MYSQL',
  sourceIps: ['172.16.0.11'],
  firewallOpen: true,
  connection: 'SUCCESS',
  health: 'HEALTHY',
  done: '연동 완료',
  excluded: false,
  ...over,
});

/**
 * The credential-aware connection status (v16 audit fix). It is no longer a table column —
 * steps 5·6·7 all render `logicalro` — but the completion-approval modal still asks the same
 * question per row, so the cell keeps its own coverage.
 */
describe('IdcConnStatusCell — credential-aware status', () => {
  it('renders Success for a credentialed row whose test passed', () => {
    render(
      <IdcConnStatusCell
        resource={view({ resourceId: 'with-cred', credentialId: 'idc_svc_mysql', connection: 'SUCCESS' })}
      />,
    );
    expect(screen.getByText('Success')).toBeTruthy();
  });

  it("shows '자격 증명 필요' for a live row with no credential", () => {
    render(
      <IdcConnStatusCell
        resource={view({ resourceId: 'no-cred', credentialId: undefined, connection: 'PENDING' })}
      />,
    );
    expect(screen.getByText('자격 증명 필요')).toBeTruthy();
    expect(screen.queryByText('Pending')).toBeNull();
  });
});

/**
 * 구분은 제 열이 아니라 접속 주소 위의 배지다 (EC2·RDS Cluster 태그와 같은 2줄 정체성).
 * 리프트는 한 줄짜리 끝점에만 걸린다 — MULTIPLE_IP 은 더보기로 아래로 자라 맞출 선이 없다.
 */
describe('IdcResourceTable — 접속 주소에 얹힌 구분', () => {
  const firstCell = (r: Partial<IdcResourceView>) => {
    const { container } = render(<IdcResourceTable resources={[view(r)]} cols={['logicalro']} />);
    return container.querySelector('tbody td') as HTMLElement;
  };

  it('구분 열 없이 배지를 주소와 한 칸에 넣는다', () => {
    render(<IdcResourceTable resources={[view({ kind: 'DOMAIN', hosts: ['db.a.internal'] })]} cols={['logicalro']} />);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers).not.toContain('구분');
    expect(headers[0]).toBe('접속 주소');

    const cell = screen.getByText('db.a.internal').closest('td');
    // 배지가 남의 칸에 있으면 이 표는 열을 하나 지운 게 아니라 옮긴 것이다.
    expect(cell?.textContent).toContain('Domain');
  });

  it('한 줄 끝점만 리프트를 받는다', () => {
    expect(firstCell({ kind: 'SINGLE' }).innerHTML).toContain('-top-[12px]');
    // 더보기로 자라는 행은 정렬선이 없다 — 올리면 주소가 이웃 칸 위로 뜬다.
    expect(firstCell({ kind: 'MULTIPLE_IP', hosts: ['10.0.0.1', '10.0.0.2'] }).innerHTML).not.toContain(
      '-top-[12px]',
    );
    // 끝점이 없는 행은 배지도 없다: 어댑터 기본값 'SINGLE' 을 모양으로 단언하지 않는다.
    expect(firstCell({ hosts: [] }).textContent).toBe('—');
  });
});

/**
 * Steps 5·6·7 column set (`src`, `logicalro`) — the Step 5 logical-DB result. A non-zero count
 * opens the read-only list; 0 has nothing to open; a resource with no summary row renders
 * "—" rather than a fabricated 0.
 */
describe('IdcResourceTable — step-6 logicalro', () => {
  const counts = new Map([['r1', { target: 6, excluded: 0 }]]);

  it('renders a non-zero count as a button and zero as plain text', () => {
    const onOpen = vi.fn();
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1' })]}
        cols={['src', 'logicalro']}
        logicalDbCounts={counts}
        onLogicalOpen={onOpen}
      />,
    );
    const open = screen.getByRole('button', { name: /연동 논리 DB 목록 보기/ });
    expect(screen.queryByRole('button', { name: /연동 제외 대상 보기/ })).toBeNull();
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders — when the resource has no summary row', () => {
    const { container } = render(
      <IdcResourceTable
        resources={[view({ resourceId: 'other' })]}
        cols={['src', 'logicalro']}
        logicalDbCounts={counts}
      />,
    );
    const cells = Array.from(container.querySelectorAll('tbody td')).map((td) => td.textContent);
    // 접속 주소(구분 배지 포함) / Port / Database Type / BDC측 출발지 / 연동 논리 DB / 연동 제외
    expect(cells[4]).toBe('—');
    expect(cells[5]).toBe('—');
  });

  it('drops the Credential and Connection Status columns without the `cred` col (steps 6·7)', () => {
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1', credentialId: 'idc_svc_mysql' })]}
        cols={['src', 'logicalro']}
        logicalDbCounts={counts}
      />,
    );
    expect(screen.queryByText('Credential')).toBeNull();
    expect(screen.queryByText('Connection Status')).toBeNull();
    expect(screen.queryByText('idc_svc_mysql')).toBeNull();
  });

  // Step 5 is the only step that can write a credential, so it is the only one that shows it.
  it('shows the Credential as an editable value with the `cred` col (step 5)', () => {
    const onCredentialOpen = vi.fn();
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1' })]}
        cols={['src', 'cred', 'logicalro']}
        credentials={{ r1: 'idc_svc_mysql' }}
        onCredentialOpen={onCredentialOpen}
        logicalDbCounts={counts}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Credential 수정 — 현재 idc_svc_mysql/ }));
    expect(onCredentialOpen).toHaveBeenCalledTimes(1);
  });

  it('reads a missing credential as 미설정, not as an empty cell', () => {
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1' })]}
        cols={['src', 'cred', 'logicalro']}
        credentials={{}}
        onCredentialOpen={() => {}}
        logicalDbCounts={counts}
      />,
    );
    expect(screen.getByText('미설정')).toBeTruthy();
  });
});
