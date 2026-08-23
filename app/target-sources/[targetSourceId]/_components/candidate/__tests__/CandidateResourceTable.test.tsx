// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { CandidateResource } from '@/lib/types/resources';
import { CandidateResourceTable } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable';
import { rdsInstanceBandLabel } from '@/app/target-sources/[targetSourceId]/_components/shared/RdsInstancePanel';
import { required } from '@/lib/test-dom';
import { textColors, verdictRail } from '@/lib/theme';

const candidateFixture = (overrides: Partial<CandidateResource> = {}): CandidateResource =>
  ({
    id: 'c-1',
    resourceId: 'res-1',
    resourceName: 'res-1',
    type: 'RDS',
    databaseType: 'MYSQL',
    integrationCategory: 'TARGET',
    behaviorKey: 'default',
    selected: false,
    exclusionReason: null,
    recommendFailReason: null,
    metadata: {
      provider: 'AWS',
      resourceType: 'RDS',
      region: 'ap-northeast-2',
    },
    ...overrides,
  }) satisfies CandidateResource;

const defaultProps = {
  candidates: [candidateFixture()],
  selectedIds: new Set<string>(),
  exclusionReasons: {},
  drafts: { endpointDrafts: {}, rdsInstanceDrafts: {} },
  expandedResourceId: null,
  readonly: false,
  actions: {
    toggleSelected: () => {},
    reasonChipClick: () => {},
    expandToggle: () => {},
    endpointSave: () => {},
    selectRdsInstance: () => {},
    editManualEc2: () => {},
    deleteManualEc2: () => {},
  },
};

describe('CandidateResourceTable', () => {
  it('renders the step-2·3 column order: identity → attributes → system verdict → decision', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      '', // checkbox column
      'Resource Name',
      'Resource ID',
      'Database Type',
      'Region',
      '설치 구분',
      '제외 사유',
    ]);
  });

  // The 설치 구분 header carries a (?) help tooltip explaining the system-verdict
  // taxonomy — each value's meaning plus the selection rule it implies.
  it('explains the 설치 구분 taxonomy from the header help icon', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    const trigger = screen.getByRole('button', { name: '설치 구분 안내' });
    fireEvent.mouseEnter(trigger.parentElement!);
    expect(screen.getByText('설치 구분 안내')).toBeTruthy();
    expect(screen.getByText(/직접 변경할 수 없어요/)).toBeTruthy();
    expect(screen.getByText(/제외하려면 제외 사유를 입력해야 해요/)).toBeTruthy();
    expect(screen.getByText(/DB 서버를 운영하고 있다면 연동 대상이 맞아요/)).toBeTruthy();
    expect(screen.getByText(/선택할 수 없고, 행의 설치 불가 라벨을 누르면/)).toBeTruthy();
  });

  it('does not render the 스캔 이력 column (dropped per prototype)', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    expect(screen.queryByRole('columnheader', { name: '스캔 이력' })).toBeNull();
  });

  // The checkbox IS the verdict — the 대상/비대상 badge column and the always-empty
  // 연동 완료 여부 column were deleted in the step-2·3 grammar port.
  it('renders no verdict badge column and no 연동 완료 여부 column', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    expect(screen.queryByRole('columnheader', { name: '연동 대상 여부' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: '연동 완료 여부' })).toBeNull();
    expect(screen.queryByText('대상')).toBeNull();
  });

  // 미선택 행도 본문은 선택 행과 같은 강도로 읽는다 — 표시는 왼쪽 레일이 맡는다.
  // checked rows keep full contrast. Mirrors WaitingApprovalTable's excluded-row rule.
  it('marks an unselected row with the left rail and keeps all row text at full contrast', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[
          candidateFixture({ id: 'c-sel', resourceId: 'res-sel' }),
          candidateFixture({ id: 'c-exc', resourceId: 'res-exc' }),
        ]}
        selectedIds={new Set(['c-sel'])}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    const selectedCells = rows[0].querySelectorAll('td');
    const excludedCells = rows[1].querySelectorAll('td');
    // 표시는 체크박스 셀(index 0)의 레일이 혼자 한다 — 선택 행에는 없다.
    expect(selectedCells[0].className).not.toContain(verdictRail.excluded);
    expect(excludedCells[0].className).toContain(verdictRail.excluded);
    // 미선택이라고 글자를 흐리게 하지 않는다: 검토해야 하는 행이다.
    expect(excludedCells[1].className).not.toContain(textColors.tertiary);
    expect(excludedCells[3].className).not.toContain(textColors.tertiary);
    expect(excludedCells[4].className).not.toContain(textColors.tertiary);
  });

  // integration_category is a SYSTEM fact, spoken only in the 설치- word family so
  // it can never be read as the user's selection (which speaks 연동 요청-).
  it('renders the 설치 구분 cell per integration_category, with the 안내 entry on 설치 불가', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[
          candidateFixture({ id: 'c-target', resourceId: 'res-target' }),
          candidateFixture({ id: 'c-noinstall', resourceId: 'res-noinstall', integrationCategory: 'NO_INSTALL_NEEDED' }),
          candidateFixture({ id: 'c-inel', resourceId: 'res-inel', integrationCategory: 'INSTALL_INELIGIBLE' }),
        ]}
      />,
    );
    expect(screen.getByText('설치 대상')).toBeTruthy();
    expect(screen.getByText('설치 선택')).toBeTruthy();
    // 설치 불가 is the one action-blocking value — it carries the guide entry point.
    expect(screen.getByRole('button', { name: '설치 불가 사유 안내 보기' })).toBeTruthy();
  });

  it('does not render the deleted 스캔 상태 column or its tags', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[candidateFixture({ scanStatus: 'NEW_SCAN' })]}
      />,
    );
    expect(screen.queryByRole('columnheader', { name: '스캔 상태' })).toBeNull();
    expect(screen.queryByText('신규')).toBeNull();
  });

  it('renders a hover-revealed CopyButton on each Resource ID cell', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[candidateFixture({ resourceId: 'res-1' })]}
      />,
    );
    const button = screen.getByRole('button', { name: 'Resource ID 복사' });
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('group-hover/resid:opacity-100');
  });

  // A server-seeded unselected TARGET without a reason must expose a direct entry
  // point to the reason picker — approval is blocked until a reason exists.
  it('renders a 사유 입력 entry point for an unselected TARGET without a reason', () => {
    const reasonChipClick = vi.fn();
    render(
      <CandidateResourceTable
        {...defaultProps}
        actions={{ ...defaultProps.actions, reasonChipClick }}
      />,
    );
    const entry = screen.getByRole('button', { name: '제외 사유 입력' });
    fireEvent.click(entry);
    expect(reasonChipClick).toHaveBeenCalledWith('c-1', expect.any(HTMLElement));
  });

  it('does not render the 사유 입력 entry point for selected or non-TARGET rows', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[
          candidateFixture({ id: 'c-sel', resourceId: 'res-sel' }),
          candidateFixture({ id: 'c-inel', resourceId: 'res-inel', integrationCategory: 'INSTALL_INELIGIBLE' }),
        ]}
        selectedIds={new Set(['c-sel'])}
      />,
    );
    expect(screen.queryByRole('button', { name: '제외 사유 입력' })).toBeNull();
  });

  // 설치 불가는 스캔의 판정이지 사용자의 제외가 아니다. 체크박스가 잠긴 행의 사유만 고쳐
  // 쓸 수 있으면, 판정을 사람 말로 덮은 채 승인 요청이 나간다.
  it('shows an ineligible verdict as a read-only chip — never a 제외 사유 수정 button', () => {
    const reasonChipClick = vi.fn();
    render(
      <CandidateResourceTable
        {...defaultProps}
        actions={{ ...defaultProps.actions, reasonChipClick }}
        candidates={[
          candidateFixture({
            id: 'c-inel',
            resourceId: 'res-inel',
            integrationCategory: 'INSTALL_INELIGIBLE',
            recommendFailReason: 'AZURE_RESOURCE_VNET_INTEGRATED_MODE',
          }),
        ]}
        // 서버가 되돌려준 값이 판정 코드 그대로인 경로 — 이 값이 있어도 편집구가 생기면 안 된다.
        exclusionReasons={{ 'c-inel': 'AZURE_RESOURCE_VNET_INTEGRATED_MODE' }}
      />,
    );
    expect(screen.queryByRole('button', { name: '제외 사유 수정' })).toBeNull();
    // 원문 enum 이 아니라 steps 2·3 과 같은 한 줄이 선다.
    expect(screen.getByText('VNet 통합 모드')).toBeTruthy();
    expect(screen.queryByText('AZURE_RESOURCE_VNET_INTEGRATED_MODE')).toBeNull();
    expect(reasonChipClick).not.toHaveBeenCalled();
  });

  // 사용자가 직접 뺀 행은 그대로 고칠 수 있어야 한다 — 위 규칙이 제외 편집 전체를 막으면 안 된다.
  it('keeps the 제외 사유 수정 button for a user-excluded TARGET row', () => {
    const reasonChipClick = vi.fn();
    render(
      <CandidateResourceTable
        {...defaultProps}
        actions={{ ...defaultProps.actions, reasonChipClick }}
        exclusionReasons={{ 'c-1': '스테이징 DB라 제외합니다' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '제외 사유 수정' }));
    expect(reasonChipClick).toHaveBeenCalledWith('c-1', expect.any(HTMLElement));
  });

  it('does not render a pagination row, and shows every candidate (v16 cloud step-1 has no pager)', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      candidateFixture({ id: `c-${i}`, resourceId: `res-${i}` }),
    );
    render(<CandidateResourceTable {...defaultProps} candidates={many} />);
    // No page-size selector → no pagination row at all.
    expect(screen.queryByLabelText('페이지당 표시 건수')).toBeNull();
    // All 12 rows render (no 10-per-page slicing).
    expect(screen.getAllByRole('button', { name: 'Resource ID 복사' })).toHaveLength(12);
    // The approve CTA lives in CandidateResourceSection's CardActionBar now (C-2).
    expect(screen.queryByRole('button', { name: '연동 대상 승인 요청' })).toBeNull();
  });
});

// The kind tag keys on the resource TYPE, not on `behaviorKey: 'manualEc2'`. That key exists
// only in step 1's component state, so keying on it dropped the tag the moment the page
// reloaded and never carried it to steps 2–7 or admin. A scan can also surface an EC2 instance
// on its own, and that row has to say what it is too.
describe('CandidateResourceTable — EC2 kind tag', () => {
  it('tags an EC2 instance that carries no manual-add behavior key', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[
          candidateFixture({
            id: 'i-0a1b2c3d4e5f67890',
            resourceId: 'i-0a1b2c3d4e5f67890',
            resourceName: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
            type: 'AWS_EC2_INSTANCE',
            integrationCategory: 'NO_INSTALL_NEEDED',
            behaviorKey: 'default',
          }),
        ]}
      />,
    );
    expect(screen.getByText('EC2')).toBeTruthy();
  });

  it('leaves every other resource type untagged', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    expect(screen.queryByText('EC2')).toBeNull();
  });
});

// An RDS cluster connects through ONE of its member instances. The instances are NOT rows —
// three of the table's columns say nothing about them and the two things a user compares
// (endpoint, AZ) have no column at all — so the row states the chosen one and the comparison
// happens in a band the row's chevron opens under it.
describe('CandidateResourceTable — RDS cluster instances', () => {
  // Uppercase WRITER / READER, as the contract sends them.
  const wireOrder = [
    { resource_id: 'arn:db:demo-1', resource_name: 'demo-1', host: 'demo-1.cluster.rds', port: 3306, availability_zone: 'ap-northeast-2a', cluster_member_role: 'WRITER' },
    { resource_id: 'arn:db:demo-3', resource_name: 'demo-3', host: 'demo-3.cluster-ro.rds', port: 3306, availability_zone: 'ap-northeast-2c', cluster_member_role: 'READER' },
    { resource_id: 'arn:db:demo-2', resource_name: 'demo-2', host: 'demo-2.cluster-ro.rds', port: 3306, availability_zone: 'ap-northeast-2b', cluster_member_role: 'READER' },
  ];

  const clusterFixture = (overrides: Partial<CandidateResource> = {}): CandidateResource =>
    candidateFixture({
      id: 'cluster-1',
      resourceId: 'arn:cluster:demo',
      resourceName: 'demo-cluster',
      type: 'AWS_DB_CLUSTER',
      behaviorKey: 'rdsInstance',
      rdsInstanceCandidates: wireOrder,
      ...overrides,
    });

  const renderCluster = (props: Partial<typeof defaultProps> = {}) =>
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[clusterFixture()]}
        selectedIds={new Set(['cluster-1'])}
        {...props}
      />,
    );

  const openBand = () =>
    fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));

  const checkedInstanceValue = (): string | undefined =>
    screen
      .getAllByRole<HTMLInputElement>('radio')
      .find((radio) => radio.checked)
      ?.value;

  // colSpan is hand-passed by each host table (`showCheckboxColumn ? 7 : 5` here), so a column
  // added to or removed from the header silently leaves the band short or overflowing.
  it('spans the band across every column of this table', () => {
    renderCluster();
    openBand();
    const band = required(
      screen.getByRole('table', { name: rdsInstanceBandLabel('demo-cluster') }).closest('td'),
      "the band's spanning cell",
    );
    expect(Number(band.getAttribute('colspan'))).toBe(
      document.querySelectorAll('thead th').length,
    );
  });

  // The owner's rule (2026-08-11): folding cuts row COUNT, never information. A cluster row
  // that folded its instances away and said nothing about them would have deleted the answer
  // to the only question the row asks.
  it('states the chosen instance and its role on the collapsed cluster row', () => {
    renderCluster();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    const nameCell = screen.getByText('demo-cluster').closest('td');
    expect(nameCell?.textContent).toContain('demo-2');
    // The role rides beside the instance name; it never gets a column of its own.
    expect(nameCell?.textContent).toContain('Reader');
  });

  // The chevron is what says the cluster holds a choice at all — a row without one reads as a
  // plain row and nobody looks inside it (owner, 2026-08-12).
  it('opens the instance band from the cluster row’s chevron, folded on load', () => {
    renderCluster();
    expect(screen.queryByText('엔드포인트')).toBeNull();

    openBand();
    expect(screen.getByText('엔드포인트')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 접기' }));
    expect(screen.queryByText('엔드포인트')).toBeNull();
  });

  it('lists instances Reader-first then by ARN, regardless of wire order', () => {
    renderCluster();
    openBand();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'arn:db:demo-2',
      'arn:db:demo-3',
      'arn:db:demo-1',
    ]);
  });

  // The checked radio is the whole statement — no 기본 chip beside it (owner request).
  it('checks the sorted-top instance by default', () => {
    renderCluster();
    openBand();
    expect(checkedInstanceValue()).toBe('arn:db:demo-2');
    expect(screen.queryByText('기본')).toBeNull();
  });

  it('reports the picked instance back to the caller', () => {
    const selectRdsInstance = vi.fn();
    renderCluster({ actions: { ...defaultProps.actions, selectRdsInstance } });
    openBand();
    fireEvent.click(screen.getByRole('radio', { name: '접속 인스턴스 demo-1 선택' }));
    expect(selectRdsInstance).toHaveBeenCalledWith('cluster-1', 'arn:db:demo-1');
  });

  it('honours the draft over the default', () => {
    renderCluster({
      drafts: { endpointDrafts: {}, rdsInstanceDrafts: { 'cluster-1': 'arn:db:demo-1' } },
    });
    // The row states the drafted instance, and the band opens on it.
    expect(screen.getByText('demo-cluster').closest('td')?.textContent).toContain('demo-1');
    openBand();
    expect(checkedInstanceValue()).toBe('arn:db:demo-1');
  });

  // Endpoint and AZ are exactly what the table has no column for — they are the reason the
  // band exists, so it must be the place they finally appear.
  it('shows the endpoint and AZ the table has no column for', () => {
    renderCluster();
    openBand();
    expect(screen.getByText('demo-2.cluster-ro.rds:3306')).toBeTruthy();
    expect(screen.getByText('ap-northeast-2b')).toBeTruthy();
    // The engine is NOT repeated per instance — every member runs the cluster's engine, and
    // the cluster row's own Database Type cell says it once.
    expect(screen.getAllByText('MySQL')).toHaveLength(1);
  });

  // The wire sends WRITER / READER; the chip must not shout them back.
  it('prettifies the member role on each instance chip', () => {
    renderCluster();
    openBand();
    // 2 Readers + 1 Writer in the panel, plus the chosen Reader restated on the row.
    expect(screen.getAllByText('Reader')).toHaveLength(3);
    expect(screen.getAllByText('Writer')).toHaveLength(1);
    expect(screen.queryByText('READER')).toBeNull();
    expect(screen.queryByText('WRITER')).toBeNull();
  });

  // An Aurora cluster carries a writer and up to fifteen readers. A fixed tile grid turns that
  // into ragged rows of cards — a layout that assumes the count is small (owner, 2026-08-12:
  // what happens at eight?). One line each, and the band is however long that adds up to.
  it('grows one line per instance — eight instances, eight lines', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({
      resource_id: `arn:db:demo-${i + 1}`,
      resource_name: `demo-${i + 1}`,
      host: `demo-${i + 1}.cluster-ro.rds`,
      port: 3306,
      availability_zone: 'ap-northeast-2a',
      cluster_member_role: i === 0 ? 'WRITER' : 'READER',
    }));
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[clusterFixture({ rdsInstanceCandidates: eight })]}
        selectedIds={new Set(['cluster-1'])}
      />,
    );
    openBand();
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    // Every line fills all three of the band's own columns — no wrapping into a second grid row.
    expect(screen.getAllByText('demo-8.cluster-ro.rds:3306')).toHaveLength(1);
  });

  it('tags the cluster row RDS Cluster, before the name', () => {
    renderCluster();
    const tag = screen.getByText('RDS Cluster');
    const nameCell = tag.closest('td');
    expect(nameCell?.textContent?.indexOf('RDS Cluster')).toBeLessThan(
      nameCell?.textContent?.indexOf('demo-cluster') ?? -1,
    );
    expect(screen.getAllByText('RDS Cluster')).toHaveLength(1);
  });

  // Radios promise a choice the payload would not carry for an unchecked cluster, so they
  // are ABSENT rather than disabled. The list itself still opens: it is the evidence for
  // leaving the cluster out.
  it('offers an unchecked cluster’s list with no radios and nothing marked', () => {
    renderCluster({ selectedIds: new Set<string>() });
    // Nothing is submitted, so nothing is named — the count is what the row can honestly say.
    expect(screen.getByText('demo-cluster').closest('td')?.textContent).toContain('인스턴스 3건');

    openBand();
    expect(screen.getByText('demo-2')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText('선택됨')).toBeNull();
  });

  it('marks the chosen instance with a 선택됨 chip instead of radios when read-only', () => {
    renderCluster({ readonly: true });
    openBand();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('선택됨')).toBeTruthy();
    expect(screen.queryByText('기본')).toBeNull();
  });

  // A cluster the backend sent no instance list for is old data — it must stay a flat row.
  it('leaves a cluster with no instance list exactly as it was', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[clusterFixture({ behaviorKey: 'default', rdsInstanceCandidates: undefined })]}
        selectedIds={new Set(['cluster-1'])}
      />,
    );
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText(/인스턴스 /)).toBeNull();
  });
});

/**
 * The console-table spec (LIN-98). Floors are the LIN-96 ledger's — the assertions quote them
 * (select 52 [the legacy column's real min-content, 18+16+18 — the px the RdsInstancePanel
 * tier constants are built on] · name 250 · id 186 · dbType 142 · region 156 · category 112
 * [measured on TS 1006] · reason 160). name+id flex; id, the declaration-order last, is the
 * sink and renders `auto`; name renders its floor's share of the sum to 4 decimals (CSSOM
 * re-serializes `style.width`, dropping trailing zeros — neither shape's share has one).
 */
describe('CandidateResourceTable — console spec', () => {
  it('declares the edit shape: minWidth 1058, name 23.6295%, id auto', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    const table = required(screen.getAllByRole('table')[0], 'the candidate table');
    expect((table as HTMLElement).style.minWidth).toBe('1058px');
    const widths = [...table.querySelectorAll('thead th')].map(
      (th) => (th as HTMLElement).style.width,
    );
    expect(widths).toEqual(['52px', '23.6295%', 'auto', '142px', '156px', '112px', '160px']);
  });

  it('declares the read-only shape: minWidth 846, no decision columns', () => {
    render(<CandidateResourceTable {...defaultProps} readonly />);
    const table = required(screen.getAllByRole('table')[0], 'the candidate table');
    expect((table as HTMLElement).style.minWidth).toBe('846px');
    const widths = [...table.querySelectorAll('thead th')].map(
      (th) => (th as HTMLElement).style.width,
    );
    expect(widths).toEqual(['29.5508%', 'auto', '142px', '156px', '112px']);
  });

  // The checkbox column is a structural gutter, not a data column: its width is a layout
  // constant, so it gets no drag handle — and the seam tracer skips its edge via the marker.
  it('gives every data column a resize handle but never the checkbox gutter', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    expect(screen.getByRole('separator', { name: 'Resource Name 열 너비 조절' })).toBeTruthy();
    expect(screen.getByRole('separator', { name: '제외 사유 열 너비 조절' })).toBeTruthy();
    expect(screen.queryByRole('separator', { name: '선택 열 너비 조절' })).toBeNull();
    const selectTh = screen.getAllByRole('columnheader')[0];
    expect(selectTh.hasAttribute('data-static-col')).toBe(true);
  });

  // The gutter's BODY cells opt out of the boundary grammar the same way (owner,
  // 2026-08-23: no divider between the checkbox and Resource Name) — the marker is what
  // `consoleGrid` keys its "no rail after / no shadow band" exclusions on.
  it('marks every gutter cell static so the boundary grammar skips it', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    const table = required(screen.getAllByRole('table')[0], 'the candidate table');
    const rows = [...table.querySelectorAll('tbody tr')]
      .map((tr) => tr as HTMLTableRowElement)
      .filter((tr) => tr.cells.length > 1);
    expect(rows.length).toBeGreaterThan(0);
    for (const tr of rows) {
      expect(tr.cells[0].hasAttribute('data-static-col')).toBe(true);
      expect(tr.cells[1].hasAttribute('data-static-col')).toBe(false);
    }
  });

  /**
   * The column owns the truncation point (LIN-97's HostCell verdict): a per-cell px cap
   * would survive a drag and make widening the column reveal nothing. All THREE name
   * branches must agree — the first migration of steps 2·3 switched only one and left the
   * other two clamped at 200px while their column flexed past 600.
   */
  it('caps no name branch and no reason chip at a px width', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[
          candidateFixture({ id: 'c-plain', resourceId: 'res-plain' }),
          candidateFixture({
            id: 'c-ec2',
            resourceId: 'i-0a1b2c3d4e5f67890',
            resourceName: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
            type: 'AWS_EC2_INSTANCE',
            integrationCategory: 'NO_INSTALL_NEEDED',
          }),
          candidateFixture({
            id: 'c-cluster',
            resourceId: 'arn:cluster:demo',
            resourceName: 'demo-cluster',
            type: 'AWS_DB_CLUSTER',
            behaviorKey: 'rdsInstance',
            rdsInstanceCandidates: [
              { resource_id: 'arn:db:demo-1', resource_name: 'demo-1', host: 'demo-1.rds', port: 3306, availability_zone: 'ap-northeast-2a', cluster_member_role: 'WRITER' },
            ],
          }),
        ]}
        exclusionReasons={{ 'c-plain': '스테이징 DB라 제외합니다' }}
      />,
    );
    for (const name of ['res-plain', 'ip-10-10-1-24.ap-northeast-2.compute.internal', 'demo-cluster']) {
      // The nearest w-full ancestor of the name text is the tooltip trigger (NAME_TRIGGER).
      const trigger = required(
        screen.getByText(name).closest('[class*="w-full"]'),
        `${name}'s tooltip trigger`,
      );
      expect(trigger.className).toContain('min-w-0');
      expect(trigger.className).not.toMatch(/max-w-\[\d+px\]/);
    }
    const reasonChip = required(
      screen.getByRole('button', { name: '제외 사유 수정' }),
      'the editable reason chip',
    );
    expect(reasonChip.className).toContain('max-w-full');
    expect(reasonChip.className).not.toMatch(/max-w-\[\d+px\]/);
  });
});

/**
 * While a search or filter narrows the list, the filter owns the fold: a match inside a
 * collapsed group is invisible (reproduced on TS 1006 — searching the one Athena child left
 * a folded parent and no match on screen), so every group opens and the chevron becomes an
 * indicator rather than a control that records presses against the cleared filter.
 */
describe('CandidateResourceTable — expandFolds while filtering', () => {
  const athena = (id: string, name: string): CandidateResource =>
    candidateFixture({
      id,
      resourceId: `athena:1234:ap-northeast-2/AwsDataCatalog/${name}`,
      resourceName: name,
      type: 'ATHENA',
      databaseType: 'ATHENA',
      metadata: { provider: 'AWS', resourceType: 'ATHENA', region: 'ap-northeast-2' },
    });

  it('forces the group open and demotes the chevron to an indicator', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[athena('a-0', 'raw_athena_db_prod')]}
        expandFolds
      />,
    );
    // No live toggle — the static chevron is aria-hidden, so no 그룹 button exists at all.
    expect(screen.queryByRole('button', { name: /그룹/ })).toBeNull();
    // The child rows are visible: the tbody the fold used to hide is not hidden.
    expect(
      required(
        screen.getByText('raw_athena_db_prod').closest('tbody'),
        "the group's child tbody",
      ).hidden,
    ).toBe(false);
  });

  it('returns the fold to the table when the filter clears', () => {
    const { rerender } = render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[athena('a-0', 'raw_athena_db_prod')]}
        expandFolds
      />,
    );
    rerender(
      <CandidateResourceTable {...defaultProps} candidates={[athena('a-0', 'raw_athena_db_prod')]} />,
    );
    // Nothing selected → the owner's collapsed default, untouched by the filtered interlude.
    const toggle = screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 펼치기' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});

// Athena groups start COLLAPSED (owner, 2026-08-11). The parent names the group and how many
// databases it holds on each side of the decision; it does NOT list their names — that line was
// tried and cut (owner, 2026-08-12), because a folded row that spells out its children is a
// row-count saving that pays itself back in text.
describe('CandidateResourceTable — Athena groups', () => {
  const athenaFixture = (id: string, name: string): CandidateResource =>
    candidateFixture({
      id,
      resourceId: `athena:1234:ap-northeast-2/AwsDataCatalog/${name}`,
      resourceName: name,
      type: 'ATHENA',
      databaseType: 'ATHENA',
      metadata: { provider: 'AWS', resourceType: 'ATHENA', region: 'ap-northeast-2' },
    });

  const renderGroup = (names: readonly string[]) =>
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={names.map((name, index) => athenaFixture(`a-${index}`, name))}
      />,
    );

  it('starts collapsed, holding the region but no child names', () => {
    renderGroup(['raw_athena_db_prod', 'raw_athena_db_stg']);
    const toggle = screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 펼치기' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    const identity = required(toggle.closest('td'), "the group's identity cell");
    expect(identity.textContent).toContain('ap-northeast-2');
    // 집계 줄(데이터베이스 · 대상 N · 제외 N)은 이 표에서 내렸다 — 같은 숫자를 표 아래
    // 깔때기(ScanStrip)와 액션바가 이미 말한다. 그룹 머리는 정체성만 진다.
    expect(identity.textContent).not.toContain('데이터베이스');
    expect(identity.textContent).not.toContain('raw_athena_db_prod');
  });

  it('opens to the child rows the fold was hiding', () => {
    renderGroup(['raw_athena_db_prod', 'raw_athena_db_stg']);
    const toggle = screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 펼치기' });
    // The children stay MOUNTED while folded so `aria-controls` always resolves — `hidden` is
    // what the fold actually flips, and a query for their text would find them either way.
    const rows = document.getElementById(required(toggle.getAttribute('aria-controls'), 'aria-controls on the group toggle'));
    expect(rows?.hidden).toBe(true);

    fireEvent.click(toggle);
    expect(rows?.hidden).toBe(false);
    expect(screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 접기' })).toBeTruthy();

    // Each child repeats the region (owner, 2026-08-12): the column is read down, and a blank
    // cell beside every database reads as "no region".
    // Checkbox(0) · Name(1) · ID(2) · DB Type(3) · Region(4) · 설치 구분(5) · 제외 사유(6).
    const childCells = rows?.querySelectorAll('tr')[0].querySelectorAll('td');
    expect(childCells?.[4].textContent).toBe('ap-northeast-2');
  });

  /**
   * The fold must never hide the control that unblocks the approval CTA.
   *
   * An unselected TARGET without an exclusion reason DISABLES the CTA
   * (`listMissingExclusionReasons`), and the only control that clears it — 사유 입력 — sits on
   * that resource's own row. Collapsed by default put that row inside a `hidden` tbody, which
   * takes it out of the accessibility tree as well: the CTA named a resource the user had no
   * way to reach except by guessing which group to open.
   */
  describe('a group holding a row that blocks the approval CTA', () => {
    const renderBlocked = () =>
      render(
        <CandidateResourceTable
          {...defaultProps}
          candidates={[
            candidateFixture({ id: 'plain-1', resourceId: 'res-plain', resourceName: 'res-plain' }),
            athenaFixture('a-0', 'raw_athena_db_prod'),
          ]}
          // Something IS selected, so the CTA's next unmet condition is the missing reason.
          selectedIds={new Set(['plain-1'])}
        />,
      );

    it('opens on its own so 사유 입력 is reachable', () => {
      renderBlocked();
      const toggle = screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 접기' });
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      const rows = document.getElementById(required(toggle.getAttribute('aria-controls'), 'aria-controls on the group toggle'));
      expect(rows?.hidden).toBe(false);
      expect(screen.getByText('raw_athena_db_prod')).toBeTruthy();
      // Two rows own one: the plain resource is selected, so only the Athena child asks.
      expect(screen.getAllByRole('button', { name: '제외 사유 입력' })).toHaveLength(1);
    });

    // The derived default is a DEFAULT, not a lock — a dead chevron is worse than a folded group.
    it('still closes from the chevron', () => {
      renderBlocked();
      fireEvent.click(screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 접기' }));

      const toggle = screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 펼치기' });
      expect(
        document.getElementById(required(toggle.getAttribute('aria-controls'), 'aria-controls on the group toggle'))?.hidden,
      ).toBe(true);
    });

    // With nothing selected the CTA asks for a selection first and no reason is owed yet, so an
    // untouched table still opens fully collapsed — the owner's rule for this step.
    it('stays collapsed while nothing is selected', () => {
      renderGroup(['raw_athena_db_prod']);
      expect(
        screen
          .getByRole('button', { name: 'Athena ap-northeast-2 그룹 펼치기' })
          .getAttribute('aria-expanded'),
      ).toBe('false');
    });
  });
});
