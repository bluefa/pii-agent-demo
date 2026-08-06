import { describe, it, expect } from 'vitest';
import {
  matchesQuery,
  sortCredentialRows,
  toCredentialRow,
} from '@/app/target-sources/[targetSourceId]/_components/layout/credential-rows';

const secret = (name: string, createTimeStr = '2024-01-10T09:00:00Z') => ({ name, createTimeStr });

describe('toCredentialRow — {userId}-{name} split', () => {
  it('splits on the FIRST hyphen only (later hyphens belong to the name)', () => {
    expect(toCredentialRow(secret('운영DB-MySQL-replica'))).toMatchObject({
      userId: '운영DB',
      label: 'MySQL-replica',
    });
  });

  it('keeps the whole string as the name when there is no usable userId', () => {
    // 하이픈이 없거나 맨 앞에 있으면 userId 를 지어내지 않는다.
    expect(toCredentialRow(secret('standalone'))).toMatchObject({ userId: '', label: 'standalone' });
    expect(toCredentialRow(secret('-leading'))).toMatchObject({ userId: '', label: '-leading' });
  });
});

describe('matchesQuery', () => {
  const row = toCredentialRow(secret('운영DB-MySQL'));

  it('matches on either side of the split', () => {
    expect(matchesQuery(row, '운영DB')).toBe(true);
    expect(matchesQuery(row, 'mysql')).toBe(true);
    expect(matchesQuery(row, 'redshift')).toBe(false);
  });

  it('treats an empty query as "everything"', () => {
    expect(matchesQuery(row, '   ')).toBe(true);
  });
});

describe('sortCredentialRows', () => {
  const rows = [
    toCredentialRow(secret('b-alpha', '2024-03-01T00:00:00Z')),
    toCredentialRow(secret('a-beta', '2024-01-01T00:00:00Z')),
    toCredentialRow(secret('a-alpha', '2024-02-01T00:00:00Z')),
  ];

  it('sorts by createdAt desc (the default view: newest first)', () => {
    expect(sortCredentialRows(rows, 'createdAt', 'desc').map((r) => r.name)).toEqual([
      'b-alpha',
      'a-alpha',
      'a-beta',
    ]);
  });

  it('breaks userId ties by full name so the order never wobbles', () => {
    expect(sortCredentialRows(rows, 'userId', 'asc').map((r) => r.name)).toEqual([
      'a-alpha',
      'a-beta',
      'b-alpha',
    ]);
  });

  it('sorts by label independently of userId', () => {
    expect(sortCredentialRows(rows, 'label', 'asc').map((r) => r.name)).toEqual([
      'a-alpha',
      'b-alpha',
      'a-beta',
    ]);
  });
});
