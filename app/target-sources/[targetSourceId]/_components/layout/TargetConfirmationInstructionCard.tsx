'use client';

import type { CloudTargetSource } from '@/lib/types';
import { cn, statusColors } from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { LAYOUT_COPY } from '@/app/target-sources/[targetSourceId]/_components/layout/copy';

interface TargetConfirmationInstructionCardProps {
  project: CloudTargetSource;
}

export const TargetConfirmationInstructionCard = ({
  project,
}: TargetConfirmationInstructionCardProps) => {
  const { locale } = useLocale();
  const t = LAYOUT_COPY[locale].instruction;
  return (
  <div className={cn('w-full p-4 rounded-lg space-y-2', statusColors.info.bg, statusColors.info.border, 'border')}>
    <p className={cn('text-sm font-medium', statusColors.info.textDark)}>
      {project.cloudProvider === 'AWS' ? t.awsTitle : t.otherTitle}
    </p>
    <ol className={cn('text-sm list-decimal list-inside space-y-1', statusColors.info.textDark)}>
      {project.cloudProvider === 'AWS' ? (
        <>
          <li>{t.awsStep1}</li>
          <li>{t.awsStep2}</li>
          <li>{t.awsStep3}</li>
          <li>{t.awsStep4}</li>
        </>
      ) : (
        <li>{t.otherStep}</li>
      )}
    </ol>
    {project.cloudProvider === 'AWS' && (
      <p className={cn('text-xs mt-2', statusColors.info.text)}>
        {t.awsRoleNote}
      </p>
    )}
  </div>
  );
};
