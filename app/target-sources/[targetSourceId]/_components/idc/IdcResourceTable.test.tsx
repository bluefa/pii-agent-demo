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
 * 구분은 제 열이 아니고, 태그는 Domain 행에만 붙는다 — IP 는 값 자체가 이미 말한다.
 * 리프트는 태그 줄 높이를 되돌리는 보정이라, 태그가 그려지는 행에만 걸려야 한다.
 */
describe('IdcResourceTable — Domain 행에만 붙는 태그', () => {
  const firstCell = (r: Partial<IdcResourceView>) => {
    const { container } = render(<IdcResourceTable resources={[view(r)]} cols={['logicalro']} />);
    return container.querySelector('tbody td') as HTMLElement;
  };

  it('구분 열 없이 Domain 태그를 주소와 한 칸에 넣는다', () => {
    render(<IdcResourceTable resources={[view({ kind: 'DOMAIN', hosts: ['db.a.internal'] })]} cols={['logicalro']} />);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers).not.toContain('구분');
    expect(headers[0]).toBe('접속 주소');

    const cell = screen.getByText('db.a.internal').closest('td');
    // 태그가 남의 칸에 있으면 이 표는 열을 지운 게 아니라 옮긴 것이다.
    expect(cell?.textContent).toContain('Domain');
  });

  it('IP 행에는 태그도 리프트도 없다', () => {
    // 'IP'라 적힌 태그가 다시 생기면 표의 기본값을 매 줄 반복하는 상태로 되돌아간 것이다.
    for (const kind of ['SINGLE', 'MULTIPLE_IP'] as const) {
      const cell = firstCell({ kind, hosts: ['10.0.0.1', '10.0.0.2'].slice(0, kind === 'SINGLE' ? 1 : 2) });
      expect(cell.textContent).not.toContain('IP 행');
      expect(cell.querySelector('[class*="rounded-md"]')).toBeNull();
      // 태그가 없는데 올리면 주소만 이웃 칸 위로 12px 뜬다.
      expect(cell.innerHTML).not.toContain('-top-[12px]');
    }
  });

  it('Domain 행만 리프트를 받는다', () => {
    expect(firstCell({ kind: 'DOMAIN', hosts: ['db.a.internal'] }).innerHTML).toContain('-top-[12px]');
    // 끝점이 없는 행은 종류도 없다: 어댑터 기본값을 모양으로 단언하지 않는다.
    expect(firstCell({ kind: 'DOMAIN', hosts: [] }).textContent).toBe('—');
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
        cols={['logicalro', 'src']}
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
        cols={['logicalro', 'src']}
        logicalDbCounts={counts}
      />,
    );
    const cells = Array.from(container.querySelectorAll('tbody td')).map((td) => td.textContent);
    // 접속 주소(구분 배지 포함) / Port / Database Type / 연동 논리 DB / 연동 제외 / BDC측 출발지
    expect(cells[3]).toBe('—');
    expect(cells[4]).toBe('—');
  });

  // 출발지 자리는 cols 순서가 정한다: 마지막이면 맨 오른쪽 열이다(steps 5·6·7).
  // 헤더만 옮기고 셀을 두면 값이 남의 열 아래로 들어간다 — 둘 다 확인한다.
  it('출발지를 cols 마지막에 두면 표의 마지막 열이 된다', () => {
    const { container } = render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1' })]}
        cols={['cred', 'logicalro', 'src']}
        credentials={{ r1: 'idc_svc_mysql' }}
        onCredentialOpen={() => {}}
        logicalDbCounts={counts}
      />,
    );
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers[headers.length - 1]).toContain('BDC측 출발지');

    const cells = Array.from(container.querySelectorAll('tbody td'));
    expect(cells[cells.length - 1].textContent).toContain('172.16.0.11');
    expect(cells).toHaveLength(headers.length);
  });

  // step 3 은 그대로 앞자리 — 순서 규칙이 다른 화면까지 끌고 가지 않는다.
  it('출발지가 cols 앞이면 Database Type 다음 자리를 지킨다', () => {
    render(<IdcResourceTable resources={[view({ resourceId: 'r1' })]} cols={['src', 'excl']} />);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers[3]).toContain('BDC측 출발지');
  });

  it('drops the Credential and Connection Status columns without the `cred` col (steps 6·7)', () => {
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1', credentialId: 'idc_svc_mysql' })]}
        cols={['logicalro', 'src']}
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
        cols={['cred', 'logicalro', 'src']}
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
        cols={['cred', 'logicalro', 'src']}
        credentials={{}}
        onCredentialOpen={() => {}}
        logicalDbCounts={counts}
      />,
    );
    expect(screen.getByText('미설정')).toBeTruthy();
  });
});
