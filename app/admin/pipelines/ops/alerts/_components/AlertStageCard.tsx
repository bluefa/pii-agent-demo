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

/** 설치 필요 is the Terraform-driven bucket, so it wears the Terraform mark. */
export type AlertStageIcon = IconName | 'terraform';

const stageCard = {
  /**
   * card.flush 와 같은 표면이되 그림자만 md — 4장이 2×2 로 붙어 있어 xs 로는
   * 카드 경계가 배경에 묻는다. 공유 토큰(card.flush)을 건드리면 대시보드
   * 테이블 카드까지 따라 올라가므로 여기서만 선언한다. overflow-hidden 은
   * accent 바의 상단 모서리를 카드 radius 로 깎기 위해 필요하다.
   */
  card: 'bg-[var(--pl-bg-card)] border border-[var(--pl-border-strong)] rounded-[12px] shadow-[var(--pl-shadow-md)] overflow-hidden',
  accent: 'h-1 w-full bg-[var(--pl-gray-50)]',
  body: 'flex flex-1 flex-col gap-3 p-4',
  header: 'flex items-center justify-between gap-3',
  title: 'flex items-center gap-2',
  titleIcon: 'text-[var(--pl-text-medium)]',
  titleText: 'text-[17px] font-semibold leading-[1.5] text-[var(--pl-text-strong)]',
  badge:
    'inline-flex items-center rounded-full bg-[var(--pl-gray-100)] px-2 py-[3px] text-[11px] font-medium text-[var(--pl-text-medium)] tabular-nums',
  desc: 'text-[13px] leading-[1.5] text-[var(--pl-gray-600)]',
  headRow: 'flex items-center gap-3 py-2 text-[12px] font-medium text-[var(--pl-text-faint)]',
  row: 'relative flex items-center gap-3 py-2.5 border-t border-[var(--pl-border)] text-[13px] hover:bg-[var(--pl-gray-50)] transition-colors',
  // Column widths — the 연동 요청 목록 (queue/requests) card's, so the two
  // surfaces read as the same table at the same width.
  service: 'min-w-0 flex-1 truncate',
  code: 'w-[96px] flex-none truncate',
  target: 'w-[56px] flex-none',
  cloud: 'w-[76px] flex-none',
  serviceText: 'font-medium text-[var(--pl-text-strong)]',
  state: 'text-[13px] text-[var(--pl-text-weak)] py-2.5',
  /** Loading bar inside a skeleton cell — opsStyles.skeleton grammar (animate-
   *  pulse · rounded · gray-100) at one text line's height. */
  skeletonBar: 'block h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',
  footer: 'mt-auto',
} as const;

/** Column order is the 연동 요청 목록's: 서비스 이름 · 서비스 코드 · Target ·
 *  Cloud. Drives the header row and the loading skeleton together. */
const COLUMNS = [
  { label: '서비스 이름', className: stageCard.service },
  { label: '서비스 코드', className: stageCard.code },
  { label: 'Target', className: stageCard.target },
  { label: 'Cloud', className: stageCard.cloud },
] as const;

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

        {/* Flex divs, not a <table> — a <tr> can't host the absolutely
            positioned row-link overlay reliably — so the table semantics are
            declared. Every branch below stays a row inside this table. */}
        <div role="table" aria-label={`${label} 대상 표`}>
          <div className={stageCard.headRow} role="row">
            {COLUMNS.map((col) => (
              <span key={col.label} role="columnheader" className={col.className}>
                {col.label}
              </span>
            ))}
          </div>
          {failed ? (
            <div role="row">
              <p role="cell" aria-colspan={COLUMNS.length} className={stageCard.state}>
                목록을 불러오지 못했습니다.
              </p>
            </div>
          ) : loading ? (
            // Skeleton drawing the card's own footprint — PAGE_SIZE rows in the
            // real column widths, so nothing shifts when the rows arrive.
            <div role="rowgroup" aria-busy="true" aria-label={`${label} 목록을 불러오는 중`}>
              {Array.from({ length: PAGE_SIZE }, (_, row) => (
                <div key={row} className={stageCard.row} role="row" aria-hidden="true">
                  {COLUMNS.map((col) => (
                    <span
                      key={col.label}
                      role="cell"
                      className={cn(col.className, stageCard.skeletonBar)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div role="row">
              <p role="cell" aria-colspan={COLUMNS.length} className={stageCard.state}>
                해당 단계의 대상이 없습니다.
              </p>
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.targetSourceId} role="row" className={stageCard.row}>
                {/* 링크는 첫 셀 안에 — role=row 는 셀만 자식으로 가져야 해서 행
                    직속 <a> 는 스크린리더 순회에서 지워질 수 있다. absolute
                    inset-0 이라 덮는 범위는 그대로 행 전체다. */}
                <span role="cell" className={cn(stageCard.service, stageCard.serviceText)}>
                  <Link
                    href={passRoutes.pipelines.ops.targetSource(String(row.targetSourceId))}
                    aria-label={`Target Source ${row.targetSourceId} 운영 화면으로 이동`}
                    className="absolute inset-0"
                  />
                  {row.serviceName ?? '—'}
                </span>
                <span role="cell" className={cn(stageCard.code, pipelineStyles.table.mono)}>
                  {row.serviceCode ?? '—'}
                </span>
                <span role="cell" className={cn(stageCard.target, pipelineStyles.table.mono)}>
                  #{row.targetSourceId}
                </span>
                <span role="cell" className={stageCard.cloud}>
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
