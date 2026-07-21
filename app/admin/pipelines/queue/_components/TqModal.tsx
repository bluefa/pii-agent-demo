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
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
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
  /** Footer actions (right-aligned). */
  footer: ReactNode;
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
  const { modal } = tqStyles;
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      variant="app"
      labelledBy={titleId}
      className={wide ? modal.widthWide : modal.width}
    >
      <div className={modal.header}>
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
        {meta != null && <div className={modal.meta}>{meta}</div>}
        {sub != null && <p className={modal.sub}>{sub}</p>}
      </div>
      <div className={modal.body}>{children}</div>
      <div className={modal.footer}>{footer}</div>
    </ModalShell>
  );
}
