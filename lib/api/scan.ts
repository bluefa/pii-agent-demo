import { CloudProvider, ScanJob, ScanStatus, ScanResult, ScanHistory } from '@/lib/types';

// ===== API Response Types =====

export interface ScanStatusResponse {
  isScanning: boolean;
  currentScan: {
    id: string;
    status: ScanStatus;
    progress: number;
    startedAt: string;
    estimatedEndAt: string;
  } | null;
  lastScan: {
    id: string;
    completedAt: string;
    result: ScanResult;
  } | null;
  canScan: boolean;
  cannotScanReason?: 'SCAN_IN_PROGRESS' | 'COOLDOWN_ACTIVE' | 'UNSUPPORTED_PROVIDER';
  cooldownEndsAt?: string;
}

export interface StartScanResponse {
  scanId: string;
  status: ScanStatus;
  estimatedDuration: number;
}

export interface ScanDetailResponse {
  id: string;
  projectId: string;
  provider: CloudProvider;
  status: ScanStatus;
  progress: number;
  startedAt: string;
  completedAt?: string;
  result?: ScanResult;
  error?: string;
}

export interface ScanHistoryResponse {
  history: ScanHistory[];
  total: number;
}

// ===== API Functions =====

const API_BASE = '/api/v2/projects';

/**
 * 스캔 상태 조회
 */
export const getScanStatus = async (projectId: string): Promise<ScanStatusResponse> => {
  const response = await fetch(`${API_BASE}/${projectId}/scan/status`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '스캔 상태 조회에 실패했습니다.');
  }

  return response.json();
};

/**
 * 스캔 시작
 */
export const startScan = async (
  projectId: string,
  options?: { force?: boolean }
): Promise<StartScanResponse> => {
  const response = await fetch(`${API_BASE}/${projectId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: options?.force ?? false }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '스캔 시작에 실패했습니다.');
  }

  return response.json();
};

/**
 * 특정 스캔 상세 조회
 */
export const getScanDetail = async (
  projectId: string,
  scanId: string
): Promise<ScanDetailResponse> => {
  const response = await fetch(`${API_BASE}/${projectId}/scan/${scanId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '스캔 상세 조회에 실패했습니다.');
  }

  return response.json();
};

/**
 * 스캔 이력 조회
 */
export const getScanHistory = async (
  projectId: string,
  options?: { limit?: number; offset?: number }
): Promise<ScanHistoryResponse> => {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const url = `${API_BASE}/${projectId}/scan/history${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '스캔 이력 조회에 실패했습니다.');
  }

  return response.json();
};

/**
 * 스캔 지원 여부 확인
 */
export const isScanSupported = (provider: CloudProvider): boolean => {
  return ['AWS', 'Azure', 'GCP'].includes(provider);
};
