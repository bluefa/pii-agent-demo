import { describe, expect, it } from 'vitest';
import { findResourceMappings } from '@/app/admin/pipelines/queue/requests/_components/NlbMappingModal';
import type { ResourceNlbMappings } from '@/app/lib/api/task-queue-requests';

const mappings: ResourceNlbMappings[] = [
  {
    resourceId: 'idc-r-8f21',
    mappings: [
      { serviceCode: 'ORD', nlbIndex: 3 },
      { serviceCode: 'PAY', nlbIndex: 5 },
    ],
  },
  { resourceId: 'idc-r-8f24', mappings: [] },
];

describe('findResourceMappings', () => {
  it('returns null when the fetch failed (mappings === null)', () => {
    expect(findResourceMappings(null, 'idc-r-8f21')).toBeNull();
  });

  it('returns null when the row has no resource_id key', () => {
    expect(findResourceMappings(mappings, null)).toBeNull();
  });

  it('returns the resource entry mappings when found', () => {
    expect(findResourceMappings(mappings, 'idc-r-8f21')).toEqual([
      { serviceCode: 'ORD', nlbIndex: 3 },
      { serviceCode: 'PAY', nlbIndex: 5 },
    ]);
  });

  it('returns [] for a found-but-empty entry (배정 없음, not a failure)', () => {
    expect(findResourceMappings(mappings, 'idc-r-8f24')).toEqual([]);
  });

  it('returns [] when the resource is absent from a successful fetch', () => {
    expect(findResourceMappings(mappings, 'idc-r-9999')).toEqual([]);
  });
});
