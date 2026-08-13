// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import { CloudResourceTable } from '@/app/admin/pipelines/queue/requests/_components/CloudResourceTable';
import { rdsInstanceBandLabel } from '@/app/target-sources/[targetSourceId]/_components/shared/RdsInstancePanel';
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
 * The instance names, in render order. They are not rows of the OUTER table — the members live
 * in the accordion body (`RdsInstancePanel`), which carries its own table roles, so they are
 * read out of that band and never off a page-wide row query.
 */
const instanceNames = () => {
  const band = screen.queryByRole('table', { name: rdsInstanceBandLabel('demo-cluster') });
  if (!band) return [];
  return Array.from(band.querySelectorAll('span'))
    .map((span) => span.textContent ?? '')
    .filter((text) => /^demo-\d$/.test(text));
};

describe('CloudResourceTable', () => {
  it('renders a plain resource row with no cluster affordances', () => {
    render(<CloudResourceTable rows={[row()]} />);
    expect(screen.getByText('mysql-prod-01')).toBeTruthy();
    expect(screen.queryByText('RDS Cluster')).toBeNull();
    expect(screen.queryByText('가용 영역')).toBeNull();
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
    it('starts expanded and collapses from the chevron', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      expect(instanceNames()).toHaveLength(3);

      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 접기' }));
      expect(instanceNames()).toHaveLength(0);
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

    // colSpan is hand-passed by each host table (`colSpan={6}` here), so a column added to or
    // removed from the header silently leaves the band short or overflowing.
    it('spans the band across every column of this table', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      const band = required(
        screen.getByRole('table', { name: rdsInstanceBandLabel('demo-cluster') }).closest('td'),
        "the band's spanning cell",
      );
      expect(Number(band.getAttribute('colspan'))).toBe(
        document.querySelectorAll('thead th').length,
      );
    });

    it('lists instances Reader-first then by resource_id, regardless of request order', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      expect(instanceNames()).toEqual(['demo-2', 'demo-3', 'demo-1']);
    });

    it('marks only the chosen instance 선택됨, and offers no radio', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      expect(screen.getAllByText('선택됨')).toHaveLength(1);
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      // The chip rides the chosen instance's own LINE, not the band.
      expect(screen.getByText('선택됨').closest('div')?.textContent).toContain('demo-2');
    });

    // Folding the band away must never be what deletes the choice — checking it is why this
    // screen exists (owner, 2026-08-13: the step-1 third line applies from step 2 on).
    it('names the chosen instance on the cluster row, folded or not', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      expect(screen.getByText('demo-cluster').closest('td')?.textContent).toContain('demo-2');

      fireEvent.click(screen.getByRole('button', { name: 'demo-cluster 인스턴스 목록 접기' }));
      expect(instanceNames()).toHaveLength(0);
      expect(screen.getByText('demo-cluster').closest('td')?.textContent).toContain('demo-2');
    });

    // The band is why the columns can say this at all: as rows of the outer table the AZ was
    // filed under the Region header and the endpoint had nowhere to go.
    it('gives each instance its own labelled AZ and endpoint columns', () => {
      render(<CloudResourceTable rows={[clusterRow()]} />);
      // Scoped to the band: the cluster row carries the chosen member's role too.
      const band = within(screen.getByRole('table', { name: rdsInstanceBandLabel('demo-cluster') }));
      expect(band.getAllByText('Reader')).toHaveLength(2);
      expect(band.getAllByText('Writer')).toHaveLength(1);
      expect(screen.queryByText('WRITER')).toBeNull();
      // The band's own headers — the outer table's Region column keeps the cluster's region.
      expect(screen.getByText('가용 영역')).toBeTruthy();
      expect(screen.getByText('엔드포인트')).toBeTruthy();
      expect(screen.getAllByText('ap-northeast-2')).toHaveLength(1);
      expect(screen.getByText('ap-northeast-2b')).toBeTruthy();
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
});
