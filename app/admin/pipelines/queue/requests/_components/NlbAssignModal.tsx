'use client';

/**
 * NlbAssignModal — one IDC 연동 대상's NLB index, picked in a modal instead of a
 * per-row select.
 *
 * The row used to carry the whole decision inline: a select whose option labels
 * spelled out occupancy, a detail button, and a 저장 that appeared mid-edit. Three
 * controls in one cell to answer a question the admin asks a handful of times per
 * request. Here the cell is one text button and the decision gets the room it needs —
 * the same 점유/상태 table the NLB 리스너 현황 modal shows, with the rows selectable.
 *
 * Picking and saving are one act: the modal commits on 저장 and closes, so there is no
 * such thing as an unsaved assignment to warn about later.
 *
 * Picker only. The 서비스별 배정 that the row's ⓘ used to open is a column on the
 * resource table instead — it is a standing fact about the resource, not something to
 * open a modal for.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { FtagBadge, OccBar } from '@/app/admin/pipelines/queue/_components/bits';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { NLB_CAPACITY, nlbOptionDisabled } from '@/app/admin/pipelines/queue/requests/_logic';
import type { NlbTableRow, RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface NlbAssignModalProps {
  open: boolean;
  onClose: () => void;
  resource: RequestResourceRow;
  rows: NlbTableRow[];
  saving: boolean;
  /** Commit the pick — the page PUTs it and refetches occupancy, then closes. */
  onSave: (nlbIndex: number) => void;
}

export function NlbAssignModal({
  open,
  onClose,
  resource,
  rows,
  saving,
  onSave,
}: NlbAssignModalProps): ReactElement {
  const { appTable, occ, tag } = tqStyles;
  // Fresh mount per resource (the page keys this modal), so the row's saved index
  // is the seed rather than a value carried over from whichever row opened last.
  const [chosen, setChosen] = useState<number | null>(resource.nlbIndex);
  const dirty = chosen != null && chosen !== resource.nlbIndex;
  // The list runs to 40. Bring the row the resource is already on into view once the rows
  // land, or an admin opening #37's modal starts at #1 and scrolls to find where they are.
  // Once only: a save refetches occupancy, and re-scrolling then would yank the list out
  // from under whoever is mid-pick.
  const currentRowRef = useRef<HTMLTableRowElement>(null);
  const anchored = useRef(false);
  useEffect(() => {
    if (!open || anchored.current || currentRowRef.current == null) return;
    anchored.current = true;
    // Optional call: jsdom does not implement scrollIntoView, and anchoring is an
    // affordance — a missing implementation must not take the modal down with it.
    currentRowRef.current.scrollIntoView?.({ block: 'center' });
  }, [open, rows.length]);
  const endpoints = resource.connectTargets
    .map((host) => (resource.port == null ? host : `${host}:${resource.port}`))
    .join(' · ');

  return (
    <TqModal
      open={open}
      onClose={onClose}
      wide
      title="NLB 배정"
      meta={
        <>
          <span className={cn(tag.base, tag.blue)}>
            {resource.databaseType ? getDatabaseShortLabel(resource.databaseType) : '—'}
          </span>
          <span className={appTable.tdMono}>{endpoints || '—'}</span>
        </>
      }
      sub="여유 있는 NLB로 배정하면 부하를 나눌 수 있어요. 50개에 이른 NLB에는 새로 배정할 수 없어요."
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </PlButton>
          <PlButton
            variant="primary"
            disabled={!dirty || saving}
            onClick={() => chosen != null && onSave(chosen)}
          >
            저장
          </PlButton>
        </>
      }
    >
      {/* The scroller is this inner div, not the modal shell. With 40 rows the shell's own
          max-h-[88vh] overflow-y-auto took over: the header, the target being assigned and
          the column names all scrolled away with the list, and the focus trap landing on a
          footer button opened the modal scrolled to the very bottom. Capping the list here
          leaves the shell shorter than its own limit, so nothing outside the list moves. */}
      <div className={appTable.wrap}>
        <div className="max-h-[44vh] overflow-y-auto">
        <table className={appTable.root}>
          {/* Sticky against the div above — 40 rows means most of the list is read with the
              header off the top of the box otherwise. */}
          <thead className={cn(appTable.thead, 'sticky top-0 z-10')}>
            <tr>
              <th className={`${appTable.th} w-[64px]`}>선택</th>
              <th className={`${appTable.th} w-[100px]`}>NLB Index</th>
              <th className={appTable.th}>NLB IP</th>
              <th className={`${appTable.th} w-[220px]`}>점유 리스너</th>
              <th className={`${appTable.th} w-[100px]`}>상태</th>
            </tr>
          </thead>
          <tbody className={appTable.body}>
            {rows.map((row) => {
              // A full NLB stays pickable only when it is already this resource's —
              // otherwise the current value would be unselectable in its own list.
              const blocked = nlbOptionDisabled(
                row.occupiedListenerCount,
                row.nlbIndex,
                resource.nlbIndex,
              );
              const selected = chosen === row.nlbIndex;
              return (
                <tr
                  key={row.nlbIndex}
                  ref={row.nlbIndex === resource.nlbIndex ? currentRowRef : undefined}
                  className={cn(
                    appTable.row,
                    blocked
                      ? 'opacity-50'
                      : 'cursor-pointer hover:bg-[var(--pl-gray-50)]',
                    selected && 'bg-[var(--pl-primary-bg)]',
                  )}
                  // The whole row is the target; the radio alone is a 16px hit area.
                  onClick={() => !blocked && setChosen(row.nlbIndex)}
                >
                  <td className={appTable.td}>
                    <input
                      type="radio"
                      name="nlb-index"
                      className="cursor-pointer accent-[var(--pl-primary)]"
                      checked={selected}
                      disabled={blocked || saving}
                      onChange={() => setChosen(row.nlbIndex)}
                      aria-label={`NLB #${row.nlbIndex} 배정`}
                    />
                  </td>
                  <td className={`${appTable.td} ${appTable.tdMono}`}>#{row.nlbIndex}</td>
                  <td className={`${appTable.td} ${appTable.tdMono}`}>
                    {row.nlbIpList.join(' · ')}
                  </td>
                  <td className={appTable.td}>
                    <span className="inline-flex items-center gap-2">
                      <OccBar occupied={row.occupiedListenerCount} />
                      <span className={occ.num}>
                        {row.occupiedListenerCount}
                        <span className={occ.den}>/{NLB_CAPACITY}</span>
                      </span>
                    </span>
                  </td>
                  <td className={appTable.td}>
                    <FtagBadge occupied={row.occupiedListenerCount} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

    </TqModal>
  );
}
