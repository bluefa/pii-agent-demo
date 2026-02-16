import { fetchJson } from '@/lib/fetch-json';
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

/** 최신 스캔 작업 조회 (polling용) — 404는 컴포넌트(Layer 2)에서 처리 */
export const getLatestScanJob = async (targetSourceId: number): Promise<V1ScanJob> =>
  fetchJson<V1ScanJob>(`${BASE_URL}/${targetSourceId}/scanJob/latest`);

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
