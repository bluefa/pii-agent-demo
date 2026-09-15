'use client';

/**
 * 설치 상태 verdict — one row: mark · sentence · tag · (one link).
 *
 * The same grammar as the Step 5 row (`tc/StepHoldGate`): the operator reads
 * WHO has to do WHAT in one line, nothing else. Two tabs render it from the same
 * `installStateView` — the 인프라 작업 card above its step rows, and the 연결
 * 테스트 notice when the install is not finished — so the verdict is never
 * folded twice (docs/ux/benchmark/infra-install-state.md).
 *
 * The mark says whose side it is without colour: a clock in the weak text colour
 * for the service owner, the clock in the warn colour when it is the operator
 * reading this screen, the check for done, the triangle for not-read. Amber is
 * spent on the operator's own turn only, so a glance says "me".
 *
 * No 작업 시작 button here (owner 2026-08-30: the run starts from the 현재 작업
 * card and nowhere else). The 관리자 turn offers a link to that card instead.
 */
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import type { TcTone } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import type {
  InstallStateKind,
  InstallStateView,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installState';

export const INSTALL_STATE_TAG: Record<InstallStateKind, { tone: TcTone; label: string }> = {
  svc: { tone: 'off', label: '서비스 조치 필요' },
  me: { tone: 'warn', label: '관리자 조치 필요' },
  done: { tone: 'ok', label: '완료' },
  unk: { tone: 'off', label: '확인 불가' },
};

function Mark({ kind }: { kind: InstallStateKind }): ReactElement {
  switch (kind) {
    case 'done':
      return <Icon name="check-circle" size={20} className="text-[var(--pl-ok-text)]" title="완료" />;
    case 'unk':
      return <Icon name="warn-tri" size={20} className="text-[var(--pl-warn-text)]" title="확인 불가" />;
    case 'me':
      return <Icon name="clock" size={20} className="text-[var(--pl-warn-text)]" title="관리자 차례" />;
    default:
      return <Icon name="clock" size={20} className="text-[var(--pl-text-weak)]" title="서비스 차례" />;
  }
}

export interface InstallStateRowProps {
  view: InstallStateView;
  /** The one move offered at the row's end — a link, never a button. */
  action?: ReactNode;
  className?: string;
}

export function InstallStateRow({ view, action, className }: InstallStateRowProps): ReactElement {
  const tag = INSTALL_STATE_TAG[view.kind];
  return (
    <section
      className={cn(
        'flex items-start gap-2.5 rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-4 py-3',
        className,
      )}
      aria-label="설치 상태 판정"
    >
      <span className="flex-none">
        <Mark kind={view.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold leading-[1.4] break-keep text-[var(--pl-text-strong)]">
          {view.sentence}
          <TcPill tone={tag.tone} label={tag.label} />
        </p>
        {/* What already happened and where the move is made — one fact per line, the
            link on its own (owner 2026-09-15, Azure PE). */}
        {view.note && (
          <div className="mt-1 text-[12px] font-normal leading-[1.5] text-[var(--pl-text-weak)]">
            {view.note.lines.map((line) => (
              <p key={line} className="break-keep">
                {line}
              </p>
            ))}
            {view.note.link && (
              <a
                href={view.note.link.href}
                target="_blank"
                rel="noreferrer"
                className={cn(opsStyles.detailLink, 'mt-1 text-[12px]')}
              >
                {view.note.link.label}
                <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
              </a>
            )}
          </div>
        )}
      </div>
      {action && <span className="flex-none">{action}</span>}
    </section>
  );
}
