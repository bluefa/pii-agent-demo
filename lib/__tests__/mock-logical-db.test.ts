import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockLogicalDb } from '@/lib/bff/mock/logical-db';
import { resetStore } from '@/lib/mock-store';
import { getProjectByTargetSourceId } from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';
import type {
  SkipLogicalDatabaseResponseWire,
  TestedLogicalDatabasesResponseWire,
} from '@/lib/bff/types/logical-db';

// A cloud project seeded at WAITING_CONNECTION_TEST (a connection-test step, so a
// test connection has run and logical DBs are discovered).
const CONN_TEST_TARGET = 2004;
const RESOURCE_ID = 'res-1';

const json = async <T>(res: Response): Promise<T> => (await res.json()) as T;

describe('mockLogicalDb (wire-snake == swagger, stateful round-trip)', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a project that is actually at a connection-test step', () => {
    // Guards the fixture: if the seed changes, the round-trip assertions below
    // would silently read empty lists instead.
    expect(getProjectByTargetSourceId(CONN_TEST_TARGET)?.processStatus).toBe(
      ProcessStatus.WAITING_CONNECTION_TEST,
    );
  });

  it('emits the snake tested topology (logical_database_list) at a tested step', async () => {
    const res = await mockLogicalDb.getTestedByResourceId(String(CONN_TEST_TARGET), RESOURCE_ID);
    const body = await json<TestedLogicalDatabasesResponseWire>(res);
    expect(body.logical_database_list?.length).toBeGreaterThan(0);
    // snake keys + DATABASE/SCHEMA enum survive verbatim.
    expect(body.logical_database_list).toContainEqual({ database_name: 'live', type: 'DATABASE' });
    expect(body.logical_database_list).toContainEqual({
      database_name: 'live',
      schema_name: 'public',
      type: 'SCHEMA',
    });
  });

  it('seeds the skip policy with TEMP (not TMP) and the excluded-only legacy db', async () => {
    const res = await mockLogicalDb.getExcludedByResourceId(String(CONN_TEST_TARGET), RESOURCE_ID);
    const body = await json<SkipLogicalDatabaseResponseWire>(res);
    expect(body.skip_logical_database_list).toContainEqual({
      database_name: 'prd',
      schema_name: 'temp',
      skip_reason: 'TEMP',
      type: 'SCHEMA',
    });
    expect(body.skip_logical_database_list).toContainEqual({
      database_name: 'legacy',
      skip_reason: 'TEMP',
      type: 'DATABASE',
    });
  });

  it('PUT is full-replace and the next GET returns exactly what was saved', async () => {
    const next = {
      skip_logical_database_list: [
        { database_name: 'dev', skip_reason: 'DEV' as const, type: 'DATABASE' as const },
      ],
    };
    const putRes = await mockLogicalDb.updateExcludedByResourceId(
      String(CONN_TEST_TARGET),
      RESOURCE_ID,
      next,
    );
    const putBody = await json<SkipLogicalDatabaseResponseWire>(putRes);
    expect(putBody.skip_logical_database_list).toEqual(next.skip_logical_database_list);

    const getRes = await mockLogicalDb.getExcludedByResourceId(String(CONN_TEST_TARGET), RESOURCE_ID);
    const getBody = await json<SkipLogicalDatabaseResponseWire>(getRes);
    expect(getBody.skip_logical_database_list).toEqual(next.skip_logical_database_list);
  });

  it('returns empty lists for a step where no test connection has run', async () => {
    // Find a project NOT at a connection-test step.
    const testedSteps = new Set([
      ProcessStatus.WAITING_CONNECTION_TEST,
      ProcessStatus.CONNECTION_VERIFIED,
      ProcessStatus.INSTALLATION_COMPLETE,
    ]);
    let preTestTarget: number | undefined;
    for (let id = 1001; id <= 2012; id += 1) {
      const p = getProjectByTargetSourceId(id);
      if (p && !testedSteps.has(p.processStatus)) {
        preTestTarget = id;
        break;
      }
    }
    expect(preTestTarget).toBeDefined();

    const testedRes = await mockLogicalDb.getTestedByResourceId(String(preTestTarget), RESOURCE_ID);
    const testedBody = await json<TestedLogicalDatabasesResponseWire>(testedRes);
    expect(testedBody.logical_database_list).toEqual([]);
  });
});
