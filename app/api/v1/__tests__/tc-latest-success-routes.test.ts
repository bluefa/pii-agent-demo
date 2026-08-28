import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    confirm: {
      getTestConnectionLatest: vi.fn(),
      getTestConnectionLatestSuccess: vi.fn(),
      getLatestTestConnectionResultSummaries: vi.fn(),
      getLatestTestConnectionSuccessResultSummaries: vi.fn(),
    },
    logicalDb: {
      getTestedByResourceId: vi.fn(),
      getTestedLatestByResourceId: vi.fn(),
    },
  },
}));

// Importing each route by its real path is half of what this file is for: the CSR
// helpers (app/lib/api/__tests__/tc-scope-routes.test.ts) pin the URL strings against a
// stubbed fetch, which cannot tell whether a directory of that name exists. Misspell
// `latest_success_version` and that suite stays green while the browser gets a 404.
import { GET as getLatestSuccessVersion } from '@/app/api/v1/target-sources/[targetSourceId]/test-connection/latest_success_version/route';
import { GET as getLatestSuccessResults } from '@/app/api/v1/target-sources/[targetSourceId]/test-connection/latest-success-results/route';
import { GET as getTestedLatestByResourceId } from '@/app/api/v1/target-sources/[targetSourceId]/tested-latest-logical-databases/by-resource-id/route';
import { bff } from '@/lib/bff/client';
import { mockBff } from '@/lib/bff/mock-adapter';
import { TC_CARD_FIXTURE } from '@/lib/mock-test-connection';

const confirm = vi.mocked(bff.confirm);
const logicalDb = vi.mocked(bff.logicalDb);

const routeParams = { params: Promise.resolve({ targetSourceId: '1027' }) };
const url = (query = ''): string => `http://localhost/x${query}`;

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * The other half: each of these three siblings answers the SAME response DTO as the
 * `latest` route it was cloned from, so swapping the bff method behind a handler is
 * invisible to tsc and to every response-shape assertion. Only naming the method that
 * was called separates the two runs.
 */
describe('GET …/test-connection/latest_success_version', () => {
  it('reads the last SUCCESS run — not the `latest` sibling that shares its DTO', async () => {
    confirm.getTestConnectionLatestSuccess.mockResolvedValue({
      target_source_id: 1027,
      test_connection_version: 4,
      connection_status: 'SUCCESS',
    });

    const response = await getLatestSuccessVersion(new Request(url()), routeParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      test_connection_version: 4,
      connection_status: 'SUCCESS',
    });
    expect(confirm.getTestConnectionLatestSuccess).toHaveBeenCalledWith(1027);
    expect(confirm.getTestConnectionLatest).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric targetSourceId before reaching the BFF', async () => {
    const response = await getLatestSuccessVersion(new Request(url()), {
      params: Promise.resolve({ targetSourceId: 'abc' }),
    });

    expect(response.status).toBe(400);
    expect(confirm.getTestConnectionLatestSuccess).not.toHaveBeenCalled();
  });
});

describe('GET …/test-connection/latest-success-results', () => {
  it('counts the last SUCCESS run — not the `latest-results` sibling', async () => {
    confirm.getLatestTestConnectionSuccessResultSummaries.mockResolvedValue([
      { resource_id: 'db-1', agent_id: 'agent-1', logical_database_count: 3, excluded_logical_database_count: 1 },
    ]);

    const response = await getLatestSuccessResults(new Request(url()), routeParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { resource_id: 'db-1', agent_id: 'agent-1', logical_database_count: 3, excluded_logical_database_count: 1 },
    ]);
    expect(confirm.getLatestTestConnectionSuccessResultSummaries).toHaveBeenCalledWith(1027);
    expect(confirm.getLatestTestConnectionResultSummaries).not.toHaveBeenCalled();
  });
});

describe('GET …/tested-latest-logical-databases/by-resource-id', () => {
  it('reads the LATEST run — the pair whose names run opposite to the other two', async () => {
    logicalDb.getTestedLatestByResourceId.mockResolvedValue({
      logical_database_list: [{ database_name: 'app', schema_name: 'public', type: 'SCHEMA' }],
    });

    const response = await getTestedLatestByResourceId(
      new Request(url('?resourceId=db-1')),
      routeParams,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      logical_database_list: [{ database_name: 'app', schema_name: 'public', type: 'SCHEMA' }],
    });
    expect(logicalDb.getTestedLatestByResourceId).toHaveBeenCalledWith(1027, 'db-1');
    expect(logicalDb.getTestedByResourceId).not.toHaveBeenCalled();
  });

  it('answers 400 when resourceId is missing — the whole query IS the selector', async () => {
    const response = await getTestedLatestByResourceId(new Request(url()), routeParams);

    expect(response.status).toBe(400);
    expect(logicalDb.getTestedLatestByResourceId).not.toHaveBeenCalled();
  });
});

/**
 * Mocking `@/lib/bff/client` proves the ROUTE picks the right method, and stops exactly
 * there — the mock adapter behind it is out of the picture, so swapping
 * `mockConfirm.getTestConnectionLatestSuccess` for `getTestConnectionLatest` inside
 * mock-adapter.ts leaves every assertion above green. tsc is no help either: the two
 * operations take the same argument and answer the same DTO.
 *
 * So drive the adapter itself on the one fixture where the two runs differ
 * (TC_CARD_FIXTURE.fail — latest FAIL, the run before it SUCCESS). Only the returned run
 * separates a correct delegation from a swapped one.
 */
describe('mockBff delegation — the adapter must reach the OTHER run', () => {
  it('getTestConnectionLatestSuccess answers an earlier, successful run than getTestConnectionLatest', async () => {
    const latest = await mockBff.confirm.getTestConnectionLatest(TC_CARD_FIXTURE.fail);
    const lastSuccess = await mockBff.confirm.getTestConnectionLatestSuccess(TC_CARD_FIXTURE.fail);

    expect(latest.connection_status).toBe('FAIL');
    expect(lastSuccess.connection_status).toBe('SUCCESS');
    // 회차까지 갈려야 한다 — 같은 번호면 화면이 두 실행을 한 실행이라고 말한다.
    expect(lastSuccess.test_connection_version).toBeLessThan(latest.test_connection_version ?? 0);
  });

  it('getLatestTestConnectionSuccessResultSummaries counts the successful run, not the failed latest', async () => {
    const latestRows = await mockBff.confirm.getLatestTestConnectionResultSummaries(
      TC_CARD_FIXTURE.fail,
    );
    const successRows = await mockBff.confirm.getLatestTestConnectionSuccessResultSummaries(
      TC_CARD_FIXTURE.fail,
    );

    // 최신 실행은 리소스 일부가 실패해 건수를 못 내고, 마지막 성공 실행은 전부 낸다.
    expect(successRows.length).toBeGreaterThan(latestRows.length);
  });
});
