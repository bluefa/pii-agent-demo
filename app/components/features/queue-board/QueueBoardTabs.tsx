'use client';

import { cn, primaryColors, textColors, statusColors } from '@/lib/theme';

type TabKey = 'pending' | 'processing' | 'completed';

interface QueueBoardTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  pendingCount: number;
  processingCount: number;
}

const TABS: { key: TabKey; label: string; countKey?: 'pendingCount' | 'processingCount' }[] = [
  { key: 'pending', label: '미처리', countKey: 'pendingCount' },
  { key: 'processing', label: '처리중', countKey: 'processingCount' },
  { key: 'completed', label: '완료 내역' },
];

export const QueueBoardTabs = ({
  activeTab,
  onTabChange,
  pendingCount,
  processingCount,
}: QueueBoardTabsProps) => {
  const counts: Record<string, number> = { pendingCount, processingCount };

  return (
    <div className={cn('flex gap-1 p-1 rounded-lg', statusColors.pending.bg)}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = tab.countKey ? counts[tab.countKey] : undefined;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150',
              isActive
                ? `${primaryColors.bg} text-white shadow-sm`
                : `bg-transparent ${textColors.tertiary} hover:text-gray-700`,
            )}
          >
            {tab.label}
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  'min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-semibold px-1.5',
                  isActive
                    ? 'bg-white/20 text-white'
                    : `${statusColors.pending.bg} ${statusColors.pending.textDark}`,
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
