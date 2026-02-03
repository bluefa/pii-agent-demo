'use client';

import { useState, useEffect } from 'react';

interface CooldownTimerProps {
  /** 쿨다운 종료 시간 (ISO 8601) */
  cooldownUntil: string;
  /** 쿨다운 종료 시 호출 */
  onCooldownEnd?: () => void;
}

const formatRemainingTime = (remainingMs: number): string => {
  if (remainingMs <= 0) return '0초';

  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) return `${seconds}초`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}분 ${remainingSeconds}초`;
};

export const CooldownTimer = ({ cooldownUntil, onCooldownEnd }: CooldownTimerProps) => {
  const [remainingMs, setRemainingMs] = useState(() => {
    return new Date(cooldownUntil).getTime() - Date.now();
  });

  useEffect(() => {
    const updateRemaining = () => {
      const remaining = new Date(cooldownUntil).getTime() - Date.now();
      setRemainingMs(remaining);

      if (remaining <= 0) {
        onCooldownEnd?.();
      }
    };

    // 초기 업데이트
    updateRemaining();

    // 1초마다 업데이트
    const intervalId = setInterval(updateRemaining, 1000);

    return () => clearInterval(intervalId);
  }, [cooldownUntil, onCooldownEnd]);

  if (remainingMs <= 0) {
    return (
      <span className="text-green-600 font-medium">스캔 가능</span>
    );
  }

  return (
    <span>{formatRemainingTime(remainingMs)} 후 스캔 가능</span>
  );
};

export default CooldownTimer;
