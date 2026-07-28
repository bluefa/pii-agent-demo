/**
 * GET …/test-connection/execution-history (수행 기록).
 *
 * The mock pages the job store, so the two things worth pinning are the paging
 * arithmetic and the version ordinal — the wire has no version column, it is
 * derived from a row's position in the newest-first page.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { mockConfirm } from '@/lib/bff/mock/confirm';
import { getProjectByTargetSourceId } from '@/lib/mock-data';

/** A Step 5/6/7 target — seeded with one latest run plus its prior runs. */
const TS = 1799;

interface ExecPage {
  totalElements: number;
  totalPages: number;
  number: number;
  content: Array<{
    test_connection_version: number;
    status: string;
    requested_at: string;
    completed_at: string | null;
  }>;
}

const history = async (page = 0, size = 10): Promise<ExecPage> =>
  (await mockConfirm.getTestConnectionExecutionHistory(String(TS), page, size)).json();

beforeEach(() => {
  globalThis.__piiAgentMockStore = undefined;
});

describe('test-connection execution history', () => {
  it('404s for a target source that does not exist', async () => {
    const response = await mockConfirm.getTestConnectionExecutionHistory('999999', 0, 10);
    expect(response.status).toBe(404);
  });

  it('returns the seeded runs newest first', async () => {
    expect(getProjectByTargetSourceId(TS)).toBeDefined();
    const page = await history();

    expect(page.totalElements).toBeGreaterThan(1);
    const requested = page.content.map((row) => row.requested_at);
    expect([...requested].sort().reverse()).toEqual(requested);
  });

  it('numbers versions by run order — newest carries the highest', async () => {
    const page = await history();
    const versions = page.content.map((row) => row.test_connection_version);
    expect(versions[0]).toBe(page.totalElements);
    expect(versions).toEqual(versions.map((_, index) => page.totalElements - index));
  });

  it('keeps versions stable across pages', async () => {
    const all = await history(0, 10);
    const second = await history(1, 1);

    expect(second.number).toBe(1);
    expect(second.content).toHaveLength(1);
    expect(second.content[0].test_connection_version).toBe(
      all.content[1].test_connection_version,
    );
  });

  it('reports only contract statuses (PENDING is surfaced as RUNNING)', async () => {
    const page = await history();
    for (const row of page.content) {
      expect(['RUNNING', 'SUCCESS', 'FAIL']).toContain(row.status);
    }
  });
});
