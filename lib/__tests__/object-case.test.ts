import { describe, it, expect } from 'vitest';
import { camelCaseKeys, snakeCaseKeys } from '@/lib/object-case';

describe('object-case', () => {
  it('camelCaseKeys converts snake keys deeply, through arrays', () => {
    expect(
      camelCaseKeys({
        target_source_id: 1,
        resource_infos: [{ resource_id: 'r-1', database_type: 'MYSQL' }],
      }),
    ).toEqual({
      targetSourceId: 1,
      resourceInfos: [{ resourceId: 'r-1', databaseType: 'MYSQL' }],
    });
  });

  it('snakeCaseKeys is the inverse for round-tripping', () => {
    const camel = { cloudProvider: 'AWS', awsAccountId: '123', nested: { isChinaRegion: false } };
    expect(camelCaseKeys(snakeCaseKeys(camel))).toEqual(camel);
  });

  describe('ADR-019 D2.3 opaque-value-keys guard', () => {
    it('transforms the field name but leaves a data-keyed map value verbatim (lower-case key preserved)', () => {
      const wire = {
        scan_job_id: 'job-1',
        // keys here are DATA (resource types), not DTO field names
        resource_count_by_resource_type: { RDS_CLUSTER: 2, lower_case_key: 5 },
      };
      expect(camelCaseKeys(wire)).toEqual({
        scanJobId: 'job-1',
        // field name flipped; inner keys untouched (lower_case_key NOT corrupted)
        resourceCountByResourceType: { RDS_CLUSTER: 2, lower_case_key: 5 },
      });
    });

    it('also guards the already-camel field name (snakeCaseKeys leaves inner keys verbatim)', () => {
      const domain = { resourceCountByResourceType: { rdsCluster: 1, S3: 3 } };
      expect(snakeCaseKeys(domain)).toEqual({
        resource_count_by_resource_type: { rdsCluster: 1, S3: 3 },
      });
    });
  });
});
