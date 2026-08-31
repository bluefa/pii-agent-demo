import { GuideCardChrome } from '@/app/components/features/process-status/GuideCard/GuideCardChrome';
import { GUIDE_CARD_COPY } from '@/app/components/features/process-status/GuideCard/copy';
import { useLocale } from '@/app/components/LocaleProvider';
import { Button } from '@/app/components/ui/Button';
import { cardStyles, cn } from '@/lib/theme';

interface Props {
  onRetry?: () => void;
}

export const GuideCardError = ({ onRetry }: Props) => {
  const { locale } = useLocale();
  const t = GUIDE_CARD_COPY[locale];
  return (
    <GuideCardChrome>
      <div className={cn('px-6 py-5 space-y-3', cardStyles.warmVariant.body)}>
        <p className="text-[13px] font-medium">{t.errorTitle}</p>
        <p className="text-[12px] opacity-70">{t.errorDetail}</p>
        {onRetry && (
          <Button variant="primary" onClick={onRetry} className="text-[12px] py-1.5 px-3">
            {t.retry}
          </Button>
        )}
      </div>
    </GuideCardChrome>
  );
};
