'use client';

import { useEffect } from 'react';
import { CloseIcon } from '@/app/components/ui/icons';
import { RdsMemberChip, RdsSelectionChip } from '@/app/components/ui/RdsInstanceChips';
import { rdsInstanceLabel, type RdsInstanceCandidate } from '@/lib/rds-instances';
import {
  bgColors,
  borderColors,
  cn,
  interactiveColors,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';

/**
 * RDS cluster member instances — the split panel the table opens over itself.
 *
 * The instances are NOT rows. Three of the table's seven columns say nothing about an
 * instance (Resource ID, 설치 구분, 제외 사유 belong to the cluster), and the two things the
 * user actually compares — the endpoint and the AZ — have no column at all, so as rows they
 * were a wide band of blanks that pushed the resources still needing a decision off screen.
 * A panel is the surface Cloudscape names for exactly this ("sub-resources or additional
 * attributes which can't be displayed in the table"), and it OVERLAYS rather than pushes, so
 * the table keeps its full width and the Resource Name column does not narrow.
 *
 * Closed on load, opened by pressing the cluster's instance line — the same "default closed,
 * opens on selection" rule. Esc closes; the ✕ closes; opening another cluster replaces it.
 */

interface RdsInstancePanelProps {
  /** The cluster the panel belongs to — named in the header so a switch is legible. */
  clusterName: string;
  /** Display order (Reader-first) — the caller sorts, the wire order is what the payload echoes. */
  instances: readonly RdsInstanceCandidate[];
  /** The cluster's effective selection; undefined while the cluster is left out of the request. */
  chosenResourceId: string | undefined;
  /** Radios exist only inside a checked cluster in the editable table (absent, not disabled). */
  selectable: boolean;
  readonly: boolean;
  /** The cluster's engine — the one thing an instance card cannot say for itself. */
  engineLabel: string | null;
  onSelect: (instanceResourceId: string) => void;
  onClose: () => void;
}

export const RdsInstancePanel = ({
  clusterName,
  instances,
  chosenResourceId,
  selectable,
  readonly,
  engineLabel,
  onSelect,
  onClose,
}: RdsInstancePanelProps) => {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    // A full-height rail pinned to the table's right edge, holding a STICKY card. Docking the
    // card itself to `inset-y-0` put it at the top of a table taller than the viewport, so a
    // cluster picked from the last row opened a panel scrolled off the top of the screen. The
    // rail spans the table (that is the range over which the panel is relevant) and the card
    // rides the viewport inside it. `pointer-events-none` on the rail so the rows it passes
    // over stay clickable — only the card itself takes the pointer.
    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[400px]">
      <aside
        className={cn(
          'pointer-events-auto sticky top-4 flex max-h-[440px] flex-col rounded-l-[12px] border',
          borderColors.strong,
          bgColors.surface,
          'shadow-[-12px_0_24px_-18px_rgba(0,0,0,0.55)]',
        )}
        aria-label={`${clusterName} 접속 인스턴스`}
      >
      <div className={cn('flex items-start gap-2 border-b px-4 py-3', borderColors.default)}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('text-[14px] font-semibold', textColors.primary)}>
            {`연결할 인스턴스 · ${instances.length}건`}
          </span>
          <span className={cn('truncate font-mono text-[12px]', textColors.tertiary)}>
            {clusterName}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="인스턴스 패널 닫기"
          className={cn('ml-auto shrink-0 rounded-md p-1', interactiveColors.closeButton, primaryColors.focusRing)}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto p-4">
        {instances.map((instance) => {
          const identifier = rdsInstanceLabel(instance);
          const chosen = instance.resource_id === chosenResourceId;
          const endpoint = typeof instance.host === 'string' && instance.host
            ? `${instance.host}${instance.port ? `:${instance.port}` : ''}`
            : null;

          const body = (
            <>
              {/* 역할은 이름 바로 옆 — 어느 인스턴스에 붙은 역할인지가 이 화면에서 가장
                  중요한 사실이라 이름과 떨어뜨리지 않는다(오너 지시). 카드는 폭이 고정이라
                  표에서와 달리 칩이 이름 길이를 따라 흔들려도 비교가 흐트러지지 않는다. */}
              <span className="flex min-w-0 items-center gap-2">
                {selectable && (
                  <input
                    type="radio"
                    name="rds-instance-panel"
                    value={instance.resource_id}
                    checked={chosen}
                    onChange={() => onSelect(instance.resource_id)}
                    aria-label={`접속 인스턴스 ${identifier} 선택`}
                    className={cn('h-4 w-4 shrink-0', statusColors.pending.border, primaryColors.text, primaryColors.focusRing)}
                  />
                )}
                <span className={cn('min-w-0 truncate font-mono text-[14px]', textColors.primary)}>
                  {identifier}
                </span>
                <RdsMemberChip role={instance.cluster_member_role} />
                {readonly && chosen && <RdsSelectionChip />}
              </span>
              <span className={cn('flex items-center gap-2 text-[12px]', textColors.secondary)}>
                <span className="font-mono">{instance.availability_zone ?? '—'}</span>
                {engineLabel && <span>{engineLabel}</span>}
              </span>
              {endpoint && (
                <span className={cn('truncate font-mono text-[12px]', textColors.tertiary)}>
                  {endpoint}
                </span>
              )}
            </>
          );

          const cardClass = cn(
            'flex flex-col gap-1.5 rounded-[10px] border px-3.5 py-3 text-left',
            chosen
              ? cn(primaryColors.border, primaryColors.bgLight)
              : cn(borderColors.default, bgColors.mutedHover),
          );

          // No radio → nothing to label, so the card is a plain block rather than a
          // `<label>` that points at an input that does not exist.
          return selectable ? (
            <label key={instance.resource_id} className={cn(cardClass, 'cursor-pointer')}>
              {body}
            </label>
          ) : (
            <div key={instance.resource_id} className={cardClass}>
              {body}
            </div>
          );
        })}
      </div>
      </aside>
    </div>
  );
};
