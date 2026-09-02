// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';

const getApprovalRequestLatest = vi.fn();
const getConfirmedIntegration = vi.fn();
const getApprovalHistory = vi.fn();
// The two NLB reads feed lookup modals. They are spies rather than fixed stubs because
// what those modals draw depends on WHICH outcome arrived — 조회 중 · 실패 · 빈 결과 are
// three different frames, and a test that can only produce one of them cannot see that.
const getNlbTable = vi.fn();
const getNlbIndexMappings = vi.fn();

vi.mock('@/app/lib/api/task-queue-requests', async (importOriginal) => {
  // Not replaced wholesale: the IDC table derives its 구분 badge through `idcAddressKind`,
  // which lives in this module. Only the fetches are stubbed.
  const mod = await importOriginal<typeof import('@/app/lib/api/task-queue-requests')>();
  return {
    ...mod,
    getApprovalRequestLatest: (...args: unknown[]) => getApprovalRequestLatest(...args),
    getNlbTable: (...args: unknown[]) => getNlbTable(...args),
    getNlbIndexMappings: (...args: unknown[]) => getNlbIndexMappings(...args),
  };
});
vi.mock('@/app/lib/api', () => ({
  getConfirmedIntegration: (...args: unknown[]) => getConfirmedIntegration(...args),
  getApprovalHistory: (...args: unknown[]) => getApprovalHistory(...args),
}));

import { RequestTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/RequestTab';
import { rdsInstanceBandLabel } from '@/app/target-sources/[targetSourceId]/_components/shared/RdsInstancePanel';

const row = (index: number, selected = true): RequestResourceRow => ({
  resourceId: `res-${index}`,
  resourceName: `resource-${index}`,
  selected,
  exclusionReason: selected ? null : '스테이징 전용',
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
  resourceType: null,
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
});

const CSP: RawTargetSourceDetail = { cloud_provider: 'AWS' };

const mountWith = (count: number, excludeEvery = 0) => {
  const resources = Array.from({ length: count }, (_, i) =>
    row(i, excludeEvery === 0 || i % excludeEvery !== 0),
  );
  getApprovalRequestLatest.mockResolvedValue({
    request: {
      requestId: 1,
      status: 'APPROVED',
      requestedBy: 'ops',
      requestedAt: '2026-07-31T05:00:00Z',
      resourceTotalCount: count,
      resourceSelectedCount: resources.filter((r) => r.selected).length,
    },
    resources,
  });
  return render(<RequestTab targetSourceId={1642} detail={CSP} />);
};

describe('RequestTab 요청 리소스', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfirmedIntegration.mockResolvedValue({ resource_infos: [] });
    getApprovalHistory.mockResolvedValue({ content: [] });
    getNlbTable.mockResolvedValue([]);
    getNlbIndexMappings.mockResolvedValue([]);
  });

  /**
   * LIN-82 — …/approval-requests/latest returns every resource inline, so a
   * target with hundreds of them rendered one unbounded table.
   */
  it('renders only one page of rows and pages through the rest', async () => {
    mountWith(23);

    expect(await screen.findByText('resource-0')).toBeTruthy();
    expect(screen.getByText('resource-9')).toBeTruthy();
    expect(screen.queryByText('resource-10')).toBeNull();

    // 23 rows / 10 = 3 pages.
    expect(screen.getByRole('button', { name: '3 페이지' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '4 페이지' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(await screen.findByText('resource-10')).toBeTruthy();
    expect(screen.queryByText('resource-9')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '3 페이지' }));
    expect(await screen.findByText('resource-20')).toBeTruthy();
    // Last page is the 3-row remainder.
    expect(screen.getByText('resource-22')).toBeTruthy();
    expect(screen.queryByText('resource-19')).toBeNull();
  });

  /** The tiles carry the whole request, never the visible page. */
  it('surfaces the request size as filter tiles', async () => {
    mountWith(23, 5);

    expect(await screen.findByRole('button', { name: /전체 요청\s*23/ })).toBeTruthy();
    // Every 5th row is excluded → 5 of 23.
    expect(screen.getByRole('button', { name: /연동 요청 제외대상\s*5/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /연동 요청 대상\s*18/ })).toBeTruthy();
  });

  /**
   * `resource_id` is an internal NLB-PUT key for IDC (design-spec §8) — it keys the row
   * and is never printed, on this tab as on the queue's own request screen.
   */
  it('never surfaces an IDC resource_id', async () => {
    getApprovalRequestLatest.mockResolvedValue({
      request: { requestId: 1, status: 'PENDING', requestedBy: 'ops', requestedAt: '2026-07-31T05:00:00Z' },
      resources: [
        {
          ...row(0),
          resourceId: 'idc-r-8f21',
          resourceName: null,
          connectTargets: ['10.20.1.11'],
          idcKind: 'IP',
        },
      ],
    });
    render(<RequestTab targetSourceId={1031} detail={{ cloud_provider: 'IDC' }} />);

    // The host stands in for the name; the internal id appears nowhere.
    expect(await screen.findByText('10.20.1.11')).toBeTruthy();
    expect(screen.queryByText('idc-r-8f21')).toBeNull();
  });

  /**
   * An IDC row's facts each have a column of their own here — the tab renders the queue's
   * IDC table, not the cloud one. Port, Oracle SID and Source IP had no seat in the shared
   * approval table, and a Resource Name column asked an IDC row for a name it never has.
   */
  it('gives an IDC row the columns its facts belong in', async () => {
    getApprovalRequestLatest.mockResolvedValue({
      request: { requestId: 1, status: 'PENDING', requestedBy: 'ops', requestedAt: '2026-07-31T05:00:00Z' },
      resources: [
        {
          ...row(0),
          resourceId: 'idc-r-1',
          resourceName: null,
          connectTargets: ['10.20.1.11'],
          idcKind: 'IP',
          port: 1521,
          databaseType: 'oracle',
          oracleSid: 'IVTPDB',
          sourceIps: ['10.20.9.12'],
        },
      ],
    });
    render(<RequestTab targetSourceId={1031} detail={{ cloud_provider: 'IDC' }} />);

    expect(await screen.findByText('10.20.1.11')).toBeTruthy();
    for (const value of ['1521', 'IVTPDB', '10.20.9.12']) {
      expect(screen.getByText(value)).toBeTruthy();
    }
    // The cloud table's headers promise values an IDC row does not have.
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers).not.toContain('Resource Name');
    expect(headers).not.toContain('Resource ID');
    expect(headers).not.toContain('Region');
  });

  it('filters the table when a tile is picked', async () => {
    mountWith(23, 5);
    await screen.findByText('resource-1');

    fireEvent.click(screen.getByRole('button', { name: /연동 요청 제외대상/ }));
    expect(screen.getByText('resource-0')).toBeTruthy();
    expect(screen.getByText('resource-5')).toBeTruthy();
    expect(screen.queryByText('resource-1')).toBeNull();
  });

  // The admin approves the requester's CHOICE, so the tab has to name the instance the
  // cluster will connect through — not merely that a cluster was requested.
  describe('RDS cluster rows', () => {
    const CANDIDATES = [
      { resource_id: 'arn:db:demo-1', resource_name: 'demo-1', availability_zone: 'ap-northeast-2a', cluster_member_role: 'WRITER' },
      { resource_id: 'arn:db:demo-2', resource_name: 'demo-2', availability_zone: 'ap-northeast-2b', cluster_member_role: 'READER' },
    ];

    const mountCluster = (overrides: Partial<RequestResourceRow> = {}) => {
      getApprovalRequestLatest.mockResolvedValue({
        request: {
          requestId: 1,
          status: 'PENDING',
          requestedBy: 'ops',
          requestedAt: '2026-07-31T05:00:00Z',
          resourceTotalCount: 1,
          resourceSelectedCount: 1,
        },
        resources: [
          {
            ...row(0),
            resourceName: 'demo-cluster',
            resourceType: 'AWS_DB_CLUSTER',
            rdsInstanceCandidates: CANDIDATES,
            selectedRdsInstanceResourceId: 'arn:db:demo-2',
            ...overrides,
          },
        ],
      });
      return render(<RequestTab targetSourceId={1642} detail={CSP} />);
    };

    it('tags the cluster row and lists its instances with the chosen one marked', async () => {
      mountCluster();

      expect(await screen.findByText('demo-cluster')).toBeTruthy();
      expect(screen.getByText('RDS Cluster')).toBeTruthy();
      // The members live in the accordion body (`RdsInstancePanel`) — one colspan cell, not rows
      // of this table — so the lookups scope to it.
      const band = within(screen.getByRole('table', { name: rdsInstanceBandLabel('demo-cluster') }));
      expect(band.getByText('demo-1')).toBeTruthy();
      expect(band.getByText('demo-2')).toBeTruthy();
      // Prettified from the contract's uppercase WRITER / READER.
      expect(band.getByText('Writer')).toBeTruthy();
      expect(band.getByText('Reader')).toBeTruthy();
      // Exactly one instance is the choice, and it is the one the request named.
      expect(screen.getAllByText('선택됨')).toHaveLength(1);
      expect(screen.getByText('선택됨').closest('div')?.textContent).toContain('demo-2');
      // The cluster row names it too, so folding the band away cannot delete the choice.
      expect(screen.getByText('demo-cluster').closest('td')?.textContent).toContain('demo-2');
    });

    // Read-only surface: the admin reviews the choice, it does not re-make it.
    it('offers no radio to change the instance', async () => {
      mountCluster();
      await screen.findByText('demo-cluster');
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });

    it('leaves a non-cluster row untouched', async () => {
      mountWith(1);
      await screen.findByText('resource-0');
      expect(screen.queryByText('RDS Cluster')).toBeNull();
      expect(screen.queryByText('Instance')).toBeNull();
    });
  });

  // 기다리는 동안 카드가 「불러오는 중…」 한 줄이었다 — 목록이 도착하면 그 줄 자리에
  // 메타 행 + 리소스 섹션이 통째로 들어서면서 탭이 뛰었다.
  it('요청을 기다리는 동안 메타 행과 리소스 목록의 자국을 그린다', () => {
    // 끝나지 않는 조회 — 로딩 프레임을 붙잡아 둔다.
    getApprovalRequestLatest.mockReturnValue(new Promise(() => {}));
    const { container } = render(<RequestTab targetSourceId={1642} detail={CSP} />);

    const busy = container.querySelector('[aria-busy]');
    expect(busy).not.toBeNull();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('불러오는 중…')).toBeNull();
    // 라벨은 고정 문자열이라 기다리는 동안에도 실물로 선다.
    expect(screen.getByText('요청일시')).toBeTruthy();
  });

  /**
   * 두 조회 모달은 IDC 전용 fetch 두 건을 먹는데, 그 둘이 도착하기 전에도 열린다 —
   * 진입은 표와 툴바에 있고 표는 승인 요청 응답만 기다린다. 조회 중을 결말로 접으면
   * 화면이 아직 도는 요청을 두고 없다·실패했다고 단언한다.
   */
  describe('IDC 조회 모달 — 조회 중은 결말이 아니다', () => {
    const mountIdc = () => {
      getApprovalRequestLatest.mockResolvedValue({
        request: {
          requestId: 1,
          status: 'PENDING',
          requestedBy: 'ops',
          requestedAt: '2026-07-31T05:00:00Z',
        },
        resources: [
          { ...row(0), resourceId: 'idc-r-1', resourceName: null, connectTargets: ['10.20.1.11'], idcKind: 'IP' },
        ],
      });
      return render(<RequestTab targetSourceId={1031} detail={{ cloud_provider: 'IDC' }} />);
    };

    it('배정 조회가 도는 동안 사용 서비스 모달은 실패했다고 말하지 않는다', async () => {
      getNlbIndexMappings.mockReturnValue(new Promise(() => {}));
      mountIdc();
      fireEvent.click(await screen.findByRole('button', { name: '조회' }));

      expect(screen.queryByText('조합을 불러오지 못했어요')).toBeNull();
      const busy = document.querySelector('[aria-busy]');
      expect(busy).not.toBeNull();
      expect(busy?.textContent).toContain('불러오는 중');
    });

    it('배정 조회가 실패하면 사용 서비스 모달이 그렇게 말한다', async () => {
      getNlbIndexMappings.mockRejectedValue(new Error('boom'));
      mountIdc();
      fireEvent.click(await screen.findByRole('button', { name: '조회' }));

      expect(await screen.findByText('조합을 불러오지 못했어요')).toBeTruthy();
    });

    it('점유표가 도는 동안 NLB 리스너 현황은 빈 표를 그리지 않는다', async () => {
      getNlbTable.mockReturnValue(new Promise(() => {}));
      mountIdc();
      fireEvent.click(await screen.findByRole('button', { name: 'NLB 리스너 현황' }));

      // 열 이름은 고정 문자열이라 실물로 서고, 행은 자국이다 — 빈 tbody 는 「NLB 가
      // 하나도 없다」는 사실이라 조회 중에 그릴 수 없다.
      expect(screen.getByText('NLB Index')).toBeTruthy();
      const busy = document.querySelector('[aria-busy]');
      expect(busy).not.toBeNull();
      expect(busy?.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('점유표 조회가 실패하면 NLB 리스너 현황이 그렇게 말한다', async () => {
      getNlbTable.mockRejectedValue(new Error('boom'));
      mountIdc();
      fireEvent.click(await screen.findByRole('button', { name: 'NLB 리스너 현황' }));

      expect(await screen.findByText(/NLB 리스너 현황을 불러오지 못했어요/)).toBeTruthy();
      expect(screen.queryByText('NLB Index')).toBeNull();
    });
  });
});
