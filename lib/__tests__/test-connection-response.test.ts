import { describe, expect, it } from 'vitest';
import { camelCaseKeys } from '@/lib/object-case';
import {
  normalizeTestConnectionVersionResult,
  normalizeTestConnectionLatestResultSummaries,
  normalizeTestConnectionCompletionStatus,
  normalizeTestConnectionConfirmationResult,
} from '@/lib/test-connection-response';
import type {
  TestConnectionVersionResultWire,
  TestConnectionLatestResultSummaryResponseWire,
  TestConnectionCompletionStatusResponseWire,
  TestConnectionConfirmationResponseWire,
  TestConnectionCompletionStatusWire,
} from '@/lib/bff/types/test-connection';

// These tests exercise the actual ADR-019 D1/D6 casing boundary: a swagger-shaped
// WIRE (snake) object → camelCaseKeys → normalizeX → camel DOMAIN, exactly as the
// route handlers do. The normalizers are the only place an `as T` could hide, so
// they are asserted directly (incl. the graceful-degrade fallbacks).

describe('normalizeTestConnectionVersionResult', () => {
  it('maps wire snake → camel domain incl. agent results array + enums', () => {
    const wire: TestConnectionVersionResultWire = {
      target_source_id: 123,
      test_connection_version: 4,
      connection_status: 'RUNNING',
      requested_at: '2026-06-23T01:00:00.000Z',
      completed_at: '2026-06-23T01:00:20.000Z',
      test_connection_agent_results: [
        {
          agent_id: 'agent-i-0abc',
          gcp_region: 'asia-northeast3',
          resource_id: 'i-0abc',
          connection_status: 'SUCCESS',
          database_uri_list: ['mysql://i-0abc/db1', 'mysql://i-0abc/db2'],
        },
      ],
    };

    const domain = normalizeTestConnectionVersionResult(camelCaseKeys(wire));

    expect(domain).toEqual({
      targetSourceId: 123,
      testConnectionVersion: 4,
      connectionStatus: 'RUNNING',
      requestedAt: '2026-06-23T01:00:00.000Z',
      completedAt: '2026-06-23T01:00:20.000Z',
      testConnectionAgentResults: [
        {
          agentId: 'agent-i-0abc',
          gcpRegion: 'asia-northeast3',
          resourceId: 'i-0abc',
          connectionStatus: 'SUCCESS',
          databaseUriList: ['mysql://i-0abc/db1', 'mysql://i-0abc/db2'],
        },
      ],
    });
  });

  it('preserves all 4 connection_status values for top-level + per-agent', () => {
    for (const status of ['PENDING', 'RUNNING', 'SUCCESS', 'FAIL'] as const) {
      const wire: TestConnectionVersionResultWire = {
        target_source_id: 1,
        test_connection_version: 1,
        connection_status: status,
        requested_at: '',
        completed_at: '',
        test_connection_agent_results: [
          { agent_id: 'a', gcp_region: '', resource_id: 'r', connection_status: status, database_uri_list: [] },
        ],
      };
      const domain = normalizeTestConnectionVersionResult(camelCaseKeys(wire));
      expect(domain.connectionStatus).toBe(status);
      expect(domain.testConnectionAgentResults[0].connectionStatus).toBe(status);
    }
  });

  it('graceful-degrade: unknown connection_status → PENDING; missing array → []', () => {
    const domain = normalizeTestConnectionVersionResult({
      targetSourceId: 9,
      connectionStatus: 'BOGUS',
      // testConnectionAgentResults intentionally absent
    });
    expect(domain.connectionStatus).toBe('PENDING');
    expect(domain.testConnectionAgentResults).toEqual([]);
    expect(domain.targetSourceId).toBe(9);
    expect(domain.testConnectionVersion).toBe(0);
    expect(domain.requestedAt).toBe('');
  });

  it('agent-level graceful-degrade: unknown per-agent status → PENDING, non-array uri list → []', () => {
    const domain = normalizeTestConnectionVersionResult({
      testConnectionAgentResults: [
        { agentId: 'a', resourceId: 'r', connectionStatus: 'NOPE', databaseUriList: 'not-an-array' },
      ],
    });
    expect(domain.testConnectionAgentResults[0].connectionStatus).toBe('PENDING');
    expect(domain.testConnectionAgentResults[0].databaseUriList).toEqual([]);
  });
});

describe('normalizeTestConnectionLatestResultSummaries', () => {
  it('maps a wire ARRAY → camel domain array', () => {
    const wire: TestConnectionLatestResultSummaryResponseWire[] = [
      { resource_id: 'i-0abc', agent_id: 'agent-i-0abc', logical_database_count: 12, excluded_logical_database_count: 3 },
      { resource_id: 'i-0def', agent_id: 'agent-i-0def', logical_database_count: 5, excluded_logical_database_count: 0 },
    ];

    const domain = normalizeTestConnectionLatestResultSummaries(camelCaseKeys(wire));

    expect(domain).toEqual([
      { resourceId: 'i-0abc', agentId: 'agent-i-0abc', logicalDatabaseCount: 12, excludedLogicalDatabaseCount: 3 },
      { resourceId: 'i-0def', agentId: 'agent-i-0def', logicalDatabaseCount: 5, excludedLogicalDatabaseCount: 0 },
    ]);
  });

  it('graceful-degrade: non-array input → []', () => {
    expect(normalizeTestConnectionLatestResultSummaries(undefined)).toEqual([]);
    expect(normalizeTestConnectionLatestResultSummaries(null)).toEqual([]);
    expect(normalizeTestConnectionLatestResultSummaries({})).toEqual([]);
  });
});

describe('normalizeTestConnectionCompletionStatus', () => {
  const allStatuses: TestConnectionCompletionStatusWire[] = [
    'CONFIRMED',
    'LATEST_TEST_CONNECTION_SUCCESS',
    'TEST_CONNECTION_REQUIRED',
    'LOGICAL_DATABASE_RECENTLY_UPDATED',
  ];

  it('maps wire snake → camel domain', () => {
    const wire: TestConnectionCompletionStatusResponseWire = {
      target_source_id: 42,
      latest_test_connection_requested_at: '2026-06-23T01:00:00.000Z',
      logical_database_updated_at: '2026-06-23T00:50:00.000Z',
      latest_test_connection_success: true,
      test_connection_status: 'LATEST_TEST_CONNECTION_SUCCESS',
      test_connection_confirmed: false,
    };

    const domain = normalizeTestConnectionCompletionStatus(camelCaseKeys(wire));

    expect(domain).toEqual({
      targetSourceId: 42,
      latestTestConnectionRequestedAt: '2026-06-23T01:00:00.000Z',
      logicalDatabaseUpdatedAt: '2026-06-23T00:50:00.000Z',
      latestTestConnectionSuccess: true,
      testAck: false,
      testConnectionStatus: 'LATEST_TEST_CONNECTION_SUCCESS',
      testConnectionConfirmed: false,
    });
  });

  it('preserves all 4 test_connection_status enum values', () => {
    for (const status of allStatuses) {
      const domain = normalizeTestConnectionCompletionStatus({ testConnectionStatus: status });
      expect(domain.testConnectionStatus).toBe(status);
    }
  });

  it('graceful-degrade: unknown status → TEST_CONNECTION_REQUIRED; missing booleans → false', () => {
    const domain = normalizeTestConnectionCompletionStatus({ testConnectionStatus: 'WAT' });
    expect(domain.testConnectionStatus).toBe('TEST_CONNECTION_REQUIRED');
    expect(domain.latestTestConnectionSuccess).toBe(false);
    expect(domain.testConnectionConfirmed).toBe(false);
    expect(domain.targetSourceId).toBe(0);
  });
});

describe('normalizeTestConnectionConfirmationResult', () => {
  it('maps wire snake → camel domain', () => {
    const wire: TestConnectionConfirmationResponseWire = {
      target_source_id: 7,
      confirmed: true,
      confirmed_at: '2026-06-23T01:01:00.000Z',
    };

    const domain = normalizeTestConnectionConfirmationResult(camelCaseKeys(wire));

    expect(domain).toEqual({
      targetSourceId: 7,
      confirmed: true,
      confirmedAt: '2026-06-23T01:01:00.000Z',
    });
  });

  it('graceful-degrade: confirmed only true for boolean true; missing → defaults', () => {
    expect(normalizeTestConnectionConfirmationResult({ confirmed: 'true' }).confirmed).toBe(false);
    expect(normalizeTestConnectionConfirmationResult({}).confirmed).toBe(false);
    expect(normalizeTestConnectionConfirmationResult({}).confirmedAt).toBe('');
    expect(normalizeTestConnectionConfirmationResult({}).targetSourceId).toBe(0);
  });
});
