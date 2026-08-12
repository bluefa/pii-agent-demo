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
  // "instance가 8개면 어떻게 하려고 그러냐"). One line each, and the band is however long that is.
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

  it('starts collapsed, holding the region and the counts but no child names', () => {
    renderGroup(['raw_athena_db_prod', 'raw_athena_db_stg']);
    const toggle = screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 펼치기' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    const identity = toggle.closest('td') as HTMLElement;
    expect(identity.textContent).toContain('ap-northeast-2');
    // The fixture's rows are unselected, so both land on the 제외 side.
    expect(identity.textContent).toContain('데이터베이스 · 대상 0 · 제외 2');
    expect(identity.textContent).not.toContain('raw_athena_db_prod');
  });

  it('opens to the child rows the fold was hiding', () => {
    renderGroup(['raw_athena_db_prod', 'raw_athena_db_stg']);
    const toggle = screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 펼치기' });
    // The children stay MOUNTED while folded so `aria-controls` always resolves — `hidden` is
    // what the fold actually flips, and a query for their text would find them either way.
    const rows = document.getElementById(toggle.getAttribute('aria-controls') as string);
    expect(rows?.hidden).toBe(true);

    fireEvent.click(toggle);
    expect(rows?.hidden).toBe(false);
    expect(screen.getByRole('button', { name: 'Athena ap-northeast-2 그룹 접기' })).toBeTruthy();
  });
});
