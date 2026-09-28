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
import type { InstallationLifecycleStatus } from '@/lib/types';

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
      '연동을 마친 적이 있고 지금 다시 설치하고 있습니다.',
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
  className?: string;
}

export function InstallationLifecycleTag({
  status,
  className,
}: InstallationLifecycleTagProps): ReactElement | null {
  if (!status) return null;
  const copy = INSTALLATION_LIFECYCLE_COPY[status];
  const t = opsStyles.lifecycleTag;
  return (
    <Tooltip
      triggerClassName="flex-none"
      content={
        <>
          <span className="block font-semibold">{copy.label}</span>
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
