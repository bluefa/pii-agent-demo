import { GuideCardChrome } from '@/app/components/features/process-status/GuideCard/GuideCardChrome';
import { GUIDE_CARD_COPY } from '@/app/components/features/process-status/GuideCard/copy';
import { useLocale } from '@/app/components/LocaleProvider';
import { cardStyles, cn } from '@/lib/theme';

import type { ValidationError } from '@/lib/utils/validate-guide-html';

interface Props {
  errors: ValidationError[];
  variant?: 'admin' | 'enduser';
}

const formatError = (error: ValidationError): string =>
  `${error.code}: ${error.message}${error.path ? ` (${error.path})` : ''}`;

export const GuideCardInvalidState = ({ errors, variant = 'enduser' }: Props) => {
  const { locale } = useLocale();
  const t = GUIDE_CARD_COPY[locale];
  return (
    <GuideCardChrome>
      {variant === 'enduser' ? (
        <div className={cn('px-6 py-5 text-[13px] opacity-70', cardStyles.warmVariant.body)}>
          {t.invalidEnduser}
        </div>
      ) : (
        <div className={cn('px-6 py-5 space-y-2', cardStyles.warmVariant.body)}>
          <p className="text-[13px] font-medium">{t.invalidAdmin}</p>
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-words opacity-80">
            {errors.map(formatError).join('\n')}
          </pre>
        </div>
      )}
    </GuideCardChrome>
  );
};
