import { describe, expect, it } from 'vitest';
import { mockProjects } from '@/lib/mock-data';
import { generateAwsResource } from '@/lib/mock-scan';
import type { Resource } from '@/lib/types';

const isAthenaResource = (resource: Resource): boolean =>
  resource.awsType === 'ATHENA' ||
  resource.type === 'ATHENA' ||
  resource.type === 'ATHENA_REGION' ||
  resource.databaseType === 'ATHENA';

describe('Athena mock resource id format', () => {
  it('static mock projects do not contain legacy ath-* resource ids', () => {
    const athenaResources = mockProjects
      .filter((project) => project.cloudProvider === 'AWS')
      .flatMap((project) => project.resources.filter(isAthenaResource));

    expect(athenaResources.length).toBeGreaterThan(0);
    athenaResources.forEach((resource) => {
      expect(resource.resourceId.startsWith('athena:')).toBe(true);
      expect(resource.resourceId).not.toMatch(/^ath-\d+$/);
      expect(resource.resourceId).toMatch(/^athena:\d{12}\/[^/]+(?:\/[^/]+\/[^/]+)?$/);
    });
  });

  it('scan-generated Athena resources are table-level athena resource ids', () => {
    const generatedAthenaIds: string[] = [];

    for (let i = 0; i < 500; i += 1) {
      const resource = generateAwsResource();
      if (resource.awsType === 'ATHENA') {
        generatedAthenaIds.push(resource.resourceId);
      }
    }

    expect(generatedAthenaIds.length).toBeGreaterThan(0);
    generatedAthenaIds.forEach((resourceId) => {
      expect(resourceId).toMatch(/^athena:\d{12}\/[^/]+\/[^/]+\/[^/]+$/);
    });
  });
});
