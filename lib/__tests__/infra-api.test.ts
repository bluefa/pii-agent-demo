import { describe, expect, it } from 'vitest';
import { toInternalInfraApiPath, toUpstreamInfraApiPath } from '@/lib/infra-api';

describe('lib/infra-api', () => {
  it.each([
    ['/user/me', '/integration/api/v1/user/me'],
    ['/v1/user/me', '/integration/api/v1/user/me'],
    ['/integration/v1/user/me', '/integration/api/v1/user/me'],
    ['/api/integration/v1/user/me', '/integration/api/v1/user/me'],
    ['/integration/api/v1/user/me', '/integration/api/v1/user/me'],
  ])('toInternalInfraApiPath normalizes %s', (input, expected) => {
    expect(toInternalInfraApiPath(input)).toBe(expected);
  });

  it.each([
    ['/user/me', '/install/v1/user/me'],
    ['/v1/user/me', '/install/v1/user/me'],
    ['/api/infra/v1/user/me', '/install/v1/user/me'],
    ['/api/integration/v1/user/me', '/install/v1/user/me'],
    ['/integration/api/v1/user/me', '/install/v1/user/me'],
  ])('toUpstreamInfraApiPath keeps install/v1 for %s', (input, expected) => {
    expect(toUpstreamInfraApiPath(input)).toBe(expected);
  });
});
