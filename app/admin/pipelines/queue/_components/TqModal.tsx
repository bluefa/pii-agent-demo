/**
 * TqModal — the Task Queue app-modal (design spec §6 `.modal.app`): an eyebrow
 * (primary dot + ctx · #id), a 24/700 title, an optional meta row, and a weak
 * sub line, over a scrolling body and a border-topped footer. Built on ModalShell
 * variant='app' (r20/p0/88vh shell + focus trap + ESC/overlay/route close); this
 * component owns only the am-header/body/footer anatomy. `wide` → 840px (논리 DB /
 * NLB tables), default 720px.
 */
'use client';

import { useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

export interface TqModalProps {
  open: boolean;
  onClose: () => void;
  /** Eyebrow context label (weak) — e.g. "연동 요청". Omit to hide the eyebrow row. */
  eyebrowCtx?: ReactNode;
  /** Eyebrow identifier (primary bold) — e.g. "#1027". Omit to show ctx alone. */
  eyebrowId?: ReactNode;
  /** Title — 24/700. */
  title: ReactNode;
  /** Sub line — 16/400 weak purpose sentence. */
  sub?: ReactNode;
  /** Optional meta row between title and sub (e.g. tag + mono id). */
  meta?: ReactNode;
  /**
   * Footer actions (right-aligned). Omit on a read-only modal whose only action would
   * have been 닫기 — the header then carries an X instead, so there is always exactly
   * one visible way out (§modal-escape) and never a footer holding just a dismiss.
   */
  footer?: ReactNode;
  /** 840px width (tables) — default 720. */
  wide?: boolean;
  children: ReactNode;
}

export function TqModal({
  open,
  onClose,
  eyebrowCtx,
  eyebrowId,
  title,
  sub,
  meta,
  footer,
  wide,
  children,
}: TqModalProps): ReactElement | null {
  const titleId = useId();
  const metaId = useId();
  const { modal } = tqStyles;
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      variant="app"
      // The meta row joins the name when it is there. A fixed title (담당자 확인,
      // 접근 권한 요청, NLB 배정) says what the modal does but not what it acts on —
      // labelling by the title alone announces two dialogs for two different services
      // under one identical name. aria-labelledby takes an id list, so the visual
      // split (fixed title, subject on its own line) survives intact.
      labelledBy={meta != null ? `${titleId} ${metaId}` : titleId}
      className={wide ? modal.widthWide : modal.width}
    >
      <div className={cn(modal.header, footer == null && 'relative')}>
        {footer == null && (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            // Inset from the shell, not from the header's padding box: right-0/top-0 put
            // it in the r20 corner itself, half-outside the rounded edge.
            className="absolute right-4 top-4 inline-grid h-8 w-8 place-items-center rounded-md text-[var(--pl-text-weak)] transition-colors hover:bg-[var(--pl-gray-100)] hover:text-[var(--pl-text-medium)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-primary)]"
          >
            <Icon name="x" size="sm" />
          </button>
        )}
        {eyebrowCtx != null && (
          <div className={modal.eyebrow}>
            <span className={modal.eyebrowDot} />
            <span className={modal.eyebrowCtx}>{eyebrowCtx}</span>
            {eyebrowId != null && (
              <>
                <span className={modal.eyebrowSep}>·</span>
                <span className={modal.eyebrowId}>{eyebrowId}</span>
              </>
            )}
          </div>
        )}
        <h3 id={titleId} className={modal.title}>
          {title}
        </h3>
        {meta != null && (
          <div id={metaId} className={modal.meta}>
            {meta}
          </div>
        )}
        {sub != null && <p className={modal.sub}>{sub}</p>}
      </div>
      {/* modal.body is pb-0 — the footer's own pb-5 is what closes the modal. With no
          footer the body has to carry that bottom edge itself, or the content runs into
          the r20 corner. */}
      <div className={cn(modal.body, footer == null && 'pb-8')}>{children}</div>
      {footer != null && <div className={modal.footer}>{footer}</div>}
    </ModalShell>
  );
}
