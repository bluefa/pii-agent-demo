'use client';

import type { ReactNode } from 'react';

import { bgColors, borderColors, cn, textColors } from '@/lib/theme';

interface GuidePlaceholderProps {
  /** Heading copy (single line). */
  children: ReactNode;
  /** Secondary line beneath the heading. */
  subtitle?: ReactNode;
  /** Lucide-style 24×24 stroked SVG. Defaults to a "document" icon. */
  icon?: ReactNode;
}

const DefaultIcon = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);

export const GuidePlaceholder = ({
  children,
  subtitle = '왼쪽 목록에서 단계를 선택하면 이곳에 편집/미리보기 영역이 표시됩니다.',
  icon = DefaultIcon,
}: GuidePlaceholderProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center h-full text-center gap-3 px-6 border-l',
      borderColors.default,
    )}
  >
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center w-14 h-14 rounded-2xl border',
        bgColors.muted,
        borderColors.light,
        textColors.quaternary,
      )}
    >
      {icon}
    </span>
    <div className="flex flex-col gap-1 max-w-[280px]">
      <p className={cn('text-[14px] font-semibold', textColors.primary)}>{children}</p>
      <p className={cn('text-[12.5px] leading-snug', textColors.tertiary)}>{subtitle}</p>
    </div>
  </div>
);
