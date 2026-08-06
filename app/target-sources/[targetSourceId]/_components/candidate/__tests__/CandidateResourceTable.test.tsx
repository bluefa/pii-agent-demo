// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { CandidateResource } from '@/lib/types/resources';
import { CandidateResourceTable } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable';

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

  // Unchecked rows rest one tier dimmer (#6B7280 on the row tint, AA with margin);
  // checked rows keep full contrast. Mirrors WaitingApprovalTable's excluded-row rule.
  it('dims unselected-row text and keeps selected rows at full contrast', () => {
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
    // Name cell is index 1 (after the checkbox cell).
    expect(selectedCells[1].className).not.toContain('text-[#6B7280]');
    expect(excludedCells[1].className).toContain('text-[#6B7280]');
    expect(excludedCells[3].className).toContain('text-[#6B7280]');
    expect(excludedCells[4].className).toContain('text-[#6B7280]');
    // 설치 구분 (index 5) rides the same fact tier — the text inside dims too.
    expect(excludedCells[5].querySelector('span')?.className).toContain('text-[#6B7280]');
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

// An RDS cluster connects through ONE of its member instances, so the cluster row grows
// a child row per instance and a radio to pick between them.
describe('CandidateResourceTable — RDS cluster instances', () => {
  const wireOrder = [
    { rds_instance_arn: 'arn:db:demo-1', rds_instance_identifier: 'demo-1', region: 'ap-northeast-2', member: 'Writer' },
    { rds_instance_arn: 'arn:db:demo-3', rds_instance_identifier: 'demo-3', region: 'ap-northeast-2', member: 'Reader' },
    { rds_instance_arn: 'arn:db:demo-2', rds_instance_identifier: 'demo-2', region: 'ap-northeast-2', member: 'Reader' },
  ];

  const clusterFixture = (overrides: Partial<CandidateResource> = {}): CandidateResource =>
    candidateFixture({
      id: 'cluster-1',
      resourceId: 'arn:cluster:demo',
      resourceName: 'demo-cluster',
      type: 'AWS_DB_CLUSTER',
      behaviorKey: 'rdsInstance',
      rdsInstanceList: wireOrder,
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

  it('lists instances Reader-first then by ARN, regardless of wire order', () => {
    renderCluster();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'arn:db:demo-2',
      'arn:db:demo-3',
      'arn:db:demo-1',
    ]);
  });

  const checkedInstanceValue = (): string | undefined =>
    screen
      .getAllByRole<HTMLInputElement>('radio')
      .find((radio) => radio.checked)
      ?.value;

  it('checks the sorted-top instance by default and marks it 기본', () => {
    renderCluster();
    expect(checkedInstanceValue()).toBe('arn:db:demo-2');
    expect(screen.getByText('기본')).toBeTruthy();
  });

  it('reports the picked instance back to the caller', () => {
    const selectRdsInstance = vi.fn();
    renderCluster({ actions: { ...defaultProps.actions, selectRdsInstance } });
    fireEvent.click(screen.getByRole('radio', { name: '접속 인스턴스 demo-1 선택' }));
    expect(selectRdsInstance).toHaveBeenCalledWith('cluster-1', 'arn:db:demo-1');
  });

  it('honours the draft over the default, and drops 기본 once the user has moved off it', () => {
    renderCluster({
      drafts: { endpointDrafts: {}, rdsInstanceDrafts: { 'cluster-1': 'arn:db:demo-1' } },
    });
    expect(checkedInstanceValue()).toBe('arn:db:demo-1');
    expect(screen.queryByText('기본')).toBeNull();
  });

  it('summarises count and choice on the cluster row, so collapsing hides nothing', () => {
    renderCluster();
    expect(screen.getByText(/인스턴스 3/)).toBeTruthy();
    // The chosen identifier appears twice: the parent summary and the child row.
    expect(screen.getAllByText('demo-2').length).toBeGreaterThan(1);
  });

  // Radios promise a choice the payload would not carry for an unchecked cluster, so they
  // are ABSENT rather than disabled; the fold also closes with the checkbox.
  it('renders no radios for an unchecked cluster, and collapses its instances', () => {
    renderCluster({ selectedIds: new Set<string>() });
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText('demo-2')).toBeNull();
  });

  it('expands an unchecked cluster into an informational list with no radios', () => {
    renderCluster({ selectedIds: new Set<string>() });
    fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
    expect(screen.getByText('demo-2')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('marks the chosen instance with a 선택됨 chip instead of radios when read-only', () => {
    renderCluster({ readonly: true });
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('선택됨')).toBeTruthy();
  });

  // A cluster the backend sent no instance list for is old data — it must stay a flat row.
  it('leaves a cluster with no instance list exactly as it was', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[clusterFixture({ behaviorKey: 'default', rdsInstanceList: undefined })]}
        selectedIds={new Set(['cluster-1'])}
      />,
    );
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText(/인스턴스 /)).toBeNull();
  });

  it('names each instance row Instance and shows its own region', () => {
    renderCluster();
    expect(screen.getAllByText('Instance')).toHaveLength(3);
    // Cluster row region + one per instance row.
    expect(screen.getAllByText('ap-northeast-2')).toHaveLength(4);
  });
});
