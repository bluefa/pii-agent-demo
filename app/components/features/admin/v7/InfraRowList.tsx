'use client';

import { useState } from 'react';
import {
  borderColors,
  cn,
  numericFeatures,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import type { ProjectSummary } from '@/lib/types';
import { InfrastructureEmptyState } from '@/app/components/features/admin/infrastructure/InfrastructureEmptyState';
import { InfraRow, type InfraRowAction } from '@/app/components/features/admin/v7/InfraRow';

interface InfraRowListProps {
  projects: ProjectSummary[];
  loading: boolean;
  onAddInfra: () => void;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: InfraRowAction, targetSourceId: number) => void;
}

/**
 * Five cards a page, not ten. Each card carries the account id, its identifying
 * metadata and the description — reading one takes real attention, so the page holds
 * fewer of them.
 */
const PAGE_SIZE = 5;

export const InfraRowList = ({
  projects,
  loading,
  onAddInfra,
  onOpenDetail,
  onManageAction,
}: InfraRowListProps) => {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  // Clamp at render rather than resetting in an effect, which would paint one
  // out-of-range frame first.
  const safePage = Math.min(page, totalPages - 1);
  const visible = projects.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (loading && projects.length === 0) {
    return (
      <div className="p-12 text-center">
        <div
          className={cn(
            'w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3',
            statusColors.info.border,
          )}
        />
        <p className={cn('text-sm', textColors.tertiary)}>로딩 중...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return <InfrastructureEmptyState onAddInfra={onAddInfra} />;
  }

  return (
    <div className="flex flex-col gap-3.5" aria-busy={loading}>
      {/* No bar chrome: the cards below already own every edge on this column, so a
          bordered toolbar would draw a frame around nothing. The count describes this
          list, not the service, which is why it lives here and not in the page header. */}
      <div className={cn('flex items-center gap-2 pl-1 pb-3 text-[14px]', textColors.secondary)}>
        연동 대상 계정
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[12px] font-bold',
            primaryColors.bgLight,
            primaryColors.textOnLight,
            numericFeatures.tabular,
          )}
        >
          {projects.length}건
        </span>
      </div>

      {visible.map((project) => (
        <InfraRow
          key={project.id}
          project={project}
          onManageAction={onManageAction}
          onOpenDetail={onOpenDetail}
        />
      ))}

      <div
        className={cn(
          'flex items-center justify-center gap-5 h-[52px] border-t',
          borderColors.light,
        )}
      >
        <PageArrow
          label="이전 페이지"
          disabled={safePage <= 0}
          onClick={() => setPage(safePage - 1)}
        >
          ←
        </PageArrow>
        <span
          className={cn('text-[14px] font-medium', textColors.secondary, numericFeatures.tabular)}
        >
          {safePage + 1}/{totalPages} 페이지
        </span>
        <PageArrow
          label="다음 페이지"
          disabled={safePage >= totalPages - 1}
          onClick={() => setPage(safePage + 1)}
        >
          →
        </PageArrow>
      </div>
    </div>
  );
};

const PageArrow = ({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'inline-grid w-9 h-9 place-items-center rounded-lg text-[18px] font-bold transition-colors',
      textColors.secondary,
      'disabled:opacity-35 disabled:cursor-not-allowed',
    )}
  >
    {children}
  </button>
);
