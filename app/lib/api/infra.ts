import { fetchJson, type FetchJsonOptions } from '@/lib/fetch-json';
import { toInternalInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';

export const fetchInfra = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(toInternalInfraApiPath(path), init);

export const fetchInfraJson = <T>(path: string, options?: FetchJsonOptions): Promise<T> =>
  fetchJson<T>(toInternalInfraApiPath(path), options);

export const fetchInfraCamelJson = async <T>(
  path: string,
  options?: FetchJsonOptions,
): Promise<T> =>
  camelCaseKeys(await fetchInfraJson<unknown>(path, options)) as T;

export const parseInfraCamelJson = async <T>(response: Response): Promise<T> =>
  camelCaseKeys(await response.json()) as T;
