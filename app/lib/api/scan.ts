import { fetchInfraJson } from '@/app/lib/api/infra';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

const BASE_URL = '/target-sources';

/** 스캔 시작 */
export const startScan = async (
  targetSourceId: number,
): Promise<z.infer<typeof schemas.ScanJobResponse>> =>
  fetchInfraJson(`${BASE_URL}/${targetSourceId}/scan`, {
    method: 'POST',
    body: {},
  });

/** 최신 스캔 작업 조회 (polling용) — 404는 컴포넌트(Layer 2)에서 처리 */
export const getLatestScanJob = async (
  targetSourceId: number,
): Promise<z.infer<typeof schemas.ScanJobResponse>> =>
  fetchInfraJson(`${BASE_URL}/${targetSourceId}/scanJob/latest`);

/** 스캔 이력 조회 (페이지네이션) */
export const getScanHistory = async (
  targetSourceId: number,
  page?: number,
  size?: number,
): Promise<z.infer<typeof schemas.PageScanJobResponse>> => {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', String(page));
  if (size !== undefined) params.set('size', String(size));
  const qs = params.toString();

  return fetchInfraJson(
    `${BASE_URL}/${targetSourceId}/scan/history${qs ? `?${qs}` : ''}`,
  );
};
