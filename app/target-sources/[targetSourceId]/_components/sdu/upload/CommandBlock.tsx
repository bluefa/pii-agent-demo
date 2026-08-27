'use client';

import { CopyButton } from '@/app/components/ui/CopyButton';
import {
  bgColors,
  borderColors,
  cardStyles,
  cn,
  statusColors,
  textColors,
  textStyles,
} from '@/lib/theme';
import { SDU_REGION_LABEL, type SduRegion } from '@/lib/types/sdu';

export interface CommandBlockProps {
  region: SduRegion;
  /** The three lines EXACTLY as they arrived. Never split, never parsed. */
  command: string;
  acked: boolean;
}

/**
 * One Region's upload-check command.
 *
 * The string is rendered verbatim. The screen must not pull `s3://` out of it, because the
 * moment it does the wire format becomes a screen contract — a proxy address changing or a
 * fourth line appearing would then break the page instead of just showing up.
 *
 * Copy is per Region for the same reason the block is: the proxy lines can differ by Region,
 * and one terminal runs one Region's three lines in order.
 *
 * 면은 가라앉은 중립면(gray-100)이다 — 이 앱의 사용자 화면에는 어두운 코드 표면 토큰이
 * 없고, 토큰을 새로 만드는 것은 이 슬라이스의 몫이 아니다.
 */
export const CommandBlock = ({ region, command, acked }: CommandBlockProps) => (
  <div className={cn('overflow-hidden rounded-xl border', borderColors.default)}>
    <div className={cn('flex items-center gap-2 border-b bg-white px-4 py-2.5', borderColors.light)}>
      <span className={cn(textStyles.bodyStrong, textColors.primary)}>
        {SDU_REGION_LABEL[region]}
      </span>
      <span
        className={cn(
          cardStyles.stepBadge,
          acked
            ? cn(statusColors.success.bg, statusColors.success.textDark)
            : cn(statusColors.pending.bg, statusColors.pending.textDark),
        )}
      >
        {acked ? '확인함' : '응답 대기'}
      </span>
      <span className="ml-auto">
        <CopyButton value={command} label={`${SDU_REGION_LABEL[region]} 업로드 확인 명령 복사`} />
      </span>
    </div>
    <pre
      className={cn(
        'overflow-x-auto px-4 py-3 font-mono text-[12px] leading-[1.8]',
        bgColors.panel,
        textColors.secondary,
      )}
    >
      {command}
    </pre>
  </div>
);
