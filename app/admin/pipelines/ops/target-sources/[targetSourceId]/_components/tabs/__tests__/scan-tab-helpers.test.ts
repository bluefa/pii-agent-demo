import { describe, it, expect } from 'vitest';
import {
  sortResourceCounts,
  trimProviderPrefix,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';
import { tokenizeJson } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanCredentialCard';

describe('sortResourceCounts', () => {
  it('sorts by count desc, then name asc, dropping null counts', () => {
    expect(
      sortResourceCounts({
        AWS_SUBNET: 4,
        AWS_EC2_INSTANCE: 5,
        AWS_DB_CLUSTER: 3,
        AWS_DYNAMO_DB_TABLE: 3,
        AWS_KMS: null,
      }),
    ).toEqual([
      ['AWS_EC2_INSTANCE', 5],
      ['AWS_SUBNET', 4],
      ['AWS_DB_CLUSTER', 3],
      ['AWS_DYNAMO_DB_TABLE', 3],
    ]);
  });

  it('returns [] for null/undefined maps', () => {
    expect(sortResourceCounts(null)).toEqual([]);
    expect(sortResourceCounts(undefined)).toEqual([]);
  });
});

describe('trimProviderPrefix', () => {
  it('strips the provider prefix — Azure uppercases to AZURE_', () => {
    expect(trimProviderPrefix('AZURE_POSTGRESQL', 'Azure')).toBe('POSTGRESQL');
    expect(trimProviderPrefix('AWS_DB_INSTANCE', 'AWS')).toBe('DB_INSTANCE');
    expect(trimProviderPrefix('GCP_SQL', 'GCP')).toBe('SQL');
  });

  it('leaves unknown-prefix keys untouched (open set)', () => {
    expect(trimProviderPrefix('AWS_DB_INSTANCE', 'Azure')).toBe('AWS_DB_INSTANCE');
    expect(trimProviderPrefix('CUSTOM_THING', 'AWS')).toBe('CUSTOM_THING');
  });
});

describe('tokenizeJson', () => {
  it('classifies keys, strings, numbers, booleans, and null', () => {
    const tokens = tokenizeJson('{"a": "b", "n": -1.5, "ok": true, "x": null}');
    expect(tokens.filter((t) => t.kind !== 'plain').map((t) => `${t.kind}:${t.text}`)).toEqual([
      'key:"a"',
      'string:"b"',
      'key:"n"',
      'number:-1.5',
      'key:"ok"',
      'bool:true',
      'key:"x"',
      'null:null',
    ]);
  });

  it('round-trips the input and keeps escaped quotes in one string token', () => {
    const text = JSON.stringify({ msg: 'sa"y \\ true', arn: null }, null, 2);
    const tokens = tokenizeJson(text);
    expect(tokens.map((t) => t.text).join('')).toBe(text);
    expect(tokens.filter((t) => t.kind === 'string')).toHaveLength(1);
    expect(tokens.filter((t) => t.kind === 'bool')).toHaveLength(0);
  });
});
