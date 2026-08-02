import { describe, expect, it } from 'vitest';
import type { SecretKey } from '@/lib/types';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { credentialEntries } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcCredentialCard';

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
