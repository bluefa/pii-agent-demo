/**
 * 논리 DB 확인 modal (design-spec §6, w840) — read-only view of the logical DBs
 * discovered for one resource, split into 연동 대상 / 연동 제외 tabs. Data is fetched
 * lazily by the page (per resource, cached across tab cycles) and passed in via
 * `entry`; this component owns only the tab + in-modal pagination. Tab switch
 * resets to page 1 (api-spec P5).
 */
'use client';

import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { SegControl } from '@/app/admin/pipelines/_components/SegControl';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import type { LdbCacheEntry, LdbTab } from '@/app/admin/pipelines/queue/test-connections/_tc/logic';

const PAGE_SIZE = 10;

export interface LdbModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  /** DB type tag (blue) for the meta row. */
  databaseType: string | null;
  /** 연동 대상 label (mono) for the meta row. */
  targetLabel: string;
  /** Tab to open on (from the clicked count link). */
  defaultTab: LdbTab;
  /** Loaded lists — `undefined` while the resource is still being fetched. */
  entry: LdbCacheEntry | undefined;
  /** Re-fetch the resource after a failed load. */
  onRetry: () => void;
}

export function LdbModal({
  open,
  onClose,
  targetSourceId,
  databaseType,
  targetLabel,
  defaultTab,
  entry,
  onRetry,
}: LdbModalProps): ReactElement {
  const { appTable, tag } = tqStyles;
  // Fresh mount per (resource, clicked tab) — the parent keys this modal — so the
  // opening tab + page seed from props without a reset effect.
  const [tab, setTab] = useState<LdbTab>(defaultTab);
  const [page, setPage] = useState(1);

  const changeTab = (next: LdbTab): void => {
    setTab(next);
    setPage(1);
  };

  const included = entry?.included ?? [];
  const excluded = entry?.excluded ?? [];
  const isInc = tab === 'inc';
  const loading = entry === undefined;
  const errored = entry?.error === true;

  const total = isInc ? included.length : excluded.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const incSlice = included.slice(from, from + PAGE_SIZE);
  const excSlice = excluded.slice(from, from + PAGE_SIZE);
  const colSpan = isInc ? 3 : 4;

  return (
    <TqModal
      open={open}
      onClose={onClose}
      wide
      eyebrowCtx="연결 테스트"
      eyebrowId={`#${targetSourceId}`}
      title="논리 DB 확인"
      meta={
        <>
          {databaseType && <span className={cn(tag.base, tag.blue)}>{databaseType}</span>}
          <span className={appTable.tdMono}>{targetLabel}</span>
        </>
      }
      sub="이 리소스에서 조회된 논리 DB 목록이에요. 제외 목록은 서비스 오너가 설정해요."
      footer={
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      }
    >
      <SegControl
        className="mb-4"
        ariaLabel="논리 DB 구분"
        value={tab}
        onChange={changeTab}
        options={[
          { label: `연동 대상 ${included.length}`, value: 'inc' },
          { label: `연동 제외 ${excluded.length}`, value: 'exc' },
        ]}
      />

      <div className={appTable.wrap}>
        <table className={appTable.root}>
          <thead className={appTable.thead}>
            <tr>
              <th className={cn(appTable.th, 'w-[100px]')}>구분</th>
              <th className={appTable.th}>Database</th>
              <th className={appTable.th}>Schema</th>
              {!isInc && <th className={cn(appTable.th, 'w-[100px]')}>제외 사유</th>}
            </tr>
          </thead>
          <tbody className={appTable.body}>
            {loading ? (
              <tr className={appTable.row}>
                <td className={appTable.td} colSpan={colSpan} aria-busy="true">
                  <span className="text-[var(--pl-text-faint)]">불러오는 중이에요…</span>
                </td>
              </tr>
            ) : errored ? (
              <tr className={appTable.row}>
                <td className={appTable.td} colSpan={colSpan}>
                  <span className="inline-flex items-center gap-3">
                    <span className="text-[var(--pl-text-weak)]">논리 DB 목록을 불러오지 못했어요</span>
                    <PlButton variant="secondary" size="sm" onClick={onRetry}>
                      재시도
                    </PlButton>
                  </span>
                </td>
              </tr>
            ) : total === 0 ? (
              <tr className={appTable.row}>
                <td className={appTable.td} colSpan={colSpan}>
                  <span className="text-[var(--pl-text-faint)]">
                    {isInc ? '연동 대상 논리 DB가 없어요' : '제외된 논리 DB가 없어요'}
                  </span>
                </td>
              </tr>
            ) : isInc ? (
              incSlice.map((item, i) => (
                <tr key={`${item.databaseName ?? ''}-${item.schemaName ?? ''}-${i}`} className={appTable.row}>
                  <td className={appTable.td}>
                    <span className={cn(tag.base, tag.gray)}>{item.type ?? '—'}</span>
                  </td>
                  <td className={cn(appTable.td, appTable.tdMono)}>{item.databaseName ?? '—'}</td>
                  <td className={appTable.td}>
                    {item.schemaName ? (
                      <span className={appTable.tdMono}>{item.schemaName}</span>
                    ) : (
                      <span className="text-[var(--pl-text-faint)]">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              excSlice.map((item, i) => (
                <tr key={`${item.databaseName}-${item.schemaName ?? ''}-${i}`} className={appTable.row}>
                  <td className={appTable.td}>
                    <span className={cn(tag.base, tag.gray)}>{item.type}</span>
                  </td>
                  <td className={cn(appTable.td, appTable.tdMono)}>{item.databaseName}</td>
                  <td className={appTable.td}>
                    {item.schemaName ? (
                      <span className={appTable.tdMono}>{item.schemaName}</span>
                    ) : (
                      <span className="text-[var(--pl-text-faint)]">—</span>
                    )}
                  </td>
                  <td className={appTable.td}>
                    <span className={cn(tag.base, tag.gray)}>{item.skipReason}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && total > PAGE_SIZE && (
        <PlPagination
          className="mt-4"
          page={page}
          pages={pages}
          onPrev={() => setPage((n) => Math.max(1, n - 1))}
          onNext={() => setPage((n) => Math.min(pages, n + 1))}
        />
      )}
    </TqModal>
  );
}
