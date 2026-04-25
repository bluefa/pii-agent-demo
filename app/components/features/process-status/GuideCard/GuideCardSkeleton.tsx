import { GuideCardChrome } from '@/app/components/features/process-status/GuideCard/GuideCardChrome';
import { cardStyles, cn } from '@/lib/theme';

export const GuideCardSkeleton = () => (
  <GuideCardChrome busy>
    <div className={cn('h-10', cardStyles.warmVariant.skeletonHeader)} />
    <div className="px-6 py-5 space-y-3">
      <div className={cn('h-4 w-3/4 rounded', cardStyles.warmVariant.skeletonBar)} />
      <div className={cn('h-4 w-5/6 rounded', cardStyles.warmVariant.skeletonBar)} />
      <div className={cn('h-4 w-2/3 rounded', cardStyles.warmVariant.skeletonBar)} />
    </div>
  </GuideCardChrome>
);
