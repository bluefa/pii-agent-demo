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
export const startScan = async (targetSourceId: number): Promise<V1ScanJob> => {
  const res = await fetch(`${BASE_URL}/${targetSourceId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '스캔 시작에 실패했습니다.');
  }
  return await res.json();
};

/** 최신 스캔 작업 조회 (polling용) */
export const getLatestScanJob = async (targetSourceId: number): Promise<V1ScanJob | null> => {
  const res = await fetch(`${BASE_URL}/${targetSourceId}/scanJob/latest`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '스캔 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

/** 스캔 이력 조회 (페이지네이션) */
export const getScanHistory = async (
  targetSourceId: number,
  page?: number,
  size?: number
): Promise<V1ScanHistoryResponse> => {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', String(page));
  if (size !== undefined) params.set('size', String(size));

  const queryString = params.toString();
  const url = queryString
    ? `${BASE_URL}/${targetSourceId}/scan/history?${queryString}`
    : `${BASE_URL}/${targetSourceId}/scan/history`;

  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '스캔 이력 조회에 실패했습니다.');
  }
  return await res.json();
};
