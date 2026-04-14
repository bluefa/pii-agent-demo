

import { fetchJson, type FetchJsonOptions } from '@/lib/fetch-json';
import { toInternalInfraApiPath, toUpstreamInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';

const BFF_URL = process.env.BFF_API_URL || 'http://localhost:8082';

export const fetchInfra = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(toInternalInfraApiPath(path), init);

export const fetchInfraJson = <T>(path: string, options?: FetchJsonOptions): Promise<T> => {
  const internalPath = toInternalInfraApiPath(path);
  console.log('API 호출 - 내부 경로:', path, '→ 프록시 경로:', internalPath);
  return fetchJson<T>(internalPath, options);
};

export const fetchInfraCamelJson = async <T>(
  path: string,
  options?: FetchJsonOptions,
): Promise<T> =>
  camelCaseKeys(await fetchInfraJson<T>(path, options)) as T;

export const parseInfraCamelJson = async <T>(response: Response): Promise<T> =>
  camelCaseKeys(await response.json()) as T;
