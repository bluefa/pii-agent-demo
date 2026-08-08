'use client';

import { useState } from 'react';

import {
  bgColors,
  borderColors,
  chipStyles,
  cn,
  numericFeatures,
  primaryColors,
  rowLabelColor,
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
 * Two text layers above the description. The provider name leads — it is what the
 * eye lands on — followed by the word for the kind of id it owns and then the id
 * itself. Where a provider has no account of its own (IDC, SDU) the second layer
 * carries a plain gloss instead, and GCP puts its project there because the project
 * id is long enough to want the whole line.
 */
interface RowIdentity {
  /** Layer 1: the provider's own name. */
  name: string;
  /** Layer 1 continued — the word for the id ("Account", "Subscription"). */
  kind?: string;
  value?: string;
  /** Layer 2 when the account id belongs on its own line (GCP). */
  secondKind?: string;
  secondValue?: string;
  /** Layer 2 when there is no account at all (IDC, SDU). */
  gloss?: string;
}

const identityOf = (project: ProjectSummary): RowIdentity => {
  if (project.isSduType) {
    return { name: 'SDU', gloss: '서비스 담당자가 데이터를 직접 업로드' };
  }
  switch (project.cloudProvider) {
    case 'AWS':
      return { name: 'AWS', kind: 'Account', value: project.awsAccountId };
    case 'Azure':
      return { name: 'Azure', kind: 'Subscription', value: project.subscriptionId };
    case 'GCP':
      return { name: 'GCP', secondKind: 'Project', secondValue: project.gcpProjectId };
    case 'IDC':
      return { name: 'IDC 인프라', gloss: '사내망' };
  }
};

export const InfraRow = ({ project, onOpenDetail, onManageAction }: InfraRowProps) => {
  const identity = identityOf(project);
  // 설치 모드 is AWS-only — Terraform 실행 권한은 AWS 계정에만 존재하는 개념이라
  // 다른 CSP 행에 칩을 달면 없는 선택지를 있는 것처럼 보이게 한다. AWS 행이면 항상
  // 붙는다: 권한은 허용됐거나 아니거나 둘 중 하나이고, 안 붙어 있으면 허용된 적이
  // 없다는 뜻 — 즉 수동 설치다.
  const showInstallMode = project.cloudProvider === 'AWS' && !project.isSduType;
  // SDU 행은 밑에 깔린 CSP 를 숨기는 것이 규칙이다 — 제목이 "SDU"인데 Azure Tenant 가
  // 붙어 있으면 그 규칙이 이 한 줄에서만 깨진다.
  const showTenant =
    project.cloudProvider === 'Azure' && !project.isSduType && Boolean(project.tenantId);
  const showChinaRegion = project.isChinaRegion && !project.isSduType;
  const hasSecondLayer =
    showTenant || showInstallMode || Boolean(identity.gloss) || Boolean(identity.secondValue);
  // Both controls repeat once per card, so their labels have to carry which card they
  // belong to — otherwise a screen reader's button list is five identical entries.
  const rowName = [identity.name, identity.value ?? identity.secondValue].filter(Boolean).join(' ');

  // The card is a click target but not a focusable button — WAI-ARIA forbids
  // interactive descendants (the ⋮ menu) inside a role="button" wrapper. Keyboard
  // users reach the same destination through 상세 보기, the ⋮ menu's first item.
  return (
    <div
      onClick={() => onOpenDetail(project.targetSourceId)}
      className={cn(
        // `shrink-0`: the card is a flex child of the list's scrolling band, and a
        // flex child shrinks by default — without this, five cards squeeze to fit a
        // short window instead of scrolling, and the text crushes together.
        'group flex shrink-0 items-start gap-3.5 px-[21px] py-[19px] cursor-pointer rounded-[12px] border transition-colors',
        bgColors.surface,
        borderColors.card,
        tableRowLift.card,
      )}
    >
      {/* `self-center`, like the ⋮ opposite it. The card is `items-start` so the text
          column can stack from the top, but the mark is one 64px block against three
          text layers — top-aligned it sat high and left the card bottom-heavy. Both
          ends of the row now hang off the card's middle; only the text starts at the
          top, which is the one thing that should. */}
      <ProviderLogo
        provider={project.cloudProvider}
        isSdu={project.isSduType}
        variant="bare"
        className="flex-none self-center"
      />

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* The row's own title is what turns primary under the cursor — the affordance
              rides the content instead of a repeated link beside it, so the list holds
              no resting blue and the page's one CTA keeps its loudness. */}
          <span
            className={cn(
              'text-[16px] font-medium tracking-[-0.01em] transition-colors',
              textColors.primary,
              primaryColors.textGroupHover,
            )}
          >
            {identity.name}
          </span>
          {/* The kind word names the id that follows it, so with no id it names
              nothing — a provider whose account is missing shows its name alone. */}
          {identity.kind && identity.value && (
            <>
              <KindWord>{identity.kind}</KindWord>
              <IdValue>{identity.value}</IdValue>
            </>
          )}
          {showChinaRegion && (
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

        {/* Rendered only when it has something in it — an empty flex row would still
            spend the column's gap. */}
        {hasSecondLayer && (
          <div className="flex flex-wrap items-center gap-y-1 gap-x-5 pl-0.5">
            {identity.gloss && (
              // `cellText`: tertiary is 4.83:1 on the white card but 4.26:1 on the
              // hover tint — the promotion is what keeps this line AA under the cursor.
              <span
                className={cn('text-[14px] font-medium', textColors.tertiary, tableRowLift.cellText)}
              >
                {identity.gloss}
              </span>
            )}
            {identity.secondValue && (
              <span className="flex items-center gap-2">
                <KindWord>{identity.secondKind}</KindWord>
                <span
                  className={cn(
                    'text-[16px] font-medium tracking-[-0.01em]',
                    textColors.primary,
                  )}
                >
                  {identity.secondValue}
                </span>
              </span>
            )}
            {showTenant && (
              <MetaPair label="Tenant">
                <IdValue>{project.tenantId}</IdValue>
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
          <div className="flex gap-1.5 min-w-0 pl-0.5">
            <span className={cn('flex-none pt-0.5 text-[12px]', rowLabelColor)}>
              설명
            </span>
            <span className={cn('truncate text-[14px]', textColors.secondary)}>
              {project.description}
            </span>
          </div>
        )}
      </div>

      {/* One control, not two. "상세 보기 ↗" was the fourth way to reach the same screen —
          the card's own onClick, the title going blue under the cursor, and the ⋮ menu's
          first item all already go there — so it spent 66px and a second mark per row
          saying what the row was saying anyway. Keyboard access does not depend on it:
          the ⋮ opens a real button list whose first entry is 상세 보기.
          `self-center` because the card is `items-start` — the ⋮ used to hang 21px above
          the card's middle, tied to the title's line rather than to the card. */}
      <div
        className="flex-none self-center flex items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <RowMenu
          rowName={rowName}
          onViewDetail={() => onManageAction('view', project.targetSourceId)}
          onCopyId={() => onManageAction('copyId', project.targetSourceId)}
          onDelete={() => onManageAction('delete', project.targetSourceId)}
        />
      </div>
    </div>
  );
};

/** The word naming the kind of id that follows it — "Account", "Subscription", "Project". */
const KindWord = ({ children }: { children: React.ReactNode }) => (
  <span className={cn('text-[12px]', rowLabelColor)}>{children}</span>
);

/**
 * An account id or GUID — shown whole; a truncated id is not an id.
 *
 * `medium`, not `semibold`: the provider name is the row's subject and the id is
 * what qualifies it. At the same weight the two competed, and a 20-character GUID
 * won on sheer length.
 */
const IdValue = ({ children }: { children: React.ReactNode }) => (
  <span
    className={cn(
      'text-[14px] font-medium tracking-[-0.01em]',
      textColors.primary,
      numericFeatures.tabular,
    )}
  >
    {children}
  </span>
);

const MetaPair = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <span className="flex items-center gap-1.5">
    <span className={cn('text-[12px]', rowLabelColor)}>{label}</span>
    {children}
  </span>
);

/** 24px, filled dots — the Figma ⋮ is a 32px glyph, and a 16px icon read as a speck. */
const KEBAB_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="4.5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19.5" r="1.8" />
  </svg>
);

interface RowMenuProps {
  /** Distinguishes this row's controls in a screen reader's button list. */
  rowName: string;
  onViewDetail: () => void;
  onCopyId: () => void;
  onDelete: () => void;
}

/**
 * Bare ⋮ — no button chrome. Every row carries one, so a bordered button here would
 * put five identical frames down the list and outrank the one CTA on the page.
 * Target Source ID lives in here rather than on the row: a service owner never needs
 * it, but support asks for it, so it is one click away instead of on screen.
 *
 * Deliberately NOT `role="menu"`. That role puts screen readers into application mode
 * and promises arrow-key navigation and Escape; implementing the full APG pattern buys
 * nothing here, because the three items are already tab stops as plain buttons. The
 * roles are dropped rather than half-kept, so what AT is told matches what works.
 */
const RowMenu = ({ rowName, onViewDetail, onCopyId, onDelete }: RowMenuProps) => {
  const [open, setOpen] = useState(false);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`${rowName} 추가 작업`}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'inline-grid place-items-center p-1 transition-colors',
          textColors.tertiary,
          tableRowLift.cellText,
        )}
      >
        {KEBAB_ICON}
      </button>
      {open && (
        <>
          {/* A backdrop, not a document mousedown listener. The listener only closed
              the panel; the click that followed still reached the card underneath and
              navigated away, so dismissing the menu lost you the screen. This swallows
              that click — and it sits inside the card's stopPropagation wrapper, so
              the card never sees it either. */}
          <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className={rowMenuStyles.panel}>
            <button
              type="button"
              onClick={run(onViewDetail)}
              className={cn(rowMenuStyles.item, textColors.secondary, bgColors.mutedHover)}
            >
              상세 보기
            </button>
            <button
              type="button"
              onClick={run(onCopyId)}
              className={cn(rowMenuStyles.item, textColors.secondary, bgColors.mutedHover)}
            >
              Target Source ID 복사
            </button>
            <div className={cn('h-px my-1', bgColors.divider)} />
            <button
              type="button"
              onClick={run(onDelete)}
              className={cn(rowMenuStyles.item, statusColors.error.textDark, bgColors.mutedHover)}
            >
              계정 삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
};
