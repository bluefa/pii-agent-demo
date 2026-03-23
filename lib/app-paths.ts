export const APP_BASE_PATH = '/integration';

const ensureLeadingSlash = (path: string): string =>
  path.startsWith('/') ? path : `/${path}`;

export const withAppBasePath = (path: string): string => {
  const normalizedPath = ensureLeadingSlash(path);
  if (!APP_BASE_PATH) return normalizedPath;
  if (normalizedPath === APP_BASE_PATH || normalizedPath.startsWith(`${APP_BASE_PATH}/`)) {
    return normalizedPath;
  }
  return `${APP_BASE_PATH}${normalizedPath}`;
};

export const stripAppBasePath = (path: string): string => {
  const normalizedPath = ensureLeadingSlash(path);
  if (!APP_BASE_PATH) return normalizedPath;
  if (normalizedPath === APP_BASE_PATH) return '/';
  if (normalizedPath.startsWith(`${APP_BASE_PATH}/`)) {
    return normalizedPath.slice(APP_BASE_PATH.length);
  }
  return normalizedPath;
};
