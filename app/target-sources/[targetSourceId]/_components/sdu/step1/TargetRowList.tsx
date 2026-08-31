'use client';

import type { ReactNode } from 'react';
import { DatabaseIcon, PlusIcon } from '@/app/components/ui/icons';
import { EmptyState } from '@/app/components/ui/state';
import { useLocale } from '@/app/components/LocaleProvider';
import { cn, idcStyles } from '@/lib/theme';
import { SDU_REGION_LABEL, type SduTarget } from '@/lib/types/sdu';
import { SDU_COPY } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import {
  activeSduDrafts,
  sduCloudLabels,
  sduDbTypeSummary,
  sduDraftDbTypeCount,
  sduDraftRegions,
  sduRowDiff,
  sduRowDiffLabels,
  type SduTargetDraft,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/model';
import {
  listStyles,
  rowDiffPill,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/step1/styles';

export interface TargetRowListProps {
  rows: readonly SduTargetDraft[];
  /**
   * 불러온 정의의 대상들. 'return' 모드에서만 쓴다 — 행이 무엇으로 변했는지의 기준이다.
   * 빈 배열이면 모든 행이 '추가함' 이 되므로, 초기 모드에서는 diff 자체를 그리지 않는다.
   */
  baseline: readonly SduTarget[];
  /** 'return' 이면 행이 변경 상태를 입고, 삭제는 표시로만 이뤄진다. */
  showDiff: boolean;
  /** 지금 펼쳐 고치고 있는 행의 key. 새 행이면 목록에 없는 key 다. */
  editingKey: string | null;
  /** 펼친 편집 행. `editingKey` 자리에 접힌 행 대신 들어간다. */
  editorSlot: ReactNode;
  onEdit: (key: string) => void;
  onDelete: (key: string) => void;
  onRestore: (key: string) => void;
  onAdd: () => void;
}

/**
 * 연동 대상 목록. 접힌 행이 한 줄에 네 값을 다 보여주는 이유 — 대상이 늘어나면 담당자가
 * 확인하는 것은 "이 IP 맞나 / 이 Region 맞나"이지 각 행을 다시 여는 일이 아니다.
 *
 * 머리줄이 Region 곳수를 항상 세어 보여주는 것도 같은 이유다: Region 이 이후 업로드 경로를
 * 가르는 축이므로, 대상 건수보다 그 수가 먼저 읽혀야 한다.
 */
export const TargetRowList = ({
  rows,
  baseline,
  showDiff,
  editingKey,
  editorSlot,
  onEdit,
  onDelete,
  onRestore,
  onAdd,
}: TargetRowListProps) => {
  const { locale } = useLocale();
  const t = SDU_COPY[locale].define;
  const cloudLabel = sduCloudLabels(t);
  const diffLabel = sduRowDiffLabels(t);
  const active = activeSduDrafts(rows);
  const regions = sduDraftRegions(rows);
  const editingNewRow = editingKey !== null && !rows.some((row) => row.key === editingKey);

  return (
    <section>
      <div className={listStyles.bar}>
        <h3 className={listStyles.barTitle}>{t.listTitle}</h3>
        <span className={listStyles.barCount}>{t.listCount(active.length)}</span>
        <span className={listStyles.barStat}>
          {t.listStat(regions.length, sduDraftDbTypeCount(rows))}
        </span>
      </div>

      {rows.length === 0 && !editingNewRow ? (
        <EmptyState
          variant="card"
          icon={<DatabaseIcon className="h-7 w-7" />}
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={
            <button type="button" onClick={onAdd} className={idcStyles.triggerBtn.primary}>
              {t.addTarget}
            </button>
          }
        />
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row, index) => {
            const number = String(index + 1).padStart(2, '0');
            if (row.key === editingKey) {
              return <li key={row.key}>{editorSlot}</li>;
            }
            const diff = sduRowDiff(baseline, row);
            return (
              <li
                key={row.key}
                className={cn(
                  listStyles.row,
                  row.removed ? listStyles.rowRemoved : listStyles.rowSurface,
                )}
              >
                <span className={listStyles.index}>{number}</span>
                <span className={listStyles.cloud}>{cloudLabel[row.cloud]}</span>
                <span className={listStyles.region}>{SDU_REGION_LABEL[row.region]}</span>
                <span className={listStyles.ip}>{row.uploadIp}</span>
                <span className={listStyles.types}>{sduDbTypeSummary(t, row.databaseTypes)}</span>
                <span className={listStyles.actions}>
                  {showDiff && (
                    <span className={rowDiffPill[diff]}>{diffLabel[diff]}</span>
                  )}
                  {row.removed ? (
                    <button
                      type="button"
                      onClick={() => onRestore(row.key)}
                      className={idcStyles.triggerBtn.ghostSm}
                    >
                      {t.restore}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={editingKey !== null}
                        onClick={() => onEdit(row.key)}
                        className={idcStyles.triggerBtn.ghostSm}
                      >
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        disabled={editingKey !== null}
                        onClick={() => onDelete(row.key)}
                        className={idcStyles.triggerBtn.linkNeutral}
                      >
                        {t.remove}
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
          {editingNewRow && <li key={editingKey}>{editorSlot}</li>}
        </ul>
      )}

      {/* 편집 중에는 추가 경로를 닫는다 — 고치던 행을 어디에도 남기지 않고 새 행이
          열리면, 방금 친 값이 사라진 것으로 읽힌다. */}
      {editingKey === null && rows.length > 0 && (
        <button type="button" onClick={onAdd} className={cn(listStyles.addButton, 'mt-2')}>
          <PlusIcon className="h-3.5 w-3.5" />
          {t.addTarget}
        </button>
      )}
    </section>
  );
};
