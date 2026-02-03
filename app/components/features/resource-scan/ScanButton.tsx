'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/Button';

interface ScanButtonProps {
  /** 스캔 가능 여부 */
  canScan: boolean;
  /** 스캔 진행 중 여부 */
  isScanning: boolean;
  /** 쿨다운 종료 시각 */
  cooldownEndsAt: Date | null;
  /** 스캔 불가 사유 */
  cannotScanReason?: 'SCAN_IN_PROGRESS' | 'COOLDOWN_ACTIVE' | 'UNSUPPORTED_PROVIDER' | null;
  /** 스캔 시작 핸들러 */
  onScan: () => void;
}

/**
 * 리소스 스캔 버튼
 * - 스캔 가능: "리소스 스캔" 버튼
 * - 스캔 중: 스피너 + "스캔 중..."
 * - 쿨다운: 남은 시간 카운트다운
 */
export const ScanButton = ({
  canScan,
  isScanning,
  cooldownEndsAt,
  cannotScanReason,
  onScan,
}: ScanButtonProps) => {
  const [remainingTime, setRemainingTime] = useState<string | null>(null);

  // 쿨다운 타이머
  useEffect(() => {
    if (!cooldownEndsAt || cannotScanReason !== 'COOLDOWN_ACTIVE') {
      setRemainingTime(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const diff = cooldownEndsAt.getTime() - now.getTime();

      if (diff <= 0) {
        setRemainingTime(null);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setRemainingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [cooldownEndsAt, cannotScanReason]);

  // 미지원 Provider는 버튼 숨김
  if (cannotScanReason === 'UNSUPPORTED_PROVIDER') {
    return null;
  }

  // 버튼 텍스트 결정
  const getButtonText = () => {
    if (isScanning) {
      return '스캔 중...';
    }
    if (remainingTime) {
      return `${remainingTime} 후 재스캔`;
    }
    return '리소스 스캔';
  };

  // 버튼 비활성화 조건
  const isDisabled = !canScan || isScanning;

  return (
    <Button
      variant={isScanning ? 'secondary' : 'primary'}
      size="sm"
      onClick={onScan}
      disabled={isDisabled}
      className="min-w-[120px]"
    >
      {isScanning && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!isScanning && (
        <svg
          className="mr-1.5 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      )}
      {getButtonText()}
    </Button>
  );
};

export default ScanButton;
