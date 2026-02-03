'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { CloudProvider, ScanStatus, ScanResult } from '@/lib/types';
import {
  getScanStatus,
  startScan,
  getScanDetail,
  isScanSupported,
  ScanStatusResponse,
} from '@/lib/api/scan';

const POLL_INTERVAL_MS = 2000;

export interface UseScanOptions {
  /** 자동 폴링 활성화 (기본: true) */
  autoRefresh?: boolean;
  /** 스캔 완료 시 콜백 */
  onScanComplete?: (result: ScanResult) => void;
  /** 스캔 실패 시 콜백 */
  onScanError?: (error: string) => void;
}

export interface UseScanReturn {
  // 상태
  isScanning: boolean;
  scanStatus: ScanStatus | null;
  progress: number;
  canScan: boolean;
  cannotScanReason: ScanStatusResponse['cannotScanReason'] | null;
  cooldownEndsAt: Date | null;
  lastResult: ScanResult | null;
  lastScanAt: Date | null;
  error: Error | null;
  isLoading: boolean;

  // 액션
  startScan: (force?: boolean) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

/**
 * 리소스 스캔 상태 관리 훅
 *
 * @example
 * const { isScanning, canScan, startScan, progress } = useScan(projectId, 'AWS', {
 *   onScanComplete: (result) => {
 *     refreshResources();
 *     toast.success(`${result.newFound}개 신규 리소스 발견`);
 *   },
 * });
 */
export const useScan = (
  projectId: string,
  cloudProvider: CloudProvider,
  options: UseScanOptions = {}
): UseScanReturn => {
  const { autoRefresh = true, onScanComplete, onScanError } = options;

  // 상태
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [canScan, setCanScan] = useState(false);
  const [cannotScanReason, setCannotScanReason] = useState<ScanStatusResponse['cannotScanReason'] | null>(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refs
  const currentScanIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Provider 지원 여부
  const isSupported = isScanSupported(cloudProvider);

  // 폴링 정리
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // 스캔 상태 갱신
  const refreshStatus = useCallback(async () => {
    if (!isSupported) {
      setCanScan(false);
      setCannotScanReason('UNSUPPORTED_PROVIDER');
      setIsLoading(false);
      return;
    }

    try {
      const status = await getScanStatus(projectId);

      setIsScanning(status.isScanning);
      setCanScan(status.canScan);
      setCannotScanReason(status.cannotScanReason ?? null);
      setCooldownEndsAt(status.cooldownEndsAt ? new Date(status.cooldownEndsAt) : null);

      if (status.currentScan) {
        currentScanIdRef.current = status.currentScan.id;
        setScanStatus(status.currentScan.status);
        setProgress(status.currentScan.progress);
      } else {
        currentScanIdRef.current = null;
        setScanStatus(null);
        setProgress(0);
      }

      if (status.lastScan) {
        setLastResult(status.lastScan.result);
        setLastScanAt(new Date(status.lastScan.completedAt));
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, isSupported]);

  // 스캔 진행 상태 폴링
  const pollScanProgress = useCallback(async () => {
    const scanId = currentScanIdRef.current;
    if (!scanId) {
      stopPolling();
      return;
    }

    try {
      const detail = await getScanDetail(projectId, scanId);

      setScanStatus(detail.status);
      setProgress(detail.progress);

      if (detail.status === 'COMPLETED') {
        stopPolling();
        setIsScanning(false);
        currentScanIdRef.current = null;

        if (detail.result) {
          setLastResult(detail.result);
          setLastScanAt(new Date(detail.completedAt!));
          onScanComplete?.(detail.result);
        }

        // 완료 후 상태 갱신
        await refreshStatus();
      } else if (detail.status === 'FAILED') {
        stopPolling();
        setIsScanning(false);
        currentScanIdRef.current = null;

        if (detail.error) {
          setError(new Error(detail.error));
          onScanError?.(detail.error);
        }

        await refreshStatus();
      }
    } catch (err) {
      // 폴링 에러는 무시 (다음 폴링에서 재시도)
      console.error('Scan polling error:', err);
    }
  }, [projectId, stopPolling, refreshStatus, onScanComplete, onScanError]);

  // 스캔 시작
  const handleStartScan = useCallback(
    async (force = false) => {
      if (!isSupported) {
        setError(new Error('지원되지 않는 클라우드 프로바이더입니다.'));
        return;
      }

      try {
        setError(null);
        setIsScanning(true);
        setProgress(0);
        setScanStatus('PENDING');

        const response = await startScan(projectId, { force });
        currentScanIdRef.current = response.scanId;

        // 폴링 시작
        if (autoRefresh) {
          stopPolling();
          pollIntervalRef.current = setInterval(pollScanProgress, POLL_INTERVAL_MS);
        }
      } catch (err) {
        setIsScanning(false);
        setScanStatus(null);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [projectId, isSupported, autoRefresh, stopPolling, pollScanProgress]
  );

  // 초기 로드
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // 진행 중인 스캔이 있으면 폴링 시작
  useEffect(() => {
    if (isScanning && autoRefresh && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(pollScanProgress, POLL_INTERVAL_MS);
    }

    return () => {
      stopPolling();
    };
  }, [isScanning, autoRefresh, pollScanProgress, stopPolling]);

  return {
    isScanning,
    scanStatus,
    progress,
    canScan,
    cannotScanReason,
    cooldownEndsAt,
    lastResult,
    lastScanAt,
    error,
    isLoading,
    startScan: handleStartScan,
    refreshStatus,
  };
};

export default useScan;
