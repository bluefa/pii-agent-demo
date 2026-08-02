import { describe, expect, it } from 'vitest';
import type { SecretKey } from '@/lib/types';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import {
  credentialEntries,
  filterCredentials,
  orderByRequest,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const secret = (name: string, createTimeStr = ''): SecretKey => ({ name, createTimeStr });

const resource = (
  resourceId: string,
  credentialId: string | null,
): ConfirmedIntegrationResourceItem =>
  ({ resource_id: resourceId, credential_id: credentialId }) as ConfirmedIntegrationResourceItem;

describe('credentialEntries', () => {
  it('counts how many confirmed resources each credential is assigned to', () => {
    const entries = credentialEntries(
      [secret('cred-a'), secret('cred-b')],
      [resource('r1', 'cred-a'), resource('r2', 'cred-a'), resource('r3', 'cred-b')],
    );
    expect(entries.map((entry) => [entry.name, entry.assignedCount])).toEqual([
      ['cred-a', 2],
      ['cred-b', 1],
    ]);
  });

  it('keeps an unassigned credential in the list at 0 — it is the answer to "무엇이 안 쓰이나"', () => {
    const entries = credentialEntries([secret('unused')], []);
    expect(entries).toEqual([
      { name: 'unused', createdAt: null, assignedCount: 0, missing: false },
    ]);
  });

  it('surfaces an assignment the secrets list no longer carries, marked missing and sorted first', () => {
    const entries = credentialEntries(
      [secret('cred-a')],
      [resource('r1', 'cred-a'), resource('r2', 'cred-a'), resource('r3', 'ghost')],
    );
    expect(entries[0]).toEqual({
      name: 'ghost',
      createdAt: null,
      assignedCount: 1,
      missing: true,
    });
    // …even though cred-a has more assignments — 조치가 필요한 쪽이 위로 온다.
    expect(entries[1]?.name).toBe('cred-a');
  });

  it('carries create_time_str through as the entry timestamp', () => {
    const [entry] = credentialEntries([secret('cred-a', '2026-03-01T00:00:00Z')], []);
    expect(entry?.createdAt).toBe('2026-03-01T00:00:00Z');
  });

  it('ignores resources with no credential assigned', () => {
    const entries = credentialEntries([secret('cred-a')], [resource('r1', null)]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.assignedCount).toBe(0);
  });
});

describe('filterCredentials', () => {
  const entries = credentialEntries(
    [secret('svc-mysql-prod'), secret('svc-mysql-stg'), secret('ORDER-Oracle-01')],
    [],
  );

  it('returns every entry for an empty query', () => {
    expect(filterCredentials(entries, '')).toHaveLength(3);
    expect(filterCredentials(entries, '   ')).toHaveLength(3);
  });

  it('matches on a substring of the name', () => {
    expect(filterCredentials(entries, 'mysql').map((e) => e.name)).toEqual([
      'svc-mysql-prod',
      'svc-mysql-stg',
    ]);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(filterCredentials(entries, '  oracle  ').map((e) => e.name)).toEqual(['ORDER-Oracle-01']);
  });

  it('returns nothing when no name matches — not the whole list', () => {
    expect(filterCredentials(entries, 'postgres')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    filterCredentials(entries, '');
    expect(entries).toHaveLength(3);
  });
});

describe('orderByRequest', () => {
  const rows = [resource('c', null), resource('a', null), resource('b', null)];
  const ids = (list: ConfirmedIntegrationResourceItem[]): (string | null | undefined)[] =>
    list.map((row) => row.resource_id);

  it('restates confirmed rows in the Step 2 request order', () => {
    expect(ids(orderByRequest(rows, ['a', 'b', 'c']))).toEqual(['a', 'b', 'c']);
  });

  it('appends resources the request never listed, keeping their relative order', () => {
    expect(ids(orderByRequest(rows, ['b']))).toEqual(['b', 'c', 'a']);
  });

  it('keeps the confirmed order when the request could not be loaded', () => {
    expect(ids(orderByRequest(rows, []))).toEqual(['c', 'a', 'b']);
  });

  it('does not drop rows whose resource_id is absent', () => {
    const withBlank = [...rows, resource('', null)];
    expect(orderByRequest(withBlank, ['a'])).toHaveLength(4);
  });
});
