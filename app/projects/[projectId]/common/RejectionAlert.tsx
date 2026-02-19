'use client';

import { Project } from '@/lib/types';
import { cn, statusColors, getButtonClass } from '@/lib/theme';

interface RejectionAlertProps {
  project: Project;
  onRetryRequest?: () => void;
}

export const RejectionAlert = ({ project, onRetryRequest }: RejectionAlertProps) => {
  if (!project.isRejected) return null;

  return (
    <div className={cn('rounded-lg p-4 border', statusColors.error.bg, statusColors.error.border)}>
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', statusColors.error.bg)}>
          <svg className={cn('w-5 h-5', statusColors.error.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h4 className={cn('font-medium', statusColors.error.textDark)}>승인 요청이 반려되었습니다</h4>
          {project.rejectionReason && (
            <p className={cn('text-sm mt-1', statusColors.error.text)}>사유: {project.rejectionReason}</p>
          )}
          {project.rejectedAt && (
            <p className={cn('text-xs mt-1', statusColors.error.text)}>
              반려일시: {new Date(project.rejectedAt).toLocaleString('ko-KR')}
            </p>
          )}
          {onRetryRequest && (
            <button onClick={onRetryRequest} className={`mt-2 ${getButtonClass('secondary', 'sm')}`}>
              리소스 다시 선택하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
