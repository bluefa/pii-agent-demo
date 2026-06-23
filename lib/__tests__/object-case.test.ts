import { describe, expect, it } from 'vitest';
import { camelCaseKeys } from '@/lib/object-case';

describe('camelCaseKeys', () => {
  it('converts nested snake_case field names to camelCase', () => {
    expect(
      camelCaseKeys({
        scan_status: 'DONE',
        nested_obj: { created_at: '2026-01-01', items: [{ item_id: 1 }] },
      }),
    ).toEqual({
      scanStatus: 'DONE',
      nestedObj: { createdAt: '2026-01-01', items: [{ itemId: 1 }] },
    });
  });

  it('camelCases the field name but preserves data-keyed map values (OpaqueKeys)', () => {
    // resource_count_by_resource_type keys are resource-type enum *values*, not
    // field names — they must survive verbatim (ADR-019 D2.3).
    expect(
      camelCaseKeys({
        resource_count_by_resource_type: { RDS_CLUSTER: 3, AZURE_MSSQL: 1 },
      }),
    ).toEqual({
      resourceCountByResourceType: { RDS_CLUSTER: 3, AZURE_MSSQL: 1 },
    });
  });

  it('does not corrupt a lower-case data key inside the opaque map', () => {
    // The latent bug the guard fixes: without opaque handling, a lower-case key
    // like `my_db` would be mangled to `myDb` by the boundary regex.
    expect(
      camelCaseKeys({
        resource_count_by_resource_type: { my_db: 2, RDS_CLUSTER: 3 },
      }),
    ).toEqual({
      resourceCountByResourceType: { my_db: 2, RDS_CLUSTER: 3 },
    });
  });
});
