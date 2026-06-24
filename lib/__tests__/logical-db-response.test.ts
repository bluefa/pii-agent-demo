import { describe, it, expect } from 'vitest';
import {
  normalizeExcludedLogicalDatabases,
  normalizeTestedLogicalDatabases,
} from '@/lib/logical-db-response';

// These take the ALREADY-camelCased payload (the CSR boundary camelCases first),
// so the fixtures use camel keys.

describe('normalizeTestedLogicalDatabases', () => {
  it('maps the list and keeps optional fields optional', () => {
    const out = normalizeTestedLogicalDatabases({
      logicalDatabaseList: [
        { databaseName: 'live', type: 'DATABASE' },
        { databaseName: 'live', schemaName: 'public', type: 'SCHEMA' },
      ],
    });
    expect(out).toEqual([
      { databaseName: 'live', type: 'DATABASE' },
      { databaseName: 'live', schemaName: 'public', type: 'SCHEMA' },
    ]);
  });

  it('drops a row with no databaseName (cannot key into the modal)', () => {
    const out = normalizeTestedLogicalDatabases({
      logicalDatabaseList: [{ type: 'DATABASE' }, { databaseName: 'ok' }],
    });
    expect(out).toEqual([{ databaseName: 'ok' }]);
  });

  it('drops an unknown type rather than carrying it', () => {
    const out = normalizeTestedLogicalDatabases({
      logicalDatabaseList: [{ databaseName: 'x', type: 'WEIRD' }],
    });
    expect(out).toEqual([{ databaseName: 'x' }]);
  });

  it('returns [] for a missing/non-array list', () => {
    expect(normalizeTestedLogicalDatabases({})).toEqual([]);
    expect(normalizeTestedLogicalDatabases(null)).toEqual([]);
    expect(normalizeTestedLogicalDatabases({ logicalDatabaseList: 'nope' })).toEqual([]);
  });
});

describe('normalizeExcludedLogicalDatabases', () => {
  it('maps a full skip item including TEMP (not TMP)', () => {
    const out = normalizeExcludedLogicalDatabases({
      skipLogicalDatabaseList: [
        { databaseName: 'prd', schemaName: 'temp', skipReason: 'TEMP', type: 'SCHEMA' },
        { databaseName: 'stg', skipReason: 'STG', type: 'DATABASE' },
      ],
    });
    expect(out).toEqual([
      { databaseName: 'prd', schemaName: 'temp', skipReason: 'TEMP', type: 'SCHEMA' },
      { databaseName: 'stg', skipReason: 'STG', type: 'DATABASE' },
    ]);
  });

  it('drops a row missing a required field (databaseName / skipReason / type)', () => {
    const out = normalizeExcludedLogicalDatabases({
      skipLogicalDatabaseList: [
        { skipReason: 'STG', type: 'DATABASE' }, // no databaseName
        { databaseName: 'a', type: 'DATABASE' }, // no skipReason
        { databaseName: 'b', skipReason: 'DEV' }, // no type
        { databaseName: 'c', skipReason: 'DEV', type: 'DATABASE' }, // ok
      ],
    });
    expect(out).toEqual([{ databaseName: 'c', skipReason: 'DEV', type: 'DATABASE' }]);
  });

  it('drops an out-of-contract skipReason (e.g. TMP) instead of throwing', () => {
    const out = normalizeExcludedLogicalDatabases({
      skipLogicalDatabaseList: [{ databaseName: 'x', skipReason: 'TMP', type: 'DATABASE' }],
    });
    expect(out).toEqual([]);
  });

  it('returns [] for a missing/non-array list', () => {
    expect(normalizeExcludedLogicalDatabases({})).toEqual([]);
    expect(normalizeExcludedLogicalDatabases(undefined)).toEqual([]);
  });
});
