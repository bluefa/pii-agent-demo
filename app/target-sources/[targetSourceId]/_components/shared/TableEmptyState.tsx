import { SearchIcon } from '@/app/components/ui/icons';
import { bgColors, cn, textColors } from '@/lib/theme';

/**
 * Structured table empty state — icon-in-circle + caption, shared by the step
 * resource tables so a 0-result filter never reads as the table vanishing.
 */
export const TableEmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-14">
    <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', bgColors.muted)}>
      <SearchIcon className={cn('h-6 w-6', textColors.quaternary)} aria-hidden="true" />
    </div>
    <p className={cn('text-sm', textColors.tertiary)}>{message}</p>
  </div>
);
