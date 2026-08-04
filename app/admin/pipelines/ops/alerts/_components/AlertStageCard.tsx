'use client';

/**
 * 운영 알림 stage card (Figma ZL0Y0okL8lReCrbf7JaVAp 1:123 `Card - *`) — one
 * bucket's own page of Target Sources. Each card owns its fetch and its pager
 * so paging one bucket never re-reads the other three; `reloadKey` is the
 * parent's 새로고침 signal.
 */
import { useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { getAlertTargetSources } from '@/app/lib/api/task-queue';
import type { AlertTargetKind, RequestListRow } from '@/lib/types/task-queue';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { TerraformLogo } from '@/app/admin/pipelines/_components/brandMarks';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';

/** 3 rows is the Figma card body (h320) — a 4th row would push the pager out. */
const PAGE_SIZE = 3;

/** Skeleton bar width per column (Target · 서비스 · 클라우드). */
const SKELETON_WIDTHS = ['w-[44px]', 'w-[72%]', 'w-[52px]'] as const;

/** 설치 필요 is the Terraform-driven bucket, so it wears the Terraform mark. */
export type AlertStageIcon = IconName | 'terraform';

const stageCard = {
  /**
   * card.flush 와 같은 표면이되 그림자만 md — 4장이 2×2 로 붙어 있어 xs 로는
   * 카드 경계가 배경에 묻는다. 공유 토큰(card.flush)을 건드리면 대시보드
   * 테이블 카드까지 따라 올라가므로 여기서만 선언한다. overflow-hidden 은
   * accent 바의 상단 모서리를 카드 radius 로 깎기 위해 필요하다.
   */
  card: 'bg-[var(--pl-bg-card)] border border-[var(--pl-border)] rounded-[12px] shadow-[var(--pl-shadow-md)] overflow-hidden',
  accent: 'h-1 w-full bg-[var(--pl-gray-50)]',
  body: 'flex flex-1 flex-col gap-3 p-4',
  header: 'flex items-center justify-between gap-3',
  title: 'flex items-center gap-2',
  titleIcon: 'text-[var(--pl-text-medium)]',
  titleText: 'text-[17px] font-semibold leading-[1.5] text-[var(--pl-text-strong)]',
  badge:
    'inline-flex items-center rounded-full bg-[var(--pl-gray-100)] px-2 py-[3px] text-[11px] font-medium text-[var(--pl-text-medium)] tabular-nums',
  desc: 'text-[13px] leading-[1.5] text-[var(--pl-gray-600)]',
  headRow: 'flex items-center py-2 text-[12px] font-medium text-[var(--pl-text-faint)]',
  row: 'relative flex items-center py-2.5 border-t border-[var(--pl-border)] text-[13px] hover:bg-[var(--pl-gray-50)] transition-colors',
  cell: 'flex-1 min-w-0 truncate',
  service: 'font-medium text-[var(--pl-text-strong)]',
  state: 'text-[13px] text-[var(--pl-text-weak)] py-2.5',
  /** Loading bar inside a skeleton cell — opsStyles.skeleton grammar (animate-
   *  pulse · rounded · gray-100) at one text line's height. */
  skeletonBar: 'block h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',
  footer: 'mt-auto',
} as const;

export interface AlertStageCardProps {
  kind: AlertTargetKind;
  label: string;
  description: string;
  icon: AlertStageIcon;
  /** Bumped by the parent's 새로고침. */
  reloadKey: number;
}

export function AlertStageCard({
  kind,
  label,
  description,
  icon,
  reloadKey,
}: AlertStageCardProps): ReactElement {
  const [rows, setRows] = useState<RequestListRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const loadKey = `${page}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const list = await getAlertTargetSources(kind, page, PAGE_SIZE, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRows(list.content);
        setTotalElements(list.totalElements);
        setTotalPages(Math.max(1, list.totalPages));
        setFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotalElements(0);
        setFailed(true);
      }
      if (!controller.signal.aborted) setLoadedKey(loadKey);
    })();
    return () => controller.abort();
  }, [kind, page, loadKey]);

  return (
    <section
      className={cn(stageCard.card, 'flex min-h-[320px] flex-col')}
      aria-label={`${label} 대상 목록`}
    >
      <div className={stageCard.accent} />
      <div className={stageCard.body}>
        <div className={stageCard.header}>
          <div className={stageCard.title}>
            {icon === 'terraform' ? (
              <TerraformLogo size={20} />
            ) : (
              <Icon name={icon} size={20} className={stageCard.titleIcon} />
            )}
            <h2 className={stageCard.titleText}>{label}</h2>
          </div>
          <span className={stageCard.badge}>{totalElements}건</span>
        </div>

        <p className={stageCard.desc}>{description}</p>

        <div>
          <div className={stageCard.headRow}>
            <span className={stageCard.cell}>Target</span>
            <span className={stageCard.cell}>서비스</span>
            <span className={stageCard.cell}>클라우드</span>
          </div>
          {failed ? (
            <p className={stageCard.state}>목록을 불러오지 못했습니다.</p>
          ) : loading ? (
            // Skeleton drawing the card's own footprint — PAGE_SIZE rows in the
            // real column widths, so nothing shifts when the rows arrive.
            <div aria-busy="true" aria-label={`${label} 목록을 불러오는 중`}>
              {Array.from({ length: PAGE_SIZE }, (_, row) => (
                <div key={row} className={stageCard.row} aria-hidden="true">
                  {/* The cells sit edge to edge (no row gap), so the bar is an
                      inner block narrower than its cell — three full-width bars
                      would read as one. */}
                  {SKELETON_WIDTHS.map((width) => (
                    <span key={width} className={stageCard.cell}>
                      <span className={cn(stageCard.skeletonBar, width)} />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className={stageCard.state}>해당 단계의 대상이 없습니다.</p>
          ) : (
            rows.map((row) => (
              <div key={row.targetSourceId} className={stageCard.row}>
                <Link
                  href={passRoutes.pipelines.ops.targetSource(String(row.targetSourceId))}
                  aria-label={`Target Source ${row.targetSourceId} 운영 화면으로 이동`}
                  className="absolute inset-0"
                />
                <span className={cn(stageCard.cell, pipelineStyles.table.mono)}>
                  #{row.targetSourceId}
                </span>
                <span className={cn(stageCard.cell, stageCard.service)}>{row.serviceName}</span>
                <span className={stageCard.cell}>
                  <ProvTag provider={row.cloudProvider ?? 'UNKNOWN'} />
                </span>
              </div>
            ))
          )}
        </div>

        <div className={stageCard.footer}>
          <OpsPagination page={page} totalPages={totalPages} onChange={setPage} always />
        </div>
      </div>
    </section>
  );
}
