// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';

import { ServiceAssignmentModal } from '@/app/admin/pipelines/queue/requests/_components/ServiceAssignmentModal';
import type { RequestResourceRow, ResourceNlbMappings } from '@/app/lib/api/task-queue-requests';

const resource: RequestResourceRow = {
  resourceId: 'idc-r-1',
  resourceName: null,
  selected: true,
  exclusionReason: null,
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'ORACLE',
  region: null,
  idcKind: 'IP',
  connectTargets: ['10.20.1.11', '10.20.1.12'],
  port: 1521,
  oracleSid: null,
  sourceIps: [],
  nlbIndex: 1,
  resourceType: null,
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
};

/** 3 NLBs × 2 services — the same shape as the 30 × 20 the mock now serves. */
const mappings: ResourceNlbMappings[] = [
  {
    resourceId: 'idc-r-1',
    mappings: [
      { serviceCode: 'ORD', nlbIndex: 1 },
      { serviceCode: 'PAY', nlbIndex: 2 },
      { serviceCode: 'MBR', nlbIndex: 1 },
      { serviceCode: 'DLV', nlbIndex: 3 },
      { serviceCode: 'ORX', nlbIndex: 3 },
      { serviceCode: 'STL', nlbIndex: 2 },
    ],
  },
];

const open = (over: Partial<Parameters<typeof ServiceAssignmentModal>[0]> = {}) =>
  render(
    <ServiceAssignmentModal
      open
      onClose={() => {}}
      resource={resource}
      mappings={mappings}
      {...over}
    />,
  );

const master = () => screen.getAllByRole('button').filter((b) => b.textContent?.startsWith('NLB'));

describe('ServiceAssignmentModal', () => {
  it('NLB별로 묶고 인덱스 오름차순으로 세운다', () => {
    open();
    expect(master().map((b) => b.textContent)).toEqual(['NLB #12', 'NLB #22', 'NLB #32']);
  });

  it('처음에는 첫 NLB의 서비스만 보여준다', () => {
    open();
    expect(screen.getByText('ORD')).toBeTruthy();
    expect(screen.getByText('MBR')).toBeTruthy();
    // PAY is on NLB #2 — the detail column shows one NLB at a time, which is what keeps
    // the modal's height fixed at 600 combinations.
    expect(screen.queryByText('PAY')).toBeNull();
  });

  it('다른 NLB를 고르면 그 NLB의 서비스로 바뀐다', () => {
    open();
    fireEvent.click(master()[1]!);
    expect(screen.getByText('PAY')).toBeTruthy();
    expect(screen.getByText('STL')).toBeTruthy();
    expect(screen.queryByText('ORD')).toBeNull();
  });

  // The point of the search: a match on an NLB the admin has not opened must still be
  // found. Scrolling 600 entries is not a way to find one.
  it('열지 않은 NLB의 서비스도 검색으로 찾는다', () => {
    open();
    fireEvent.change(screen.getByLabelText('서비스 코드 검색'), { target: { value: 'orx' } });
    expect(master().map((b) => b.textContent)).toEqual(['NLB #31']);
    expect(screen.getByText('ORX')).toBeTruthy();
  });

  it('맞는 서비스가 없으면 검색어를 되짚어 준다', () => {
    open();
    fireEvent.change(screen.getByLabelText('서비스 코드 검색'), { target: { value: 'ZZZ' } });
    expect(screen.getByText(/‘ZZZ’와 맞는 서비스가 없어요/)).toBeTruthy();
  });

  it('조합이 없을 때와 못 불러왔을 때를 다르게 말한다', () => {
    const { unmount } = open({ mappings: [{ resourceId: 'idc-r-1', mappings: [] }] });
    expect(screen.getByText('이 IP Set을 쓰는 다른 서비스가 없어요')).toBeTruthy();
    unmount();

    open({ mappings: null });
    expect(screen.getByText('조합을 불러오지 못했어요')).toBeTruthy();
  });

  it('IP Set은 어느 상태에서도 남는다', () => {
    open({ mappings: null });
    const key = screen.getByText('IP Set').parentElement!;
    expect(within(key).getByText('10.20.1.11')).toBeTruthy();
    expect(within(key).getByText('10.20.1.12')).toBeTruthy();
  });
});
