// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { TcScope } from '@/app/lib/api/tc-scope';

// The tag fetches on mount and nothing else; the scope it was handed and the run it got
// back are the only two inputs, so the fetch is where the fixture goes in.
const fetchLatestTest = vi.fn<(id: number, scope: TcScope) => Promise<TestConnectionVersionResult | null>>();
vi.mock('@/app/hooks/useTestConnectionPolling', () => ({
  fetchLatestTest: (id: number, scope: TcScope) => fetchLatestTest(id, scope),
}));

import { TcHeaderTag } from '@/app/target-sources/[targetSourceId]/_components/common/TcHeaderTag';

const run = (over: Partial<TestConnectionVersionResult> = {}): TestConnectionVersionResult => ({
  target_source_id: 1008,
  test_connection_version: 7,
  connection_status: 'SUCCESS',
  requested_at: '2026-05-20T01:00:00Z',
  completed_at: '2026-05-20T01:04:00Z',
  test_connection_agent_results: [],
  ...over,
});

const draw = async (scope: TcScope, job: TestConnectionVersionResult | null) => {
  fetchLatestTest.mockResolvedValue(job);
  render(<TcHeaderTag targetSourceId={1008} scope={scope} />);
  return screen.findByText(/테스트|성공|실패/);
};

describe('TcHeaderTag', () => {
  beforeEach(() => {
    fetchLatestTest.mockReset();
  });

  it('says 최근 only on the scope that reads the newest run (오너 지시)', async () => {
    // Step 5 reads `latest`: the run on screen IS the most recent one, so 최근 is a fact.
    expect((await draw('latest', run())).textContent).toBe('최근 테스트 성공');
  });

  it('drops 최근 on 마지막 성공, because a later run may have failed since', async () => {
    // The bug this pins: a target that succeeded in May, moved to Step 6, and failed a
    // re-run today. Steps 6·7 read `latestSuccess`, so the tag would have called May's
    // run 최근 테스트 while the most recent test was today's failure. The relative time
    // stays — 「마지막 성공 · 3개월 전」 is exactly what this endpoint returns.
    expect((await draw('latestSuccess', run())).textContent).toBe('마지막 성공');
  });

  it('keeps the non-SUCCESS branches even under latestSuccess — the contract types it loose', async () => {
    // `connection_status` is a bare `string` in the generated schema, so the last-success
    // endpoint returning a FAIL is not something the types rule out. The branch stays and
    // only drops the 최근 it cannot back up; it never claims the run was the newest.
    const failed = run({
      connection_status: 'FAIL',
      // The count folds by resource_id — it is failing RESOURCES, not agent rows.
      test_connection_agent_results: [
        { agent_id: 'a-1', resource_id: 'db-1', connection_status: 'FAIL' },
        { agent_id: 'a-1', resource_id: 'db-2', connection_status: 'SUCCESS' },
      ],
    });
    expect((await draw('latestSuccess', failed)).textContent).toBe('테스트 실패 1건');
  });

  it('still says 최근 테스트 실패 on Step 5, where the failure is the newest run', async () => {
    const failed = run({
      connection_status: 'FAIL',
      test_connection_agent_results: [
        { agent_id: 'a-1', resource_id: 'db-1', connection_status: 'FAIL' },
      ],
    });
    expect((await draw('latest', failed)).textContent).toBe('최근 테스트 실패 1건');
  });

  it('draws nothing when the target has never run a test', async () => {
    fetchLatestTest.mockResolvedValue(null);
    const { container } = render(<TcHeaderTag targetSourceId={1008} scope="latest" />);
    await waitFor(() => expect(fetchLatestTest).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});
