import { describe, expect, it } from 'vitest';
import { toInternalInfraApiPath, toUpstreamInfraApiPath } from '@/lib/infra-api';

describe('lib/infra-api', () => {
  it.each([
    ['/user/me', '/install/v1/user/me'],
    ['/target-sources/abc', '/install/v1/target-sources/abc'],
    ['user/me', '/install/v1/user/me'],
  ])('toUpstreamInfraApiPath prepends /install/v1 for %s', (input, expected) => {
    expect(toUpstreamInfraApiPath(input)).toBe(expected);
  });

  it.each([
    ['/user/me', '/integration/api/v1/user/me'],
    ['/target-sources/abc', '/integration/api/v1/target-sources/abc'],
    ['user/me', '/integration/api/v1/user/me'],
  ])('toInternalInfraApiPath prepends /integration/api/v1 for %s', (input, expected) => {
    expect(toInternalInfraApiPath(input)).toBe(expected);
  });
});
