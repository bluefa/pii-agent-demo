'use client';

import { cardStyles, cn, primaryColors } from '@/lib/theme';
import { ProcessStatus } from '@/lib/types';
import type { AwsInstallationMode, CloudProvider } from '@/lib/types';
import { getProcessGuide } from '@/lib/constants/process-guides';
import type { GuideInline, StepGuideContent } from '@/lib/types/process-guide';

interface GuideCardProps {
  currentStep: ProcessStatus;
  provider: CloudProvider;
  installationMode?: AwsInstallationMode;
}

const resolveVariant = (provider: CloudProvider, installationMode?: AwsInstallationMode): string | undefined => {
  if (provider !== 'AWS') return undefined;
  return installationMode === 'MANUAL' ? 'manual' : 'auto';
};

const renderInline = (parts: GuideInline[]): React.ReactNode =>
  parts.map((part, idx) => {
    if (typeof part === 'string') return <span key={idx}>{part}</span>;
    if ('strong' in part) {
      return (
        <strong key={idx} className="font-semibold text-gray-900">
          {part.strong}
        </strong>
      );
    }
    return (
      <a key={idx} href={part.href} className={cn('font-medium hover:underline', primaryColors.text)}>
        {part.link}
      </a>
    );
  });

const LightbulbIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

export const GuideCard = ({ currentStep, provider, installationMode }: GuideCardProps) => {
  const guide = getProcessGuide(provider, resolveVariant(provider, installationMode));
  const step = guide?.steps.find((s) => s.stepNumber === currentStep);
  const content: StepGuideContent | undefined = step?.guide;

  if (!content) return null;

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
            <LightbulbIcon />
          </span>
          가이드
        </h2>
      </div>

      <div className="px-6 py-5 text-[13px] text-gray-600 leading-[1.72]">
        <h4 className="text-sm font-bold text-gray-900 mb-1.5">{content.heading}</h4>
        <p className="mb-2">{renderInline(content.summary)}</p>
        {content.bullets.length > 0 && (
          <ul className={cn('list-disc pl-5 space-y-0.5', primaryColors.marker)}>
            {content.bullets.map((bullet, idx) => (
              <li key={idx} className="text-gray-600">
                {renderInline(bullet)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GuideCard;
