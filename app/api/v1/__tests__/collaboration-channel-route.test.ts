import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    ops: {
      getCollaborationChannel: vi.fn(),
      postCollaborationChannelRetry: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/target-sources/[targetSourceId]/collaboration-channel/route';
import { POST as RETRY } from '@/app/api/v1/target-sources/[targetSourceId]/collaboration-channel/retry/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

const mockedGet = vi.mocked(bff.ops.getCollaborationChannel);
const mockedRetry = vi.mocked(bff.ops.postCollaborationChannelRetry);
const ctx = { params: Promise.resolve({ targetSourceId: '2113' }) };
const url = 'http://localhost/pass/api/v1/target-sources/2113/collaboration-channel';

describe('…/collaboration-channel (assumed §4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET passes the snake wire through as-is', async () => {
    mockedGet.mockResolvedValue({ status: 'RETRYING', issue_key: '', attempt_count: 3, max_attempts: 6 });
    const res = await GET(new Request(url), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'RETRYING', issue_key: '', attempt_count: 3, max_attempts: 6 });
    expect(mockedGet).toHaveBeenCalledWith(2113, { watcherPage: undefined, watcherSize: undefined });
  });

  it('GET forwards watcher_page / watcher_size when they are integers, and drops the rest', async () => {
    mockedGet.mockResolvedValue({ status: 'NONE' });
    await GET(new Request(`${url}?watcher_page=2&watcher_size=25`), ctx);
    expect(mockedGet).toHaveBeenLastCalledWith(2113, { watcherPage: 2, watcherSize: 25 });
    await GET(new Request(`${url}?watcher_page=abc&watcher_size=`), ctx);
    expect(mockedGet).toHaveBeenLastCalledWith(2113, { watcherPage: undefined, watcherSize: undefined });
  });

  it('an out-of-range size is the upstream 400, passed through', async () => {
    mockedGet.mockRejectedValue(new BffError(400, 'INVALID_PARAMETER', 'watcher_size out of range'));
    const res = await GET(new Request(`${url}?watcher_size=500`), ctx);
    expect(res.status).toBe(400);
  });
});

describe('…/collaboration-channel/retry (assumed §4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST → 202 with a JSON null body (accepted, not created)', async () => {
    mockedRetry.mockResolvedValue(undefined);
    const res = await RETRY(new Request(`${url}/retry`, { method: 'POST' }), ctx);
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toBeNull();
    expect(mockedRetry).toHaveBeenCalledWith(2113);
  });

  it('the four codes keep their identity through ProblemDetails', async () => {
    const cases: [number, string][] = [
      [404, 'JIRA_TICKET_NOT_FOUND'],
      [409, 'JIRA_MANUAL_RETRY_BUSY'],
      [409, 'JIRA_MANUAL_RETRY_UNAVAILABLE'],
      [503, 'JIRA_MANUAL_RETRY_DISABLED'],
    ];
    for (const [status, code] of cases) {
      mockedRetry.mockRejectedValueOnce(new BffError(status, code, 'upstream'));
      const res = await RETRY(new Request(`${url}/retry`, { method: 'POST' }), ctx);
      expect(res.status).toBe(status);
      expect(((await res.json()) as { code: string }).code).toBe(code);
    }
  });
});
