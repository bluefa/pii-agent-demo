'use client';

/**
 * InstallationLifecycleTag — which install cycle a target source is in, with the
 * meaning of that value one hover away. Renders nothing when the response did not
 * carry a known value: the field is not in install-v1.yaml yet, so an older BFF
 * simply shows the screen as it was.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { INSTALLATION_LIFECYCLE_STATUSES, type InstallationLifecycleStatus } from '@/lib/types';

export const INSTALLATION_LIFECYCLE_COPY: Record<
  InstallationLifecycleStatus,
  { label: string; lines: string[] }
> = {
  INITIAL_INSTALLATION: {
    label: '최초 설치',
    lines: [
      '연동을 마친 적이 없는 대상입니다.',
      '같은 서비스의 다른 대상과는 무관합니다.',
    ],
  },
  REINSTALLATION: {
    label: '재설치',
    lines: [
      '연동을 마친 뒤 다시 설치하고 있습니다.',
      '연동 초기화 뒤 1단계부터 다시 진행합니다.',
    ],
  },
  INTEGRATION_COMPLETED: {
    label: '설치 완료',
    lines: ['7단계까지 마쳤습니다.', '관리자 승인이 끝난 상태입니다.'],
  },
};

export interface InstallationLifecycleTagProps {
  status: InstallationLifecycleStatus | null | undefined;
  /**
   * No tooltip, no focus stop — for table rows that are themselves one control (a
   * row-link overlay, or a `role="button"` row). The column header carries
   * `InstallationLifecycleLegend` instead.
   */
  plain?: boolean;
  className?: string;
}

/**
 * The value's name inside a tooltip. The tooltip body is 11.5px; the name stands two
 * sizes up — 13.5 rounded to the even 14 the design rule asks for.
 */
const TIP_LABEL = 'text-[14px] font-semibold';

/** All three values with their first line — tooltip content for a column header. */
export function InstallationLifecycleLegend(): ReactElement {
  return (
    <>
      {INSTALLATION_LIFECYCLE_STATUSES.map((status) => (
        <span key={status} className="block">
          <span className={TIP_LABEL}>{INSTALLATION_LIFECYCLE_COPY[status].label}</span>{' '}
          {INSTALLATION_LIFECYCLE_COPY[status].lines[0]}
        </span>
      ))}
    </>
  );
}

export function InstallationLifecycleTag({
  status,
  plain = false,
  className,
}: InstallationLifecycleTagProps): ReactElement | null {
  if (!status) return null;
  const copy = INSTALLATION_LIFECYCLE_COPY[status];
  const t = opsStyles.lifecycleTag;
  if (plain) return <span className={cn(t.base, t.tone[status], className)}>{copy.label}</span>;
  return (
    <Tooltip
      triggerClassName="flex-none"
      content={
        <>
          <span className={cn('block', TIP_LABEL)}>{copy.label}</span>
          {copy.lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </>
      }
    >
      {/* Focusable so the tooltip opens from the keyboard too. */}
      <span tabIndex={0} className={cn(t.base, t.tone[status], className)}>
        {copy.label}
      </span>
    </Tooltip>
  );
}
