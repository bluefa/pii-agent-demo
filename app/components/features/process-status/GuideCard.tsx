import { cardStyles, cn, primaryColors } from '@/lib/theme';
import { ProcessStatus } from '@/lib/types';
import type { AwsInstallationMode, CloudProvider } from '@/lib/types';
import { getProcessGuide } from '@/lib/constants/process-guides';
import type { GuideInline, StepGuideContent } from '@/lib/types/process-guide';
import { GuideIcon } from '@/app/components/ui/icons';

interface GuideCardProps {
  currentStep: ProcessStatus;
  provider: CloudProvider;
  installationMode?: AwsInstallationMode;
}

const resolveVariant = (provider: CloudProvider, installationMode?: AwsInstallationMode): string | undefined => {
  if (provider !== 'AWS') return undefined;
  return installationMode === 'MANUAL' ? 'manual' : 'auto';
};

const getInlineKey = (part: GuideInline): string => {
  if (typeof part === 'string') return `s:${part}`;
  if ('strong' in part) return `b:${part.strong}`;
  return `l:${part.href}`;
};

const renderInline = (parts: GuideInline[]): React.ReactNode =>
  parts.map((part) => {
    const key = getInlineKey(part);
    if (typeof part === 'string') return <span key={key}>{part}</span>;
    if ('strong' in part) {
      return (
        <strong key={key} className="font-semibold text-gray-900">
          {part.strong}
        </strong>
      );
    }
    return (
      <a key={key} href={part.href} className={cn('font-medium hover:underline', primaryColors.text)}>
        {part.link}
      </a>
    );
  });

export const GuideCard = ({ currentStep, provider, installationMode }: GuideCardProps) => {
  const guide = getProcessGuide(provider, resolveVariant(provider, installationMode));
  const step = guide?.steps.find((s) => s.stepNumber === currentStep);
  const content: StepGuideContent | undefined = step?.guide;

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm overflow-hidden',
        cardStyles.warmVariant.container,
      )}
    >
      <div className={cn('px-6 py-4', cardStyles.warmVariant.header)}>
        <h2
          className={cn(
            'inline-flex items-center gap-2.5 text-sm font-semibold',
            cardStyles.warmVariant.titleText,
          )}
        >
          <span
            className={cn(
              'w-[26px] h-[26px] rounded-full inline-grid place-items-center shrink-0 shadow-sm',
              cardStyles.warmVariant.icon,
            )}
          >
            <GuideIcon className="w-3.5 h-3.5" />
          </span>
          가이드
        </h2>
      </div>

      <div className="px-6 py-5 text-[13px] text-gray-600 leading-[1.72]">
        {content ? (
          <>
            <h4 className="text-sm font-bold text-gray-900 mb-1.5">{content.heading}</h4>
            <p className="mb-2">{renderInline(content.summary)}</p>
            {content.bullets.length > 0 && (
              <ul className={cn('list-disc pl-5 space-y-0.5', primaryColors.marker)}>
                {content.bullets.map((bullet) => (
                  <li key={bullet.map(getInlineKey).join('|')} className="text-gray-600">
                    {renderInline(bullet)}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-gray-500">가이드를 준비 중입니다.</p>
        )}
      </div>
    </div>
  );
};

export default GuideCard;
