'use client';

import { useState, useEffect, useRef } from 'react';

interface CooldownTimerProps {
  /** 쿨다운 종료 시간 (ISO 8601) */
  cooldownUntil: string;
  /** 쿨다운 종료 시 호출 */
  onCooldownEnd?: () => void;
}

export const formatRemainingTime = (remainingMs: number): string => {
  if (remainingMs <= 0) return '0초';

  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) return `${seconds}초`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}분 ${remainingSeconds}초`;
};

/** 쿨다운 남은 시간을 계산하는 훅 */
export const useCooldownTimer = (cooldownUntil: string | undefined, onCooldownEnd?: () => void) => {
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!cooldownUntil) return 0;
    return Math.max(0, new Date(cooldownUntil).getTime() - Date.now());
  });

  const onCooldownEndRef = useRef(onCooldownEnd);

  useEffect(() => {
    onCooldownEndRef.current = onCooldownEnd;
  }, [onCooldownEnd]);

  useEffect(() => {
    if (!cooldownUntil) {
      queueMicrotask(() => setRemainingMs(0));
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, new Date(cooldownUntil).getTime() - Date.now());
      setRemainingMs(remaining);

      if (remaining <= 0) {
        onCooldownEndRef.current?.();
      }
    };

    updateRemaining();
    const intervalId = setInterval(updateRemaining, 1000);

    return () => clearInterval(intervalId);
  }, [cooldownUntil]);

  return {
    remainingMs,
    isExpired: remainingMs <= 0,
    formatted: formatRemainingTime(remainingMs),
  };
};

export const CooldownTimer = ({ cooldownUntil, onCooldownEnd }: CooldownTimerProps) => {
  const { remainingMs, formatted } = useCooldownTimer(cooldownUntil, onCooldownEnd);

  if (remainingMs <= 0) {
    return (
      <span className="text-green-600 font-medium">스캔 가능</span>
    );
  }

  return (
    <span>{formatted} 후 스캔 가능</span>
  );
};

export default CooldownTimer;
