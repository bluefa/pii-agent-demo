import { describe, expect, it } from 'vitest';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { buildConnectionTestRows } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/steps/connection-test-adapter';

const makeJob = (
  agentResults: { resource_id: string; connection_status: TestConnectionVersionResult['connection_status'] }[],
): TestConnectionVersionResult => ({
  target_source_id: 1,
  test_connection_version: 1,
  connection_status: 'SUCCESS',
  requested_at: '2026-06-23T01:00:00.000Z',
  completed_at: '2026-06-23T01:00:20.000Z',
  test_connection_agent_results: agentResults.map((r) => ({
    agent_id: `agent-${r.resource_id}`,
    gcp_region: '',
    resource_id: r.resource_id,
    connection_status: r.connection_status,
    database_uri_list: [],
  })),
});

describe('buildConnectionTestRows', () => {
  it('joins resource ids with per-agent connection_status from the latest job', () => {
    const job = makeJob([
      { resource_id: 'i-0abc', connection_status: 'SUCCESS' },
      { resource_id: 'i-0def', connection_status: 'FAIL' },
    ]);

    const rows = buildConnectionTestRows(['i-0abc', 'i-0def', 'i-0ghi'], job);

    expect(rows).toEqual([
      { resourceId: 'i-0abc', connectionStatus: 'SUCCESS' },
      { resourceId: 'i-0def', connectionStatus: 'FAIL' },
      { resourceId: 'i-0ghi', connectionStatus: undefined },
    ]);
  });

  it('returns undefined connectionStatus for every resource when latestJob is null', () => {
    const rows = buildConnectionTestRows(['i-0abc', 'i-0def'], null);

    expect(rows).toEqual([
      { resourceId: 'i-0abc', connectionStatus: undefined },
      { resourceId: 'i-0def', connectionStatus: undefined },
    ]);
  });

  it('returns empty array for empty resource list', () => {
    const job = makeJob([{ resource_id: 'i-0abc', connection_status: 'SUCCESS' }]);
    expect(buildConnectionTestRows([], job)).toEqual([]);
  });

  it('handles all 4 connection_status enum values', () => {
    for (const status of ['PENDING', 'RUNNING', 'SUCCESS', 'FAIL'] as const) {
      const job = makeJob([{ resource_id: 'r1', connection_status: status }]);
      const [row] = buildConnectionTestRows(['r1'], job);
      expect(row.connectionStatus).toBe(status);
    }
  });

  it('last agent entry wins when resource_id appears multiple times (de-dup by overwrite)', () => {
    // Rare edge case: defensive against duplicate agent results for same resource.
    const job = makeJob([
      { resource_id: 'i-0abc', connection_status: 'FAIL' },
      { resource_id: 'i-0abc', connection_status: 'SUCCESS' },
    ]);
    const [row] = buildConnectionTestRows(['i-0abc'], job);
    expect(row.connectionStatus).toBe('SUCCESS');
  });
});
