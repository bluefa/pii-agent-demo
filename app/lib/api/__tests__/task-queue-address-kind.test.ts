import { describe, expect, it } from 'vitest';
import { idcAddressKind } from '@/app/lib/api/task-queue-requests';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

const row = (over: Partial<RequestResourceRow>): RequestResourceRow => ({
  resourceId: 'r-1',
  resourceName: null,
  selected: true,
  exclusionReason: null,
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'MYSQL',
  region: null,
  idcKind: 'IP',
  connectTargets: ['10.0.0.1'],
  port: 3306,
  oracleSid: null,
  sourceIps: [],
  nlbIndex: null,
  resourceType: null,
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
  ...over,
});

describe('idcAddressKind', () => {
  it('HOST 모드는 주소 개수와 무관하게 DOMAIN', () => {
    expect(idcAddressKind(row({ idcKind: 'HOST', connectTargets: ['db.corp.io'] }))).toBe('DOMAIN');
  });

  it('IP 2개 이상은 MULTIPLE_IP', () => {
    expect(idcAddressKind(row({ connectTargets: ['10.0.0.1', '10.0.0.2'] }))).toBe('MULTIPLE_IP');
  });

  it('IP 1개는 SINGLE', () => {
    expect(idcAddressKind(row({}))).toBe('SINGLE');
  });

  // A cloud row has no host format, so there is nothing to classify — the badge must be
  // omitted rather than defaulting to SINGLE, which would assert an addressing shape the
  // request never reported.
  it('비 IDC 행은 null', () => {
    expect(idcAddressKind(row({ idcKind: null, connectTargets: [] }))).toBeNull();
  });
});
