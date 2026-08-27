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
  /** 어휘는 `TcStatusTag` 와 같아야 한다 — 같은 판정을 같은 화면에서 두 언어로 부르지 않는다. */
  it('renders 성공 for a credentialed row whose test passed', () => {
    render(
      <IdcConnStatusCell
        resource={view({ resourceId: 'with-cred', credentialId: 'idc_svc_mysql', connection: 'SUCCESS' })}
      />,
    );
    expect(screen.getByText('성공')).toBeTruthy();
    expect(screen.queryByText('Success')).toBeNull();
  });

  it("shows '자격 증명 필요' for a live row with no credential", () => {
    render(
      <IdcConnStatusCell
        resource={view({ resourceId: 'no-cred', credentialId: undefined, connection: 'PENDING' })}
      />,
    );
    expect(screen.getByText('자격 증명 필요')).toBeTruthy();
    expect(screen.queryByText('대기')).toBeNull();
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

  // 시안 B — 수는 값이고, 문은 이름을 가진 칸 하나다. 전에는 두 수가 각자 버튼이면서
  // 둘 다 같은 모달을 열었다: 문이 둘로 보이고 방은 하나라, 어느 쪽을 누르는지가
  // 아무것도 바꾸지 않았다.
  it('두 수는 값으로 두고, 문은 이름 붙은 설정 하나다', () => {
    const onOpen = vi.fn();
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1' })]}
        cols={['logicalro', 'src']}
        logicalDbCounts={counts}
        onLogicalOpen={onOpen}
      />,
    );
    expect(screen.queryByRole('button', { name: /연동 논리 DB 목록 보기/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /연동 제외 대상 보기/ })).toBeNull();
    const manage = screen.getByRole('button', { name: /연동 논리 DB 설정/ });
    fireEvent.click(manage);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // 건수는 실행이 말하고 제외 정책은 운영자가 쓴다 — 보고가 없다고 정책을 못 고치면
  // 안 된다. 논리 DB 0건인 리소스야말로 정책을 손봐야 하는 리소스다.
  it('보고가 없어도(—) 설정 문은 그대로 선다', () => {
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'no-summary' })]}
        cols={['logicalro', 'src']}
        logicalDbCounts={counts}
        onLogicalOpen={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /연동 논리 DB 설정/ })).toBeTruthy();
  });

  // 그룹 머리는 두 수의 관계를 한 번만 말한다 — 나란한 `대상`/`제외` 만으로는
  // 8 중 3 을 뺀 것처럼 읽힌다(deny 모델에서 둘은 다른 기준의 집계다).
  it('두 tier 머리 — 연동 논리 DB 아래 대상·제외·관리', () => {
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1' })]}
        cols={['logicalro', 'src']}
        logicalDbCounts={counts}
        onLogicalOpen={() => {}}
      />,
    );
    const group = screen.getByRole('columnheader', { name: '연동 논리 DB' });
    expect(group.getAttribute('colspan')).toBe('3');
    expect(group.getAttribute('scope')).toBe('colgroup');
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers).toContain('대상');
    expect(headers).toContain('제외');
    expect(headers).toContain('관리');
  });

  // 열 곳이 없는 화면(확인 모달)에는 관리 열이 서지 않는다 — 아무 일도 안 하는 열은
  // 712px 판에서 96px 을 그냥 먹는다.
  it('onLogicalOpen 이 없으면 관리 열도 그룹의 3번째 칸도 없다', () => {
    render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1' })]}
        cols={['logicalro']}
        logicalDbCounts={counts}
      />,
    );
    expect(screen.getByRole('columnheader', { name: '연동 논리 DB' }).getAttribute('colspan')).toBe('2');
    expect(screen.queryByRole('columnheader', { name: '관리' })).toBeNull();
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
    // 두 tier 머리에서는 **문서 순서가 곧 열 순서가 아니다** — 그룹의 잎들이 두 번째
    // `<tr>` 로 내려가므로 `getAllByRole` 의 끝은 오른쪽 끝 열이 아니라 그룹의 마지막
    // 잎이다. 열 순서를 지는 것은 선언 순서(`data-col-key`)이고, 그것으로 잰다.
    // 오른쪽 끝 열은 **첫 줄의 마지막 칸**이다. 그룹의 잎들은 둘째 줄에 있으므로 문서상
    // 마지막 `columnheader` 는 오른쪽 끝이 아니라 그룹의 마지막 잎이다.
    const topRow = container.querySelectorAll('thead tr')[0];
    expect((topRow.lastElementChild as HTMLElement).dataset.colKey).toBe('src');
    const leafKeys = Array.from(
      container.querySelectorAll('thead th[data-col-key]'),
    ).map((th) => (th as HTMLElement).dataset.colKey);

    const cells = Array.from(container.querySelectorAll('tbody td'));
    expect(cells[cells.length - 1].textContent).toContain('172.16.0.11');
    // 몸통 칸 수 = 잎 수. 그룹 머리는 칸을 하나도 내지 않는다.
    expect(cells).toHaveLength(leafKeys.length);
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

/**
 * Console shape (LIN-100) — the LIN-96 ledger's per-combination sums, pinned. The floors
 * live on the table's minWidth (a table-fixed cell ignores min-width), the single flex
 * column (접속 주소) is the sink and renders `auto`, and every other column renders its
 * ledger px. A sum drifting here means a width changed without re-checking every surface.
 */
describe('IdcResourceTable — console column spec', () => {
  // `onLogicalOpen` 은 관리 열의 존재를 정한다 — 실제 5·6·7단계 패널은 언제나 준다.
  // 주지 않는 조합(확인 모달)은 아래에서 따로 잰다.
  const shape = (
    cols: React.ComponentProps<typeof IdcResourceTable>['cols'],
    canManage = true,
  ) => {
    const { container } = render(
      <IdcResourceTable
        resources={[view({ resourceId: 'r1' })]}
        cols={cols}
        connected
        {...(canManage ? { onLogicalOpen: () => {} } : {})}
      />,
    );
    const table = container.querySelector('table') as HTMLTableElement;
    return {
      minWidth: table.style.minWidth,
      // 잎만 — 그룹 머리는 폭을 갖지 않는다(`ConsoleTableGroup`).
      //
      // ⚠️ 이 배열은 **문서 순서**다. 두 tier 머리에서 그룹의 잎들은 두 번째 `<tr>` 로
      // 내려가므로, 그룹보다 오른쪽에 있는 열(src)이 잎들보다 먼저 나온다. 여기서 고정하는
      // 것은 "각 잎이 자기 원장 px 를 그리고 싱크만 auto 다"이지 열의 좌우 순서가 아니다 —
      // 좌우 순서는 아래 `출발지` 테스트가 첫 줄의 마지막 칸으로 따로 잰다.
      widths: Array.from(container.querySelectorAll('thead th[data-col-key]')).map(
        (th) => (th as HTMLElement).style.width,
      ),
    };
  };

  it('step 5 combo holds the 1252 floor with 접속 주소 as the sink', () => {
    const { minWidth, widths } = shape(['cred', 'conn', 'logicalro', 'src']);
    expect(minWidth).toBe('1252px');
    // 시안 B: 논리 DB 가 그룹 머리 + 3열(96·96·96)이 되면서 1178 → 1252.
    // 첫 줄은 그룹 머리를 뺀 rowSpan=2 열들, 그 다음이 그룹의 잎 셋이다 — 폭은 잎이 진다.
    // endpoint(auto sink) · port · dbType · cred(264) · conn · src ‖ 대상 · 제외 · 관리
    expect(widths).toEqual([
      // 첫 줄(rowSpan=2): endpoint(auto sink) · port · dbType · cred(264) · conn · src
      'auto', '80px', '172px', '264px', '104px', '144px',
      // 둘째 줄: 대상 · 제외 · 관리
      '96px', '96px', '96px',
    ]);
  });

  it('step 2 combo holds 706, with the two once-undeclared columns now numbered', () => {
    const { minWidth, widths } = shape(['excl']);
    expect(minWidth).toBe('706px');
    // 제외 사유 142 — under table-fixed an undeclared column is a bug, not "auto slack".
    expect(widths).toEqual(['auto', '80px', '172px', '112px', '142px']);
  });

  it('steps 6·7 combo holds 884 and the 승인 모달 combo 644', () => {
    expect(shape(['logicalro', 'src']).minWidth).toBe('884px');
    // 관리 열이 없는 조합은 오히려 666 → 644 로 줄어, 712px 판의 여유가 46 → 68 이 된다.
    expect(shape(['logicalro'], false).minWidth).toBe('644px');
  });

  it('fw/health are gone from the vocabulary (owner deletion order)', () => {
    // Type-level: 'fw' is no longer an IdcTableCol — this line failing to compile is the
    // real assertion; the render check below proves no stray header survived.
    render(
      <IdcResourceTable resources={[view({ resourceId: 'r1' })]} cols={['excl']} connected />,
    );
    expect(screen.queryByText('접근 허용 상태')).toBeNull();
    expect(screen.queryByText('Status')).toBeNull();
  });
});
