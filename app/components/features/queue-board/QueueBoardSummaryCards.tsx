'use client';

import { cn, statusColors, primaryColors, textColors } from '@/lib/theme';

interface QueueBoardSummaryCardsProps {
  pendingCount: number;
  processingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

const ClockIcon = () => (
  <svg
    className="w-11 h-11"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="10" />
    <path strokeLinecap="round" d="M12 6v6l4 2" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    className="w-11 h-11"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      d="M12 2a10 10 0 0 1 10 10"
    />
    <path
      strokeLinecap="round"
      d="M12 6a6 6 0 0 1 6 6"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="w-11 h-11"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="10" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l3 3 5-5" />
  </svg>
);

const XIcon = () => (
  <svg
    className="w-11 h-11"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="10" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6m0-6l6 6" />
  </svg>
);

interface StatCardConfig {
  label: string;
  icon: React.ReactNode;
  bgClass: string;
  iconColorClass: string;
  valueColorClass: string;
  borderClass: string;
}

const cardConfigs: StatCardConfig[] = [
  {
    label: '미처리',
    icon: <ClockIcon />,
    bgClass: primaryColors.bgLight,
    iconColorClass: primaryColors.text,
    valueColorClass: primaryColors.text,
    borderClass: 'border-[#0064FF]/15',
  },
  {
    label: '처리중',
    icon: <SpinnerIcon />,
    bgClass: statusColors.warning.bg,
    iconColorClass: statusColors.warning.text,
    valueColorClass: statusColors.warning.textDark,
    borderClass: statusColors.warning.border,
  },
  {
    label: '완료',
    icon: <CheckIcon />,
    bgClass: statusColors.success.bg,
    iconColorClass: statusColors.success.text,
    valueColorClass: statusColors.success.textDark,
    borderClass: statusColors.success.border,
  },
  {
    label: '반려',
    icon: <XIcon />,
    bgClass: statusColors.error.bg,
    iconColorClass: statusColors.error.text,
    valueColorClass: statusColors.error.textDark,
    borderClass: statusColors.error.border,
  },
];

export const QueueBoardSummaryCards = ({
  pendingCount,
  processingCount,
  approvedCount,
  rejectedCount,
}: QueueBoardSummaryCardsProps) => {
  const counts = [pendingCount, processingCount, approvedCount, rejectedCount];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cardConfigs.map((config, i) => (
        <div
          key={config.label}
          className={cn(
            'relative overflow-hidden rounded-xl border p-5',
            'transition-shadow duration-200 hover:shadow-md',
            config.bgClass,
            config.borderClass,
          )}
        >
          {/* Background decorative icon */}
          <div
            className={cn(
              'absolute -right-2 -top-2 opacity-[0.08]',
              config.iconColorClass,
            )}
          >
            <svg className="w-24 h-24" viewBox="0 0 24 24" fill="currentColor">
              {i === 0 && (
                <>
                  <circle cx="12" cy="12" r="10" />
                </>
              )}
              {i === 1 && <circle cx="12" cy="12" r="10" />}
              {i === 2 && <circle cx="12" cy="12" r="10" />}
              {i === 3 && <circle cx="12" cy="12" r="10" />}
            </svg>
          </div>

          <div className="relative flex items-center gap-4">
            {/* Icon */}
            <div
              className={cn(
                'flex items-center justify-center w-12 h-12 rounded-lg opacity-80',
                config.iconColorClass,
              )}
            >
              {config.icon}
            </div>

            {/* Text */}
            <div className="flex flex-col">
              <span className={cn('text-3xl font-bold leading-none', config.valueColorClass)}>
                {counts[i].toLocaleString()}
              </span>
              <span className={cn('text-sm mt-1', textColors.tertiary)}>
                {config.label}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
