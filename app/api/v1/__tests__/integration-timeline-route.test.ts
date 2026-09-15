/**
 * GET /admin/queue/integration-timeline — the route owns the query contract (gap G8).
 *
 * The upstream endpoint has no generated schema, so this route is the only place a bad
 * period, a non-contract sort or an oversized page is stopped. What is pinned here:
 * defaults, the four rejections, and the fact that `Accept: text/csv` asks for the SAME
 * filters without a pager.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    taskQueue: {
      getIntegrationTimeline: vi.fn(),
      getIntegrationTimelineCsv: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/admin/queue/integration-timeline/route';
import { bff } from '@/lib/bff/client';

const getPage = vi.mocked(bff.taskQueue.getIntegrationTimeline);
const getCsv = vi.mocked(bff.taskQueue.getIntegrationTimelineCsv);

const WIRE = {
  content: [
    {
      target_source_id: 4130,
      service_code: 'SVC-PAY',
      service_name: '결제 정산',
      cloud_provider: 'AWS',
      confirm_status: 'CONFIRMED',
      created_at: '2026-07-02T10:12:00+09:00',
      pii_agent_first_installed_at: '2026-07-11T16:40:00+09:00',
      lead_time_seconds: 800_880,
    },
  ],
  totalElements: 41,
  totalPages: 3,
  number: 0,
  size: 20,
  first: true,
  last: false,
  numberOfElements: 1,
  empty: false,
};

const call = (query: string, headers?: HeadersInit) =>
  GET(
    new Request(`http://localhost/pass/api/v1/admin/queue/integration-timeline${query}`, {
      headers,
    }),
    { params: Promise.resolve({}) },
  );

const PERIOD = '?from=2026-06-17&to=2026-09-14';

beforeEach(() => {
  vi.clearAllMocks();
  getPage.mockResolvedValue(WIRE);
  getCsv.mockResolvedValue('target_source_id\n4130');
});

describe('query contract', () => {
  it('fills in the contract defaults when only the period is given', async () => {
    const response = await call(PERIOD);
    expect(response.status).toBe(200);
    expect(getPage).toHaveBeenCalledWith({
      axis: 'CREATED',
      from: '2026-06-17',
      to: '2026-09-14',
      installed: 'ALL',
      sort: 'createdAt,desc',
      page: 0,
      size: 20,
    });
  });

  it('passes every filter through', async () => {
    await call(
      `${PERIOD}&axis=FIRST_INSTALLED&installed=YES&serviceCode=STL&confirmStatus=CONFIRMED&sort=leadTimeSeconds,asc&page=2&size=50`,
    );
    expect(getPage).toHaveBeenCalledWith({
      axis: 'FIRST_INSTALLED',
      from: '2026-06-17',
      to: '2026-09-14',
      installed: 'YES',
      serviceCode: 'STL',
      confirmStatus: 'CONFIRMED',
      sort: 'leadTimeSeconds,asc',
      page: 2,
      size: 50,
    });
  });

  it('answers the camel domain, dates untouched', async () => {
    const body = await (await call(PERIOD)).json();
    expect(body.content[0]).toMatchObject({
      targetSourceId: 4130,
      createdAt: '2026-07-02T10:12:00+09:00',
      leadTimeSeconds: 800_880,
    });
    expect(body.totalElements).toBe(41);
  });

  it.each([
    ['a missing period', ''],
    ['a period that is not a date', '?from=2026-06&to=2026-09-14'],
    ['an unknown axis', `${PERIOD}&axis=UPDATED`],
    ['an unknown installed filter', `${PERIOD}&installed=MAYBE`],
    ['a sort prop outside the contract', `${PERIOD}&sort=serviceName,asc`],
    ['a sort direction outside the contract', `${PERIOD}&sort=createdAt,sideways`],
    ['a page size over the cap', `${PERIOD}&size=101`],
  ])('rejects %s', async (_case, query) => {
    const response = await call(query);
    expect(response.status).toBe(400);
    expect(getPage).not.toHaveBeenCalled();
  });

  it('rejects a period that runs backwards', async () => {
    const response = await call('?from=2026-09-14&to=2026-06-17');
    expect(response.status).toBe(400);
    expect(getPage).not.toHaveBeenCalled();
  });
});

describe('Accept: text/csv', () => {
  it('asks for the same filters without a pager and answers as a file', async () => {
    const response = await call(`${PERIOD}&installed=YES&page=2&size=50`, {
      Accept: 'text/csv',
    });

    expect(getPage).not.toHaveBeenCalled();
    expect(getCsv).toHaveBeenCalledWith({
      axis: 'CREATED',
      from: '2026-06-17',
      to: '2026-09-14',
      installed: 'YES',
      sort: 'createdAt,desc',
    });
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain(
      'integration-timeline_2026-06-17_2026-09-14.csv',
    );
    await expect(response.text()).resolves.toBe('target_source_id\n4130');
  });
});
