/**
 * ResIdCell — non-IDC (AWS) Resource ID cell (design-spec §3 `.res-id-cell`):
 * a 300px mono ellipsis + a 22px copy button. Copy writes to the clipboard and
 * raises the pipeline toast. IDC rows never render this (resource_id is internal).
 */
'use client';

import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';

export interface ResIdCellProps {
  value: string;
  /** Resting tone + row-hover lift, when the caller's row owns those states (P3). */
  textClassName?: string;
}

export function ResIdCell({ value, textClassName }: ResIdCellProps): ReactElement {
  const toast = usePlToast();
  const { resId } = tqStyles.appTable;
  const copy = (): void => {
    void navigator.clipboard?.writeText(value);
    toast.show('복사했어요');
  };
  return (
    <span className={resId.cell}>
      <span className={cn(textClassName ? resId.textBare : resId.text, textClassName)} title={value}>
        {value}
      </span>
      <button type="button" className={resId.copy} onClick={copy} title="복사" aria-label="Resource ID 복사">
        <Icon name="copy" size="sm" />
      </button>
    </span>
  );
}
