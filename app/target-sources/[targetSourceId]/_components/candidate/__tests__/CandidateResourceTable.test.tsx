// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { CandidateResource } from '@/lib/types/resources';
import { CandidateResourceTable } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable';
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

// An RDS cluster connects through ONE of its member instances, so the cluster row grows
// a child row per instance and a radio to pick between them.
describe('CandidateResourceTable — RDS cluster instances', () => {
  // Uppercase WRITER / READER, as the contract sends them.
  const wireOrder = [
    { resource_id: 'arn:db:demo-1', resource_name: 'demo-1', availability_zone: 'ap-northeast-2a', cluster_member_role: 'WRITER' },
    { resource_id: 'arn:db:demo-3', resource_name: 'demo-3', availability_zone: 'ap-northeast-2c', cluster_member_role: 'READER' },
    { resource_id: 'arn:db:demo-2', resource_name: 'demo-2', availability_zone: 'ap-northeast-2b', cluster_member_role: 'READER' },
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

  // The checked radio is the whole statement — no 기본 chip beside it (owner request).
  it('checks the sorted-top instance by default', () => {
    renderCluster();
    expect(checkedInstanceValue()).toBe('arn:db:demo-2');
    expect(screen.queryByText('기본')).toBeNull();
  });

  it('reports the picked instance back to the caller', () => {
    const selectRdsInstance = vi.fn();
    renderCluster({ actions: { ...defaultProps.actions, selectRdsInstance } });
    fireEvent.click(screen.getByRole('radio', { name: '접속 인스턴스 demo-1 선택' }));
    expect(selectRdsInstance).toHaveBeenCalledWith('cluster-1', 'arn:db:demo-1');
  });

  it('honours the draft over the default', () => {
    renderCluster({
      drafts: { endpointDrafts: {}, rdsInstanceDrafts: { 'cluster-1': 'arn:db:demo-1' } },
    });
    expect(checkedInstanceValue()).toBe('arn:db:demo-1');
  });

  // The parent carries the COUNT only. Naming the chosen instance here too gave the row two
  // places to state one fact, which could disagree; the radio (선택됨 in read-only) owns it.
  it('counts instances on the cluster row without naming the chosen one', () => {
    renderCluster();
    expect(screen.getByText('3개 인스턴스')).toBeTruthy();
    // demo-2 appears once — on its own instance row, not in a parent summary.
    expect(screen.getAllByText('demo-2')).toHaveLength(1);
  });

  // The wire sends WRITER / READER; the chip must not shout them back.
  it('prettifies the member role on each instance chip', () => {
    renderCluster();
    expect(screen.getAllByText('Reader')).toHaveLength(2);
    expect(screen.getAllByText('Writer')).toHaveLength(1);
    expect(screen.queryByText('READER')).toBeNull();
    expect(screen.queryByText('WRITER')).toBeNull();
  });

  it('tags the cluster row RDS Cluster, before the name', () => {
    renderCluster();
    const tag = screen.getByText('RDS Cluster');
    const nameCell = tag.closest('td');
    expect(nameCell?.textContent?.indexOf('RDS Cluster')).toBeLessThan(
      nameCell?.textContent?.indexOf('demo-cluster') ?? -1,
    );
    // Instance rows are not clusters — exactly one tag for the one cluster.
    expect(screen.getAllByText('RDS Cluster')).toHaveLength(1);
  });

  // Radios promise a choice the payload would not carry for an unchecked cluster, so they
  // are ABSENT rather than disabled. The list itself still shows: it is what the user is
  // deciding about, and it is the evidence for leaving the cluster out.
  // Unchecked = left out of the request, so the list opens on demand (useClusterFold).
  it('lists an unchecked cluster’s instances once opened, with no radios and nothing marked', () => {
    renderCluster({ selectedIds: new Set<string>() });
    expect(screen.queryByText('demo-2')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
    expect(screen.getByText('demo-2')).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText('기본')).toBeNull();
  });

  it('starts expanded for a checked cluster and collapses from the chevron', () => {
    renderCluster();
    expect(screen.getByText('demo-2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 접기' }));
    expect(screen.queryByText('demo-2')).toBeNull();
    // The count and the tag survive the collapse.
    expect(screen.getByText('3개 인스턴스')).toBeTruthy();
    expect(screen.getByText('RDS Cluster')).toBeTruthy();
  });

  it('marks the chosen instance with a 선택됨 chip instead of radios when read-only', () => {
    renderCluster({ readonly: true });
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('선택됨')).toBeTruthy();
    // Exactly one chip: 기본 means "we chose this, you can change it", which read-only cannot
    // offer. The default instance is also the chosen one here, so both would otherwise show.
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

  it('names each instance row Instance and shows its own region', () => {
    renderCluster();
    expect(screen.getAllByText('Instance')).toHaveLength(3);
    // The Region column carries the cluster's region on the parent and each instance's OWN
    // availability zone on its child row — same column, one tier finer.
    expect(screen.getAllByText('ap-northeast-2')).toHaveLength(1);
    expect(screen.getByText('ap-northeast-2a')).toBeTruthy();
    expect(screen.getByText('ap-northeast-2b')).toBeTruthy();
    expect(screen.getByText('ap-northeast-2c')).toBeTruthy();
  });
});
