import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    ops: {
      getCollaborationChannel: vi.fn(),
      putCollaborationChannel: vi.fn(),
    },
  },
}));

import { GET, PUT } from '@/app/api/v1/target-sources/[targetSourceId]/collaboration-channel/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

const mockedGet = vi.mocked(bff.ops.getCollaborationChannel);
const mockedPut = vi.mocked(bff.ops.putCollaborationChannel);
const ctx = { params: Promise.resolve({ targetSourceId: '2113' }) };
const url = 'http://localhost/pass/api/v1/target-sources/2113/collaboration-channel';

const put = (body: unknown) =>
  PUT(new Request(url, { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), ctx);

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

  it('PUT with an empty issue_key is a 400 problem, nothing reaches the BFF', async () => {
    for (const body of [{ issue_key: '   ' }, {}, null]) {
      const res = await put(body);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe('VALIDATION_FAILED');
    }
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('PUT forwards the trimmed key (and url when given) and returns the upstream body', async () => {
    mockedPut.mockResolvedValue({ status: 'CREATED', issue_key: 'BDCDIP-1234' });
    const res = await put({ issue_key: ' BDCDIP-1234 ', url: 'https://jira.example.com/browse/BDCDIP-1234' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'CREATED', issue_key: 'BDCDIP-1234' });
    expect(mockedPut).toHaveBeenCalledWith(2113, {
      issue_key: 'BDCDIP-1234',
      url: 'https://jira.example.com/browse/BDCDIP-1234',
    });

    mockedPut.mockClear();
    await put({ issue_key: 'BDCDIP-1' });
    expect(mockedPut).toHaveBeenCalledWith(2113, { issue_key: 'BDCDIP-1' });
  });

  it('the in-progress 409 keeps its code through ProblemDetails', async () => {
    mockedPut.mockRejectedValue(new BffError(409, 'JIRA_TICKET_CREATION_IN_PROGRESS', 'writing'));
    const res = await put({ issue_key: 'BDCDIP-409' });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('JIRA_TICKET_CREATION_IN_PROGRESS');
  });
});
