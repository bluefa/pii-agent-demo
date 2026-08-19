// @vitest-environment jsdom
/**
 * P3 요청 상세 — split loading gates.
 *
 * The four reads gate different zones, and the states most likely to regress are
 * the ones a green happy path never touches:
 *
 *   1. A header REJECTION must raise the error card — folding it into the
 *      null(miss) fallback renders the wrong provider's table with a live 승인
 *      button and no retry path (the P1 this suite exists for).
 *   2. While every read is in flight, the breadcrumb prints the id ONCE —
 *      the old `${name ?? '#id'} #id` label printed "#1031 #1031".
 *   3. Header landed + detail pending: identity is real, 승인/반려 render
 *      disabled, and the body wears its skeleton.
 *   4. NLB occupancy pending: only the buttons that open it are held (리스너
 *      현황 · 배정하기), 사용 서비스 조회 stays live, and the hold releases
 *      when the table lands.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RequestDetailPage from '@/app/admin/pipelines/queue/requests/[targetSourceId]/page';
import type {
  ApprovalRequestDetail,
  ApprovalRequestLatestWire,
  NlbTableRow,
  RequestResourceRow,
  ResourceNlbMappings,
} from '@/app/lib/api/task-queue-requests';
import type { RequestListRow } from '@/lib/types/task-queue';

vi.mock('next/navigation', () => ({
  useParams: () => ({ targetSourceId: '1031' }),
  useRouter: () => ({ push: vi.fn() }),
  // The modal base reads the pathname to close on route change.
  usePathname: () => '/admin/pipelines/queue/requests/1031',
}));

const getRequestHeader = vi.fn();
const getApprovalRequestLatest = vi.fn();
const getNlbTable = vi.fn();
const getNlbIndexMappings = vi.fn();

vi.mock('@/app/lib/api/task-queue-requests', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/api/task-queue-requests')>();
  return {
    ...actual,
    getRequestHeader: (...args: unknown[]) => getRequestHeader(...args),
    getApprovalRequestLatest: (...args: unknown[]) => getApprovalRequestLatest(...args),
    getNlbTable: (...args: unknown[]) => getNlbTable(...args),
    getNlbIndexMappings: (...args: unknown[]) => getNlbIndexMappings(...args),
  };
});

/** A fetch that never settles — the zone it feeds must stay in its own gate. */
const pending = <T,>(): Promise<T> => new Promise<T>(() => {});

const HEADER_ROW: RequestListRow = {
  targetSourceId: 1031,
  serviceName: '주문서비스',
  description: null,
  serviceCode: 'ORD',
  cloudProvider: 'IDC',
  confirmStatus: 'CONFIRMED',
  latestApprovalRequest: null,
};

const idcRow = (overrides: Partial<RequestResourceRow> = {}): RequestResourceRow => ({
  resourceId: 'idc-r-1',
  resourceName: null,
  selected: true,
  exclusionReason: null,
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'oracle',
  region: null,
  idcKind: 'IP',
  connectTargets: ['10.20.1.18'],
  port: 1521,
  oracleSid: 'ORCL',
  sourceIps: ['10.20.9.1'],
  nlbIndex: null,
  resourceType: null,
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
  ...overrides,
});

const DETAIL: ApprovalRequestDetail = {
  request: {
    requestId: 5121,
    status: 'PENDING',
    requestedBy: 'jun.park',
    requestedAt: '2026-07-20T01:08:00Z',
    resourceTotalCount: 1,
    resourceSelectedCount: 1,
  },
  resources: [idcRow()],
  verdict: null,
  wire: {} as ApprovalRequestLatestWire,
};

const MAPPINGS: ResourceNlbMappings[] = [];

beforeEach(() => {
  vi.resetAllMocks();
});

describe('RequestDetailPage — split loading gates', () => {
  it('breadcrumb prints the id once while everything is still loading', () => {
    getRequestHeader.mockReturnValue(pending());
    getApprovalRequestLatest.mockReturnValue(pending());
    getNlbTable.mockReturnValue(pending());
    getNlbIndexMappings.mockReturnValue(pending());

    render(<RequestDetailPage />);

    expect(screen.getByText('#1031')).toBeTruthy();
    expect(screen.queryByText('#1031 #1031')).toBeNull();
    // Both zone skeletons stand while their fetches are in flight.
    expect(screen.getByLabelText('요청 정보를 불러오는 중')).toBeTruthy();
    expect(screen.getByLabelText('연동 대상을 불러오는 중')).toBeTruthy();
  });

  it('a header REJECTION raises the error card — never the null(miss) fallback', async () => {
    getRequestHeader.mockRejectedValue(new Error('헤더 조회에 실패했어요'));
    getApprovalRequestLatest.mockReturnValue(pending());
    getNlbTable.mockReturnValue(pending());
    getNlbIndexMappings.mockReturnValue(pending());

    render(<RequestDetailPage />);

    expect(await screen.findByText('헤더 조회에 실패했어요')).toBeTruthy();
    expect(screen.getByRole('button', { name: '재시도' })).toBeTruthy();
    // The wrong-provider table must not stand behind the failure.
    expect(screen.queryByRole('button', { name: '승인' })).toBeNull();
    expect(screen.queryByLabelText('연동 대상을 불러오는 중')).toBeNull();
  });

  it('header landed + detail pending: real identity, disabled CTA, body skeleton', async () => {
    getRequestHeader.mockResolvedValue(HEADER_ROW);
    getApprovalRequestLatest.mockReturnValue(pending());
    getNlbTable.mockReturnValue(pending());
    getNlbIndexMappings.mockReturnValue(pending());

    render(<RequestDetailPage />);

    expect(await screen.findByRole('heading', { name: '주문서비스' })).toBeTruthy();
    const approve = screen.getByRole('button', { name: '승인' });
    const reject = screen.getByRole('button', { name: '반려' });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    expect((reject as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText('연동 대상을 불러오는 중')).toBeTruthy();
  });

  it('NLB occupancy pending holds only its own buttons, and releases on arrival', async () => {
    let releaseNlb!: (rows: NlbTableRow[]) => void;
    getRequestHeader.mockResolvedValue(HEADER_ROW);
    getApprovalRequestLatest.mockResolvedValue(DETAIL);
    getNlbTable.mockReturnValue(new Promise<NlbTableRow[]>((resolve) => (releaseNlb = resolve)));
    getNlbIndexMappings.mockResolvedValue(MAPPINGS);

    render(<RequestDetailPage />);

    const assign = (await screen.findByRole('button', { name: '배정하기' })) as HTMLButtonElement;
    const listeners = screen.getByRole('button', { name: 'NLB 리스너 현황' }) as HTMLButtonElement;
    expect(assign.disabled).toBe(true);
    expect(assign.title).toBe('NLB 정보를 불러오는 중이에요');
    expect(listeners.disabled).toBe(true);
    // The page itself did NOT wait: the CTA is live, and so is the mappings-fed 조회.
    expect((screen.getByRole('button', { name: '승인' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: '조회' }) as HTMLButtonElement).disabled).toBe(false);

    await act(async () => releaseNlb([]));
    await waitFor(() => {
      expect((screen.getByRole('button', { name: '배정하기' }) as HTMLButtonElement).disabled).toBe(false);
      expect((screen.getByRole('button', { name: 'NLB 리스너 현황' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
