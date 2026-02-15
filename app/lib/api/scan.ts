import { CloudProvider, ScanStatus, ScanResult } from '@/lib/types';

const BASE_URL = '/api/v2/projects';

// ===== Response Types =====

export interface ScanStatusResponse {
  isScanning: boolean;
  canScan: boolean;
  canScanReason?: string;
  /** 쿨다운 종료 시간 (ISO 8601) */
  cooldownUntil?: string;
  currentScan: {
    scanId: string;
    status: ScanStatus;
    startedAt: string;
    progress: number;
  } | null;
  lastCompletedScan: {
    scanId: string;
    completedAt: string;
    result: ScanResult | null;
  } | null;
}

export interface StartScanResponse {
  scanId: string;
  status: 'STARTED';
  startedAt: string;
  estimatedDuration: number;
}

export interface ScanDetailResponse {
  scanId: string;
  projectId: string;
  provider: CloudProvider;
  status: ScanStatus;
  startedAt: string;
  completedAt?: string;
  progress: number;
  result?: ScanResult;
  error?: string;
}

export interface ScanHistoryResponse {
  history: Array<{
    scanId: string;
    status: 'SUCCESS' | 'FAIL';
    startedAt: string;
    completedAt: string;
    duration: number;
    result: ScanResult | null;
    error?: string;
  }>;
  total: number;
}

// ===== API Functions =====

/**
 * 스캔 상태 조회
 */
export const getScanStatus = async (
  projectId: string
): Promise<ScanStatusResponse> => {
  const res = await fetch(`${BASE_URL}/${projectId}/scan/status`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '스캔 상태 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * 스캔 시작
 */
export const startScan = async (
  projectId: string,
  force?: boolean
): Promise<StartScanResponse> => {
  const res = await fetch(`${BASE_URL}/${projectId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '스캔 시작에 실패했습니다.');
  }
  return await res.json();
};

/**
 * 스캔 상세 조회
 */
export const getScanDetail = async (
  projectId: string,
  scanId: string
): Promise<ScanDetailResponse> => {
  const res = await fetch(`${BASE_URL}/${projectId}/scan/${scanId}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '스캔 상세 조회에 실패했습니다.');
  }
  return await res.json();
};

/**
 * 스캔 이력 조회
 */
export const getScanHistory = async (
  projectId: string,
  limit?: number,
  offset?: number
): Promise<ScanHistoryResponse> => {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));

  const queryString = params.toString();
  const url = queryString
    ? `${BASE_URL}/${projectId}/scan/history?${queryString}`
    : `${BASE_URL}/${projectId}/scan/history`;

  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || '스캔 이력 조회에 실패했습니다.');
  }
  return await res.json();
};
