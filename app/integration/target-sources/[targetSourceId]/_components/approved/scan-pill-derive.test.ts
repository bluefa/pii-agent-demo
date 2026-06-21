import { describe, it, expect } from 'vitest';
import type { ApprovedResource } from '@/lib/types/resources';
import { deriveScanPill } from '@/app/integration/target-sources/[targetSourceId]/_components/approved/scan-pill-derive';

const buildResource = (overrides: Partial<ApprovedResource> = {}): ApprovedResource => ({
  resourceId: 'res-001',
  type: 'RDS',
  databaseType: 'MYSQL',
  endpointConfig: null,
  credentialId: null,
  ...overrides,
});

describe('deriveScanPill', () => {
  it('returns "kept" for any approved resource (no signal source yet)', () => {
    expect(deriveScanPill(buildResource())).toBe('kept');
  });

  it('returns "kept" regardless of resource type or database type', () => {
    expect(deriveScanPill(buildResource({ type: 'DYNAMODB', databaseType: 'DYNAMODB' }))).toBe('kept');
    expect(deriveScanPill(buildResource({ type: 'RDS', databaseType: 'POSTGRESQL' }))).toBe('kept');
  });

  it('returns "kept" when credentialId is null and when set', () => {
    expect(deriveScanPill(buildResource({ credentialId: null }))).toBe('kept');
    expect(deriveScanPill(buildResource({ credentialId: 'cred-1' }))).toBe('kept');
  });
});
