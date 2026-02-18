'use client';

import { cn, statusColors } from '@/lib/theme';

interface ApprovalApplyingBannerProps {
  className?: string;
}

export const ApprovalApplyingBanner = ({ className }: ApprovalApplyingBannerProps) => (
  <div className={cn(
    'w-full p-4 rounded-lg border mb-3',
    statusColors.info.bg,
    statusColors.info.border,
    className,
  )}>
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className={cn('font-medium', statusColors.info.textDark)}>
          승인이 완료되어 연동을 반영하고 있습니다
        </p>
        <p className={cn('text-sm mt-1', statusColors.info.text)}>
          반영은 최대 하루 소요될 수 있습니다. 완료 시 알림을 보내드립니다.
        </p>
      </div>
    </div>
  </div>
);
