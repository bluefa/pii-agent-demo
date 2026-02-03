'use client';

interface ScanProgressBarProps {
  progress: number;
  startedAt?: string;
}

const formatElapsedTime = (startedAt: string): string | null => {
  try {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const diffMs = now - start;

    if (diffMs < 0) return null;

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}초`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}분 ${remainingSeconds}초`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분`;
  } catch {
    return null;
  }
};

export const ScanProgressBar = ({ progress, startedAt }: ScanProgressBarProps) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const elapsedTime = startedAt ? formatElapsedTime(startedAt) : null;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-orange-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        >
          {/* 애니메이션 효과 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {clampedProgress < 100 ? '리소스 스캔 중...' : '스캔 완료'}
        </span>
        <div className="flex items-center gap-3 text-gray-500">
          {elapsedTime && (
            <span className="text-xs">경과: {elapsedTime}</span>
          )}
          <span className="font-medium text-orange-600">{clampedProgress}%</span>
        </div>
      </div>
    </div>
  );
};

export default ScanProgressBar;
