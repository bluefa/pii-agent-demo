export const INTERNAL_INFRA_API_PREFIX = '/api/integration/v1';
export const UPSTREAM_INFRA_API_PREFIX = '/install/v1';

const ensureLeadingSlash = (path: string): string =>
  path.startsWith('/') ? path : `/${path}`;

export const toInternalInfraApiPath = (path: string): string =>
  `${INTERNAL_INFRA_API_PREFIX}${ensureLeadingSlash(path).replace(
    /^\/api\/(?:integration\/v1|infra\/v1|v1)(?=\/|$)/,
    '',
  )}`;

export const toUpstreamInfraApiPath = (path: string): string => {
  const normalizedPath = ensureLeadingSlash(path).replace(/^\/v1(?=\/|$)/, '');
  return `${UPSTREAM_INFRA_API_PREFIX}${normalizedPath}`;
};
