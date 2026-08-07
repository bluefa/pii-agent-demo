'use client';

import { useEffect, useRef, useState } from 'react';

import {
  bgColors,
  borderColors,
  chipStyles,
  cn,
  numericFeatures,
  primaryColors,
  rowMenuStyles,
  statusColors,
  tableRowLift,
  textColors,
} from '@/lib/theme';
import type { ProjectSummary } from '@/lib/types';
import { ProviderLogo } from '@/app/components/features/admin/v7/ProviderLogo';

export type InfraRowAction = 'view' | 'copyId' | 'delete';

interface InfraRowProps {
  project: ProjectSummary;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: InfraRowAction, targetSourceId: number) => void;
}

/**
 * The row's subject line. A GUID or a 12-digit account number is what the service
 * owner recognises the row by, so it is the title; the label in front says which
 * kind of id it is. IDC and SDU have no cloud account at all — they get a plain
 * name plus a gloss, because inventing an id there would be a lie.
 */
interface RowIdentity {
  label?: string;
  value: string;
  mono: boolean;
  gloss?: string;
}

/** Middle-elide: a 36-char GUID buries its distinguishing head and tail if truncated at one end. */
const shortenId = (value: string): string =>
  value.length <= 20 ? value : `${value.slice(0, 8)}…${value.slice(-8)}`;

const identityOf = (project: ProjectSummary): RowIdentity => {
  if (project.isSduType) {
    return { value: 'SDU', mono: false, gloss: '고객사가 데이터를 직접 업로드' };
  }
  switch (project.cloudProvider) {
    case 'AWS':
      return project.awsAccountId
        ? { label: 'AWS Account', value: project.awsAccountId, mono: true }
        : { value: 'AWS 계정', mono: false };
    case 'Azure':
      return project.subscriptionId
        ? { label: 'Azure Subscription', value: shortenId(project.subscriptionId), mono: true }
        : { value: 'Azure 구독', mono: false };
    case 'GCP':
      return project.gcpProjectId
        ? { label: 'GCP Project', value: project.gcpProjectId, mono: true }
        : { value: 'GCP 프로젝트', mono: false };
    case 'IDC':
      return { value: 'IDC 인프라', mono: false, gloss: '사내망' };
  }
};

export const InfraRow = ({ project, onOpenDetail, onManageAction }: InfraRowProps) => {
  const identity = identityOf(project);
  // 설치 모드 is AWS-only — Terraform 실행 권한은 AWS 계정에만 존재하는 개념이라
  // 다른 CSP 행에 칩을 달면 없는 선택지를 있는 것처럼 보이게 한다.
  const showInstallMode = project.cloudProvider === 'AWS' && !project.isSduType;
  const showTenant = project.cloudProvider === 'Azure' && Boolean(project.tenantId);
  const hasMeta = showTenant || showInstallMode;

  // The row is a click target but not a focusable button — WAI-ARIA forbids
  // interactive descendants (the detail link, the ⋮ menu) inside a role="button"
  // wrapper. Keyboard users reach the same destination through the detail link.
  return (
    <div
      onClick={() => onOpenDetail(project.targetSourceId)}
      className={cn(
        'group flex items-start gap-3.5 px-5 py-[18px] cursor-pointer transition-colors',
        'border-b last:border-b-0',
        borderColors.light,
        bgColors.mutedHover,
      )}
    >
      <ProviderLogo provider={project.cloudProvider} isSdu={project.isSduType} neutral />

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {identity.label && (
            <span className={cn('text-[12px] font-semibold', textColors.tertiary)}>
              {identity.label}
            </span>
          )}
          {/* The row's own title is what turns blue under the cursor — the affordance
              rides the content instead of a repeated link beside it, so the list holds
              no resting blue at all and the page's one CTA keeps its loudness. */}
          <span
            className={cn(
              'text-[16px] font-bold tracking-[-0.01em] transition-colors',
              textColors.primary,
              primaryColors.textGroupHover,
              identity.mono && `font-mono ${numericFeatures.tabular}`,
            )}
          >
            {identity.value}
          </span>
          {identity.gloss && (
            <span className={cn('text-[14px] font-medium', textColors.tertiary)}>
              {identity.gloss}
            </span>
          )}
          {project.isChinaRegion && (
            <span
              className={cn(
                chipStyles.base,
                statusColors.error.bg,
                statusColors.error.textDark,
                statusColors.error.border,
                'border',
              )}
            >
              중국 리전
            </span>
          )}
        </div>

        {/* GCP·IDC·SDU have nothing to put here — render no layer at all rather than an
            empty flex row, which would still spend the column's gap. */}
        {hasMeta && (
          <div className="flex flex-wrap items-center gap-y-1 gap-x-5">
            {showTenant && (
              <MetaPair label="Tenant">
                <span className="font-mono">{shortenId(project.tenantId ?? '')}</span>
              </MetaPair>
            )}
            {showInstallMode && (
              <MetaPair label="설치 모드">
                <span
                  className={cn(
                    chipStyles.base,
                    project.isTerraformExecutionGranted
                      ? chipStyles.variant.auto
                      : chipStyles.variant.manual,
                  )}
                >
                  {project.isTerraformExecutionGranted ? '자동 설치' : '수동 설치'}
                </span>
              </MetaPair>
            )}
          </div>
        )}

        {project.description && (
          <div className="flex gap-1.5 min-w-0">
            <span className={cn('flex-none pt-0.5 text-[12px]', textColors.tertiary)}>설명</span>
            <span className={cn('truncate text-[14px]', textColors.secondary)}>
              {project.description}
            </span>
          </div>
        )}
      </div>

      <div
        className="flex-none flex items-center gap-3.5 pt-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chevron, not a labelled link: the whole row already opens the detail, so a
            worded control here was a second button for an action the row performs —
            repeated once per row, it outshouted the page's only CTA. The label lives
            in aria-label so keyboard and screen-reader users still get the words. */}
        <button
          type="button"
          onClick={() => onOpenDetail(project.targetSourceId)}
          aria-label={`${identity.value} 상세 정보 확인`}
          className={cn(
            'inline-grid place-items-center p-1 transition-colors',
            textColors.tertiary,
            tableRowLift.cellText,
          )}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
        <RowMenu
          onViewDetail={() => onManageAction('view', project.targetSourceId)}
          onCopyId={() => onManageAction('copyId', project.targetSourceId)}
          onDelete={() => onManageAction('delete', project.targetSourceId)}
        />
      </div>
    </div>
  );
};

const MetaPair = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <span className={cn('flex items-center gap-1.5 text-[14px]', textColors.secondary)}>
    <span className={cn('text-[12px]', textColors.tertiary)}>{label}</span>
    {children}
  </span>
);

const KEBAB_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

interface RowMenuProps {
  onViewDetail: () => void;
  onCopyId: () => void;
  onDelete: () => void;
}

/**
 * Bare ⋮ — no button chrome. Every row carries one, so a bordered button here would
 * put five identical frames down the list and outrank the one CTA on the page.
 * Target Source ID lives in here rather than on the row: a service owner never needs
 * it, but support asks for it, so it is one click away instead of on screen.
 */
const RowMenu = ({ onViewDetail, onCopyId, onDelete }: RowMenuProps) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="추가 작업"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn('inline-grid place-items-center p-1 transition-colors', textColors.tertiary)}
      >
        {KEBAB_ICON}
      </button>
      {open && (
        <div role="menu" className={rowMenuStyles.panel}>
          <button
            type="button"
            role="menuitem"
            onClick={run(onViewDetail)}
            className={cn(rowMenuStyles.item, textColors.secondary, bgColors.mutedHover)}
          >
            상세 보기
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={run(onCopyId)}
            className={cn(rowMenuStyles.item, textColors.secondary, bgColors.mutedHover)}
          >
            Target Source ID 복사
          </button>
          <div className={cn('h-px my-1', bgColors.divider)} />
          <button
            type="button"
            role="menuitem"
            onClick={run(onDelete)}
            className={cn(rowMenuStyles.item, statusColors.error.textDark, bgColors.mutedHover)}
          >
            계정 삭제
          </button>
        </div>
      )}
    </div>
  );
};
