import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchInfraJson = vi.fn();
vi.mock('@/app/lib/api/infra', () => ({
  fetchInfraJson: (...args: unknown[]) => fetchInfraJson(...args),
}));

import { updateExcludedLogicalDatabases } from '@/app/lib/api/logical-db';
import type { ExcludedLogicalDatabase } from '@/app/lib/api/logical-db';

const ITEMS: ExcludedLogicalDatabase[] = [
  { databaseName: 'legacy', skipReason: 'TEMP', type: 'DATABASE' },
];

/**
 * ⛔ THE TRAP. The PUT answers 200 with no trustworthy body, so the policy is re-read
 * afterwards — and a rejection from that READ must never be handed to the caller as a
 * failed WRITE. The frame's failure copy says `서버의 제외 정책은 그대로예요.`, which
 * would be a lie about a write that already landed, and the user would save it twice.
 */
describe('updateExcludedLogicalDatabases — the write and the read-back are two answers', () => {
  beforeEach(() => {
    fetchInfraJson.mockReset();
  });

  it('a rejecting read-back resolves with null — the write is not reported as failed', async () => {
    fetchInfraJson
      .mockResolvedValueOnce(undefined) // PUT lands
      .mockRejectedValueOnce(new Error('boom')); // the refresh does not

    await expect(updateExcludedLogicalDatabases(11, 'srv-1', ITEMS)).resolves.toBeNull();
    // 몸통은 snake 로 쓴다(D3) — 이 경계 밖으로 camel 이 나가지 않는다.
    expect(fetchInfraJson.mock.calls[0][1]).toEqual({
      method: 'PUT',
      body: {
        skip_logical_database_list: [
          { database_name: 'legacy', skip_reason: 'TEMP', type: 'DATABASE' },
        ],
      },
    });
  });

  it('a rejecting PUT still rejects — that one IS a failed write', async () => {
    fetchInfraJson.mockRejectedValueOnce(new Error('boom'));

    await expect(updateExcludedLogicalDatabases(11, 'srv-1', ITEMS)).rejects.toThrow('boom');
    // The refresh is never attempted for a write that did not land.
    expect(fetchInfraJson).toHaveBeenCalledTimes(1);
  });

  it('a successful read-back returns the policy the server actually stored', async () => {
    fetchInfraJson.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      skip_logical_database_list: [
        { database_name: 'legacy', skip_reason: 'TEMP', type: 'DATABASE' },
      ],
    });

    await expect(updateExcludedLogicalDatabases(11, 'srv-1', ITEMS)).resolves.toEqual(ITEMS);
  });
});
