'use client';

import { TargetSource } from '@/lib/types';
import { cn, statusColors } from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { TS_COPY } from '@/app/target-sources/[targetSourceId]/_components/copy';

interface RejectionAlertProps {
  project: TargetSource;
}

export const RejectionAlert = ({ project }: RejectionAlertProps) => {
  const { locale } = useLocale();
  const t = TS_COPY[locale].common;

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
          <h4 className={cn('font-medium', statusColors.error.textDark)}>{t.rejectedTitle}</h4>
          {project.rejectionReason && (
            <p className={cn('text-sm mt-1', statusColors.error.text)}>
              {t.rejectedReason(project.rejectionReason)}
            </p>
          )}
          {project.rejectedAt && (
            <p className={cn('text-xs mt-1', statusColors.error.text)}>
              {/* The stamp follows the reader's language too — a ko-KR string prints its
                  own 오전/오후 marker, which is Korean text on an English screen. */}
              {t.rejectedAt(
                new Date(project.rejectedAt).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR'),
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
