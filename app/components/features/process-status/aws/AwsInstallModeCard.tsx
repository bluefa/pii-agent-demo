'use client';

import { statusColors, cn, getButtonClass } from '@/lib/theme';

interface AwsInstallModeCardProps {
  isAutoMode: boolean;
  serviceTfCompleted: boolean;
  onShowRoleGuide: () => void;
  onShowScriptGuide: () => void;
  onDownloadScript: () => void;
}

export const AwsInstallModeCard = ({
  isAutoMode,
  serviceTfCompleted,
  onShowRoleGuide,
  onShowScriptGuide,
  onDownloadScript,
}: AwsInstallModeCardProps) => {
  const colors = isAutoMode ? statusColors.info : statusColors.pending;

  if (isAutoMode) {
    return (
      <div className={cn('px-4 py-3 rounded-lg border', colors.bg, colors.border)}>
        <div className="flex items-center justify-between">
          <span className={cn('text-sm font-medium', colors.textDark)}>
            ⚡ 자동 설치 모드
          </span>
          <button
            onClick={onShowRoleGuide}
            className={cn('text-xs hover:underline', colors.textDark)}
          >
            권한 설정 가이드 →
          </button>
        </div>
        <p className={cn('text-xs mt-1', colors.text)}>
          시스템이 자동으로 설치를 실행합니다.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('px-4 py-3 rounded-lg border', colors.bg, colors.border)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-medium', colors.textDark)}>
          📋 수동 설치 모드
        </span>
        <button
          onClick={onShowScriptGuide}
          className={cn('text-xs hover:underline', colors.textDark)}
        >
          설치 가이드 보기 →
        </button>
      </div>
      {serviceTfCompleted ? (
        <p className={cn('text-xs mt-1', colors.text)}>
          설치 스크립트가 실행되었습니다.
        </p>
      ) : (
        <>
          <p className={cn('text-xs mt-1', colors.text)}>
            설치 스크립트를 다운로드하여 직접 실행해주세요.
          </p>
          <button
            onClick={onDownloadScript}
            className={cn(getButtonClass('primary', 'sm'), 'mt-2 inline-flex items-center gap-2')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            설치 스크립트 다운로드
          </button>
        </>
      )}
    </div>
  );
};
