'use client';

import { SduIcon } from '@/app/components/ui/CloudProviderIcon';
import { cn, textColors } from '@/lib/theme';

/**
 * What an SDU target source shows instead of a progress screen.
 *
 * SDU is not a cloud account we install into — the service owner uploads the data
 * themselves — so none of the seven steps, none of the resource tables and none of
 * the install status apply to it. Rendering the provider page and letting each of
 * those parts discover it has nothing to say would mean loading a screen only to
 * fill it with blanks. This is the whole screen instead: nothing is fetched.
 *
 * Hierarchy is carried by weight and colour, not by shrinking anything below the
 * 24px floor — the point of the screen is that it reads from across the room.
 * The order is what the reader needs in order: which type this is, that it is not
 * available, and that it is coming.
 */
export const SduUnsupportedNotice = () => (
  <div className="flex h-full items-center justify-center px-6 py-16">
    <div className="flex max-w-[560px] flex-col items-center text-center">
      <SduIcon className={cn('h-16 w-16', textColors.quaternary)} aria-hidden="true" />

      <p className={cn('mt-8 text-[24px] font-medium tracking-[-0.01em]', textColors.tertiary)}>
        SDU · Self Data Upload
      </p>

      <h1 className={cn('mt-4 text-[32px] font-bold tracking-[-0.02em]', textColors.primary)}>
        아직 지원하지 않는 서비스 타입입니다
      </h1>

      <p className={cn('mt-6 text-[24px] leading-[1.5]', textColors.secondary)}>
        서비스가 준비되는 대로 지원할 예정입니다.
      </p>
    </div>
  </div>
);
