// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import { CloudResourceTable } from '@/app/admin/pipelines/queue/requests/_components/CloudResourceTable';
import { required } from '@/lib/test-dom';

const row = (overrides: Partial<RequestResourceRow> = {}): RequestResourceRow => ({
  resourceId: 'arn:aws:rds:ap-northeast-2:acct:db:mysql-prod-01',
  resourceName: 'mysql-prod-01',
  selected: true,
  exclusionReason: null,
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'mysql',
  region: 'ap-northeast-2',
  idcKind: null,
  connectTargets: [],
  port: null,
  oracleSid: null,
  sourceIps: [],
  nlbIndex: null,
  resourceType: 'AWS_DB_INSTANCE',
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
  ...overrides,
});

// Writer first and readers out of resource_id order — the request's own order, which the
// table must not print back as-is.
const CANDIDATES = [
  {
    resource_id: 'arn:db:demo-1',
    resource_name: 'demo-1',
    availability_zone: 'ap-northeast-2a',
    cluster_member_role: 'WRITER',
  },
  {
    resource_id: 'arn:db:demo-3',
    resource_name: 'demo-3',
    availability_zone: 'ap-northeast-2c',
    cluster_member_role: 'READER',
  },
  {
    resource_id: 'arn:db:demo-2',
    resource_name: 'demo-2',
    availability_zone: 'ap-northeast-2b',
    cluster_member_role: 'READER',
  },
];

const clusterRow = (overrides: Partial<RequestResourceRow> = {}): RequestResourceRow =>
  row({
    resourceName: 'demo-cluster',
    resourceType: 'AWS_DB_CLUSTER',
    rdsInstanceCandidates: CANDIDATES,
    selectedRdsInstanceResourceId: 'arn:db:demo-2',
    ...overrides,
  });

/**
 * The opened instance ROWS — rows of this table since 2026-09-03, so they are found by a plain
 * row query. The cluster's own row is excluded by name: it restates the chosen member on its
 * ↳ line whenever that line is showing.
 */
const instanceRows = (): HTMLTableRowElement[] =>
  [...document.querySelectorAll<HTMLTableRowElement>('tbody tr')].filter(
    (row) => !row.textContent?.includes('demo-cluster') && /demo-\d/.test(row.textContent ?? ''),
  );

/** The instance names, in render order. */
const instanceNames = () =>
  instanceRows().flatMap((row) =>
    Array.from(row.querySelectorAll('span'))
      .map((span) => span.textContent ?? '')
      .filter((text) => /^demo-\d$/.test(text)),
  );

const columnKeys = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('thead th[data-col-key]')].map(
    (th) => th.dataset.colKey ?? '',
  );

describe('CloudResourceTable', () => {
  it('renders a plain resource row with no cluster affordances', () => {
    render(<CloudResourceTable rows={[row()]} />);
    expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    expect(screen.queryByText('RDS Cluster')).toBeNull();
    expect(instanceRows()).toHaveLength(0);
  });

  // The admin queue reviews a submitted request, so it has to show which member instance the
  // requester chose — the same three affordances steps 1·2·3 show.
  describe('RDS cluster rows', () => {
    // The tag is a statement about the RESOURCE, not about the payload: a request submitted
    // before the candidates field existed is still a cluster. Mock requests 1907's rows are
    // exactly this shape.
    it('tags a cluster whose request carried no candidates, with no instance rows', () => {
      render(
        <CloudResourceTable
          rows={[clusterRow({ rdsInstanceCandidates: [], selectedRdsInstanceResourceId: null })]}
        />,
      );
      expect(screen.getByText('RDS Cluster')).toBeTruthy();
      expect(instanceNames()).toHaveLength(0);
      // Nothing to fold, so no control offered.
      expect(screen.queryByRole('button', { name: /인스턴스 목록/ })).toBeNull();
    });

    // item 3: the rail hangs off the chevron, so the fold and the rail arrive together.
    it('starts collapsed and expands from the chevron', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      expect(instanceNames()).toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
      expect(instanceNames()).toHaveLength(3);
      // The cluster itself is still there, still tagged.
      expect(screen.getByText('demo-cluster')).toBeTruthy();
      expect(screen.getByText('RDS Cluster')).toBeTruthy();
    });

    it('tags the cluster row above its name', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      const nameCell = screen.getByText('RDS Cluster').closest('td');
      expect(nameCell?.textContent?.indexOf('RDS Cluster')).toBeLessThan(
        nameCell?.textContent?.indexOf('demo-cluster') ?? -1,
      );
      expect(screen.getAllByText('RDS Cluster')).toHaveLength(1);
    });

    // The column layout is hand-passed by each host table, so a column added to or removed from
    // the header silently knocks every instance cell one place out of register — the exact
    // defect this shape replaced.
    it('gives every instance row one cell per column of this table', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
      const keys = columnKeys();
      const rows = instanceRows();
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        const cells = [...row.querySelectorAll('td')];
        expect(cells).toHaveLength(keys.length);
        // The cluster's own answers stay blank on a member.
        expect(cells[keys.indexOf('id')]?.textContent).toBe('');
        expect(cells[keys.indexOf('dbType')]?.textContent).toBe('');
        expect(cells[keys.indexOf('reason')]?.textContent).toBe('');
      }
      expect(document.querySelectorAll('table [role="table"]')).toHaveLength(0);
    });

    it('lists instances Reader-first then by resource_id, regardless of request order', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
      expect(instanceNames()).toEqual(['demo-2', 'demo-3', 'demo-1']);
    });

    it('marks only the chosen instance 선택됨, and offers no radio', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
      expect(screen.getAllByText('선택됨')).toHaveLength(1);
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      // The chip rides the chosen instance's own ROW, not the cluster's.
      expect(
        required(screen.getByText('선택됨').closest('tr'), "the chosen instance's row").textContent,
      ).toContain('demo-2');
    });

    // Folding the band away must never be what deletes the choice — checking it is why this
    // screen exists (owner, 2026-08-13: the step-1 third line applies from step 2 on). Closed
    // (the default here, 2026-09-04) the parent's own ↳ line names it — opening the band swaps
    // to the chosen row's own `선택됨` chip.
    it('names the chosen instance on the cluster row while folded, and via the 선택됨 chip once opened', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      const clusterCell = () =>
        required(screen.getByText('demo-cluster').closest('td'), "the cluster's identity cell");
      expect(clusterCell().textContent).toContain('demo-2');

      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
      expect(instanceNames()).toHaveLength(3);
      expect(clusterCell().textContent).not.toContain('demo-2');
      expect(
        required(screen.getByText('선택됨').closest('tr'), "the chosen instance's row").textContent,
      ).toContain('demo-2');
    });

    // The whole point of the 2026-09-03 shape: the AZ is read DOWN this table's own Region
    // column instead of off a grid of the band's own, which landed it under Resource ID.
    it('shows the member role per row and the AZ in this table’s Region column', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
      // Scoped to the rows: the cluster row carries the chosen member's role too.
      const rows = instanceRows().map((row) => within(row));
      expect(rows.flatMap((row) => row.queryAllByText('Reader'))).toHaveLength(2);
      expect(rows.flatMap((row) => row.queryAllByText('Writer'))).toHaveLength(1);
      expect(screen.queryByText('WRITER')).toBeNull();
      const region = columnKeys().indexOf('region');
      expect(
        instanceRows().map((row) => row.querySelectorAll('td')[region]?.textContent),
      ).toEqual(['ap-northeast-2b', 'ap-northeast-2c', 'ap-northeast-2a']);
      // The cluster row's own Region cell still says the cluster's region.
      expect(screen.getAllByText('ap-northeast-2')).toHaveLength(1);
    });

    // An excluded cluster chose nothing; the list is still the evidence for excluding it, but
    // it starts folded (useClusterFold) — reference rather than review.
    it('folds an excluded cluster, and lists it with nothing marked once opened', () => {
      render(
        <CloudResourceTable
          rows={[
            clusterRow({
              selected: false,
              exclusionReason: '미사용 클러스터',
              selectedRdsInstanceResourceId: null,
            }),
          ]}
        />,
      );
      expect(instanceNames()).toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' }));
      expect(instanceNames()).toHaveLength(3);
      expect(screen.queryByText('선택됨')).toBeNull();
    });
  });

  /**
   * Athena is a family, not a run of rows — the same tree steps 2·3 draw over these same
   * pre-approval, DB-level rows. The parent stands for (Athena × region); its databases hang
   * under it.
   */
  describe('Athena group tree', () => {
    const athenaRow = (
      region: string,
      database: string,
      overrides: Partial<RequestResourceRow> = {},
    ): RequestResourceRow =>
      row({
        resourceId: `athena:acct:${region}:AwsDataCatalog/${database}`,
        resourceName: database,
        resourceType: 'AWS_ATHENA_DATABASE',
        databaseType: 'athena',
        region,
        ...overrides,
      });

    /** The tbody the region's chevron controls — found by either label, open or shut. */
    const childBody = (region: string): HTMLElement =>
      required(
        document.getElementById(
          required(
            screen
              .getByRole('button', { name: new RegExp(`^Athena ${region} 그룹 `) })
              .getAttribute('aria-controls'),
            'the parent chevron aria-controls',
          ),
        ),
        `the ${region} group body`,
      );

    const childRows = (region: string): HTMLTableRowElement[] => [
      ...childBody(region).querySelectorAll('tr'),
    ];

    it('draws one parent per region and hides its databases until it is opened', () => {
      render(
        <CloudResourceTable
          rows={[
            athenaRow('us-east-1', 'default'),
            athenaRow('ap-northeast-1', 'sampledb'),
            athenaRow('ap-northeast-1', 'integration'),
          ]}
        />,
      );

      // Two parents, in the order the regions first appear.
      expect(screen.getAllByText('Athena')).toHaveLength(2);
      expect(
        screen.getAllByRole('button', { name: /그룹 (펼치기|접기)$/ }).map((b) => b.getAttribute('aria-label')),
      ).toEqual(['Athena us-east-1 그룹 펼치기', 'Athena ap-northeast-1 그룹 펼치기']);

      // Closed: the children are mounted (so aria-controls resolves) but hidden as a unit.
      expect(childBody('ap-northeast-1').hasAttribute('hidden')).toBe(true);
      expect(childRows('ap-northeast-1')).toHaveLength(2);
    });

    // Two parallel counts would say 대상 twice — the 요청 대상 여부 column already answers it
    // per child. The total with the exclusion taken off it is the group's own fact.
    it('states the group total with its exclusions taken off, counted over its own rows', () => {
      render(
        <CloudResourceTable
          rows={[
            athenaRow('ap-northeast-1', 'sampledb'),
            athenaRow('ap-northeast-1', 'integration'),
            athenaRow('ap-northeast-1', 'legacy', { selected: false, exclusionReason: '미사용' }),
          ]}
        />,
      );
      const parent = required(screen.getByText('Athena').closest('tr'), 'the group parent row');
      expect(parent.textContent).toContain('Database 총 3개 중 1개 제외');
    });

    // The identity spans every column: Database Type and Region are what the group is KEYED on,
    // so filling those columns would print each of them twice on the one row that has them.
    it('spans the parent identity across every column of this table', () => {
      render(<CloudResourceTable rows={[athenaRow('us-east-1', 'default')]} />);
      const parent = required(screen.getByText('Athena').closest('tr'), 'the group parent row');
      const cells = [...parent.querySelectorAll('td')];
      expect(cells).toHaveLength(1);
      expect(cells[0]?.getAttribute('colspan')).toBe(String(columnKeys().length));
    });

    // Read DOWN the columns a child says Athena → Database, and repeats the parent's region: a
    // column is read downward, and a blank region under every database reads as "no region".
    // The id is the parent's own path with the child's name on the end, so it is dropped.
    it('says what each child IS in the Database Type column, keeps the region, drops the id', () => {
      render(
        <CloudResourceTable
          rows={[athenaRow('ap-northeast-1', 'sampledb'), athenaRow('ap-northeast-1', 'integration')]}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Athena ap-northeast-1 그룹 펼치기' }));

      const keys = columnKeys();
      const children = childRows('ap-northeast-1');
      expect(children).toHaveLength(2);
      for (const child of children) {
        const cells = [...child.querySelectorAll('td')];
        expect(cells).toHaveLength(keys.length);
        expect(cells[keys.indexOf('dbType')]?.textContent).toBe('Database');
        expect(cells[keys.indexOf('region')]?.textContent).toBe('ap-northeast-1');
        expect(cells[keys.indexOf('id')]?.textContent).toBe('');
      }
      expect(children.map((child) => child.querySelectorAll('td')[keys.indexOf('name')]?.textContent))
        .toEqual(['sampledb', 'integration']);
    });

    it('opens and closes from the parent chevron', () => {
      render(<CloudResourceTable rows={[athenaRow('us-east-1', 'default')]} />);
      expect(childBody('us-east-1').hasAttribute('hidden')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Athena us-east-1 그룹 펼치기' }));
      expect(childBody('us-east-1').hasAttribute('hidden')).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: 'Athena us-east-1 그룹 접기' }));
      expect(childBody('us-east-1').hasAttribute('hidden')).toBe(true);
    });

    // The filter owns the open state while it narrows the list: a search matching only a
    // database inside a shut group would otherwise show a region that does not visibly contain
    // what was typed. The chevron goes quiet with it rather than recording a backwards press.
    it('opens every group and retires the chevron while a filter owns the open state', () => {
      render(<CloudResourceTable rows={[athenaRow('us-east-1', 'default')]} expandGroups />);
      expect(screen.getByText('default')).toBeTruthy();
      expect(document.querySelector('tbody[hidden]')).toBeNull();
      expect(screen.queryByRole('button', { name: /그룹 (펼치기|접기)$/ })).toBeNull();
    });

    // Grouping is Athena-keyed. Everything else is 1 row = 1 resource, and the rows around a
    // group keep the order they arrived in.
    it('leaves non-Athena rows flat and unreordered around the group', () => {
      render(
        <CloudResourceTable
          rows={[row({ resourceName: 'mysql-prod-01' }), athenaRow('us-east-1', 'default'), clusterRow()]}
        />,
      );
      expect(screen.getAllByText('Athena')).toHaveLength(1);
      expect(screen.getByText('mysql-prod-01')).toBeTruthy();
      expect(screen.getByText('RDS Cluster')).toBeTruthy();
      // The cluster's own fold is untouched by grouping.
      expect(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 펼치기' })).toBeTruthy();
      // `default` is inside the shut group body; the two flat rows are in a plain one.
      expect(required(screen.getByText('default').closest('tbody'), "the group's body").hasAttribute('hidden')).toBe(true);
      for (const name of ['mysql-prod-01', 'demo-cluster']) {
        expect(
          required(screen.getByText(name).closest('tbody'), `${name}'s body`).hasAttribute('hidden'),
        ).toBe(false);
      }
    });
  });
});
