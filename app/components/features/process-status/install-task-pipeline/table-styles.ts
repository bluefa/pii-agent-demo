import { cn, textStyles } from '@/lib/theme';

// 텍스트 램프(docs/redesign/typography-and-spacing.md) 적용:
// th = captionStrong(12/600), td = 테이블 컨테이너의 body(14/400) 상속,
// tag = captionStrong. v15 의 14/16 셀 패딩은 유지한다.
export const TABLE_HEADER_CELL = cn(
  'px-4 py-3.5 text-left text-[#4E5968]',
  textStyles.captionStrong,
);

// v15 `.db-list-table td` (05-tables.md §1e): 14/16 pad, text #191F28. Row
// divider (#EBEEF2) is applied by the consumer's row border.
export const TABLE_BODY_CELL = 'px-4 py-3.5 text-[#191F28]';

export const TABLE_MONO_CELL = cn(TABLE_BODY_CELL, 'font-mono', textStyles.caption);

// v15 `.tag` (05-tables.md §3 / idcStyles.tag): radius 8.
export const TABLE_TAG_PILL = cn(
  'inline-flex items-center px-2 py-0.5 rounded-lg',
  textStyles.captionStrong,
);
