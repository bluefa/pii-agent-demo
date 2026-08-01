import { describe, it, expect } from 'vitest';
import {
  sortResourceCounts,
  trimProviderPrefix,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ScanTab';

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
