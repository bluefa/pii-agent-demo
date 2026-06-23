/**
 * Test Connection — wire→domain normalizers (ADR-019 D2/D6).
 *
 * The single casing boundary lives in the route handlers: each GET/PUT does
 * `normalizeX(camelCaseKeys(raw))`. These functions take the already-camelCased
 * payload as `unknown` and build a strictly-typed domain object field-by-field —
 * the "loud" alternative to a silent `as T` (no zod dependency in this repo;
 * mirrors the hand-written pattern in `lib/confirmed-integration-response.ts`).
 *
 * Enum values pass through verbatim from the swagger; unknown values are coerced
 * to the contract's idle/required defaults rather than thrown, so a stray BFF
 * value degrades gracefully instead of 500-ing the polling loop.
 */

// ===== Domain types (camelCase) =====

export type TestConnectionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAIL';

export interface TestConnectionTriggerResult {
  success: boolean;
}

export interface TestConnectionAgentResult {
  agentId: string;
  gcpRegion: string;
  resourceId: string;
  connectionStatus: TestConnectionStatus;
  databaseUriList: string[];
}

export interface TestConnectionVersionResult {
  targetSourceId: number;
  testConnectionVersion: number;
  connectionStatus: TestConnectionStatus;
  requestedAt: string;
  completedAt: string;
  testConnectionAgentResults: TestConnectionAgentResult[];
}

export interface TestConnectionLatestResultSummary {
  resourceId: string;
  agentId: string;
  logicalDatabaseCount: number;
  excludedLogicalDatabaseCount: number;
}

export type TestConnectionCompletionStatusType =
  | 'CONFIRMED'
  | 'LATEST_TEST_CONNECTION_SUCCESS'
  | 'TEST_CONNECTION_REQUIRED'
  | 'LOGICAL_DATABASE_RECENTLY_UPDATED';

export interface TestConnectionCompletionStatus {
  targetSourceId: number;
  latestTestConnectionRequestedAt: string;
  logicalDatabaseUpdatedAt: string;
  latestTestConnectionSuccess: boolean;
  testConnectionStatus: TestConnectionCompletionStatusType;
  testConnectionConfirmed: boolean;
}

export interface TestConnectionConfirmationResult {
  targetSourceId: number;
  confirmed: boolean;
  confirmedAt: string;
}

// ===== Helpers =====

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : {};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asNumber = (value: unknown): number => (typeof value === 'number' ? value : 0);

const asBoolean = (value: unknown): boolean => value === true;

const CONNECTION_STATUSES: readonly TestConnectionStatus[] = [
  'PENDING',
  'RUNNING',
  'SUCCESS',
  'FAIL',
];

const asConnectionStatus = (value: unknown): TestConnectionStatus =>
  CONNECTION_STATUSES.includes(value as TestConnectionStatus)
    ? (value as TestConnectionStatus)
    : 'PENDING';

const COMPLETION_STATUSES: readonly TestConnectionCompletionStatusType[] = [
  'CONFIRMED',
  'LATEST_TEST_CONNECTION_SUCCESS',
  'TEST_CONNECTION_REQUIRED',
  'LOGICAL_DATABASE_RECENTLY_UPDATED',
];

const asCompletionStatus = (value: unknown): TestConnectionCompletionStatusType =>
  COMPLETION_STATUSES.includes(value as TestConnectionCompletionStatusType)
    ? (value as TestConnectionCompletionStatusType)
    : 'TEST_CONNECTION_REQUIRED';

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(asString) : [];

// ===== Normalizers (input = camelCased payload) =====

const normalizeAgentResult = (raw: unknown): TestConnectionAgentResult => {
  const r = asRecord(raw);
  return {
    agentId: asString(r.agentId),
    gcpRegion: asString(r.gcpRegion),
    resourceId: asString(r.resourceId),
    connectionStatus: asConnectionStatus(r.connectionStatus),
    databaseUriList: asStringArray(r.databaseUriList),
  };
};

export const normalizeTestConnectionVersionResult = (
  raw: unknown,
): TestConnectionVersionResult => {
  const r = asRecord(raw);
  return {
    targetSourceId: asNumber(r.targetSourceId),
    testConnectionVersion: asNumber(r.testConnectionVersion),
    connectionStatus: asConnectionStatus(r.connectionStatus),
    requestedAt: asString(r.requestedAt),
    completedAt: asString(r.completedAt),
    testConnectionAgentResults: Array.isArray(r.testConnectionAgentResults)
      ? r.testConnectionAgentResults.map(normalizeAgentResult)
      : [],
  };
};

export const normalizeTestConnectionLatestResultSummaries = (
  raw: unknown,
): TestConnectionLatestResultSummary[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = asRecord(item);
    return {
      resourceId: asString(r.resourceId),
      agentId: asString(r.agentId),
      logicalDatabaseCount: asNumber(r.logicalDatabaseCount),
      excludedLogicalDatabaseCount: asNumber(r.excludedLogicalDatabaseCount),
    };
  });
};

export const normalizeTestConnectionCompletionStatus = (
  raw: unknown,
): TestConnectionCompletionStatus => {
  const r = asRecord(raw);
  return {
    targetSourceId: asNumber(r.targetSourceId),
    latestTestConnectionRequestedAt: asString(r.latestTestConnectionRequestedAt),
    logicalDatabaseUpdatedAt: asString(r.logicalDatabaseUpdatedAt),
    latestTestConnectionSuccess: asBoolean(r.latestTestConnectionSuccess),
    testConnectionStatus: asCompletionStatus(r.testConnectionStatus),
    testConnectionConfirmed: asBoolean(r.testConnectionConfirmed),
  };
};

export const normalizeTestConnectionConfirmationResult = (
  raw: unknown,
): TestConnectionConfirmationResult => {
  const r = asRecord(raw);
  return {
    targetSourceId: asNumber(r.targetSourceId),
    confirmed: asBoolean(r.confirmed),
    confirmedAt: asString(r.confirmedAt),
  };
};
