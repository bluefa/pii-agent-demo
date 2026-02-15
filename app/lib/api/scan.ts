import { fetchJson } from '@/lib/fetch-json';
import { AppError } from '@/lib/errors';
import type { V1ScanJob } from '@/lib/types';

const BASE_URL = '/api/v1/target-sources';

// v1 Scan History Response
export interface V1ScanHistoryResponse {
  content: V1ScanJob[];
  page: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
}

/** 스캔 시작 */
export const startScan = async (targetSourceId: number): Promise<V1ScanJob> =>
  fetchJson<V1ScanJob>(`${BASE_URL}/${targetSourceId}/scan`, {
    method: 'POST',
    body: {},
  });

/** 최신 스캔 작업 조회 (polling용) — 404는 null 반환 */
export const getLatestScanJob = async (targetSourceId: number): Promise<V1ScanJob | null> => {
  try {
    return await fetchJson<V1ScanJob>(`${BASE_URL}/${targetSourceId}/scanJob/latest`);
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') return null;
    throw err;
  }
};

/** 스캔 이력 조회 (페이지네이션) */
export const getScanHistory = async (
  targetSourceId: number,
  page?: number,
  size?: number,
): Promise<V1ScanHistoryResponse> => {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', String(page));
  if (size !== undefined) params.set('size', String(size));
  const qs = params.toString();

  return fetchJson<V1ScanHistoryResponse>(
    `${BASE_URL}/${targetSourceId}/scan/history${qs ? `?${qs}` : ''}`,
  );
};
