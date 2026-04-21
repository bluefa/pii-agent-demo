export const INTERNAL_INFRA_API_PREFIX = '/integration/api/v1';
export const UPSTREAM_INFRA_API_PREFIX = '/install/v1';

const ensureLeadingSlash = (path: string): string =>
  path.startsWith('/') ? path : `/${path}`;

export const toInternalInfraApiPath = (path: string): string =>
  `${INTERNAL_INFRA_API_PREFIX}${ensureLeadingSlash(path)}`;

export const toUpstreamInfraApiPath = (path: string): string =>
  `${UPSTREAM_INFRA_API_PREFIX}${ensureLeadingSlash(path)}`;
