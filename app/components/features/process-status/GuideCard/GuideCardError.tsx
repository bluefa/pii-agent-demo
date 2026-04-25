import { GuideCardChrome } from '@/app/components/features/process-status/GuideCard/GuideCardChrome';
import { Button } from '@/app/components/ui/Button';
import { cardStyles, cn } from '@/lib/theme';

interface Props {
  onRetry?: () => void;
}

export const GuideCardError = ({ onRetry }: Props) => (
  <GuideCardChrome>
    <div className={cn('px-6 py-5 space-y-3', cardStyles.warmVariant.body)}>
      <p className="text-[13px] font-medium">가이드를 불러오지 못했습니다.</p>
      <p className="text-[12px] opacity-70">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry} className="text-[12px] py-1.5 px-3">
          다시 시도
        </Button>
      )}
    </div>
  </GuideCardChrome>
);
