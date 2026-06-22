'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { SearchIcon } from '@/app/components/ui/icons';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  textColors,
} from '@/lib/theme';
import type {
  LogicalDatabase,
  LogicalDbModalDraft,
  LogicalDbModalProps,
} from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

const EMPTY_DRAFT: LogicalDbModalDraft = {
  excludedIds: new Set<string>(),
  reasons: {},
};

export const LogicalDbModal = ({
  open,
  resourceName,
  databases,
  initialDraft = EMPTY_DRAFT,
  onSave,
  onClose,
}: LogicalDbModalProps) => {
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<string>>(
    initialDraft.excludedIds,
  );
  const [reasons, setReasons] = useState<Readonly<Record<string, string>>>(
    initialDraft.reasons,
  );
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');

  const { panelA, panelB } = useMemo(
    () => splitPanels(databases, excludedIds, { searchA, searchB }),
    [databases, excludedIds, searchA, searchB],
  );

  const { addedCount, removedCount } = useMemo(
    () => computeDiff(excludedIds, initialDraft.excludedIds),
    [excludedIds, initialDraft.excludedIds],
  );
  const pendingCount = addedCount + removedCount;

  const moveToB = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const moveToA = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setReasons((prev) => {
      if (!(id in prev)) return prev;
      const next: Record<string, string> = {};
      for (const key of Object.keys(prev)) {
        if (key !== id) next[key] = prev[key];
      }
      return next;
    });
  };

  const handleSave = () => {
    onSave({ excludedIds, reasons });
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="2xl"
      title={`논리 DB 확인 · ${resourceName}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className={cn('text-[12px]', textColors.tertiary)}>
            변경사항{' '}
            <strong className={cn(textColors.primary, 'tabular-nums')}>
              {pendingCount}
            </strong>
            건 · 추가{' '}
            <strong className={cn(primaryColors.text, 'tabular-nums')}>
              {addedCount}
            </strong>{' '}
            · 제거{' '}
            <strong className={cn(textColors.secondary, 'tabular-nums')}>
              {removedCount}
            </strong>
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              disabled={pendingCount === 0}
              onClick={handleSave}
            >
              저장
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Panel
          label="연동 대상 후보"
          count={panelA.length}
          searchValue={searchA}
          onSearchChange={setSearchA}
          items={panelA}
          onItemClick={moveToB}
          actionLabel="제외"
          emptyMessage="조건에 맞는 결과가 없어요."
        />
        <Panel
          label="연동 제외 후보"
          count={panelB.length}
          searchValue={searchB}
          onSearchChange={setSearchB}
          items={panelB}
          onItemClick={moveToA}
          actionLabel="복원"
          emptyMessage="제외된 DB가 없어요."
        />
      </div>
    </Modal>
  );
};

interface PanelProps {
  label: string;
  count: number;
  searchValue: string;
  onSearchChange: (next: string) => void;
  items: ReadonlyArray<LogicalDatabase>;
  onItemClick: (id: string) => void;
  actionLabel: string;
  emptyMessage: string;
}

const Panel = ({
  label,
  count,
  searchValue,
  onSearchChange,
  items,
  onItemClick,
  actionLabel,
  emptyMessage,
}: PanelProps) => (
  <div
    className={cn(
      'flex flex-col rounded-lg border min-h-[280px] max-h-[400px] overflow-hidden',
      bgColors.surface,
      borderColors.default,
    )}
  >
    <header
      className={cn(
        'flex items-center justify-between border-b px-3 py-2',
        borderColors.light,
      )}
    >
      <span className={cn('text-[13px] font-semibold', textColors.primary)}>
        {label}
      </span>
      <span className={cn('text-[11.5px] tabular-nums', textColors.tertiary)}>
        {count}개
      </span>
    </header>
    <div className={cn('border-b px-2 py-1.5', borderColors.light)}>
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2',
          bgColors.surface,
          borderColors.default,
        )}
      >
        <SearchIcon className={cn('h-3 w-3', textColors.quaternary)} />
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Database / Schema 검색"
          className="h-7 w-full bg-transparent text-[12px] outline-none"
          aria-label={`${label} 검색`}
        />
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr
            className={cn(
              'sticky top-0 border-b',
              bgColors.muted,
              borderColors.light,
            )}
          >
            <th
              scope="col"
              className={cn(
                'w-[88px] px-3 py-1.5 text-[11px] font-medium',
                textColors.tertiary,
              )}
            >
              Type
            </th>
            <th
              scope="col"
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium',
                textColors.tertiary,
              )}
            >
              Database
            </th>
            <th
              scope="col"
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium',
                textColors.tertiary,
              )}
            >
              Schema
            </th>
            <th
              scope="col"
              className={cn(
                'w-[64px] px-3 py-1.5 text-right text-[11px] font-medium',
                textColors.tertiary,
              )}
            >
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className={cn(
                  'px-3 py-6 text-center text-[12px]',
                  textColors.quaternary,
                )}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            items.map((it) => (
              <tr
                key={it.id}
                className={cn('border-b text-[12.5px]', borderColors.light, bgColors.mutedHover)}
              >
                <td className="px-3 py-2">
                  <TypePill type={it.type} />
                </td>
                <td className={cn('px-3 py-2 font-mono', textColors.secondary)}>
                  {it.database}
                </td>
                <td className={cn('px-3 py-2 font-mono', textColors.tertiary)}>
                  {it.schema ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onItemClick(it.id)}
                    className={cn('text-[11.5px] hover:underline', primaryColors.text)}
                  >
                    {actionLabel}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const TypePill = ({ type }: { type: LogicalDatabase['type'] }) => (
  <span
    className={cn(
      'inline-block rounded px-1.5 py-0.5 text-[10.5px] font-semibold',
      type === 'db'
        ? 'bg-[#DBEAFE] text-[#1E40AF]'
        : 'bg-[#EDE9FE] text-[#5B21B6]',
    )}
  >
    {type === 'db' ? 'Database' : 'Schema'}
  </span>
);

const splitPanels = (
  databases: ReadonlyArray<LogicalDatabase>,
  excluded: ReadonlySet<string>,
  search: { searchA: string; searchB: string },
) => {
  const a = databases.filter((d) => !excluded.has(d.id));
  const b = databases.filter((d) => excluded.has(d.id));
  return {
    panelA: filterByName(a, search.searchA),
    panelB: filterByName(b, search.searchB),
  };
};

const filterByName = <T extends { name: string }>(
  items: ReadonlyArray<T>,
  q: string,
): T[] => {
  if (!q) return [...items];
  const needle = q.toLowerCase();
  return items.filter((it) => it.name.toLowerCase().includes(needle));
};

const computeDiff = (
  current: ReadonlySet<string>,
  initial: ReadonlySet<string>,
): { addedCount: number; removedCount: number } => {
  let addedCount = 0;
  let removedCount = 0;
  const union = new Set<string>([...current, ...initial]);
  union.forEach((id) => {
    const inCurrent = current.has(id);
    const inInitial = initial.has(id);
    if (inCurrent && !inInitial) addedCount += 1;
    if (!inCurrent && inInitial) removedCount += 1;
  });
  return { addedCount, removedCount };
};
