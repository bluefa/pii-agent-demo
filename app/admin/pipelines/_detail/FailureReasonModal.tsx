/**
 * FailureReasonModal — roomy read/copy view of a terminal attempt's failure cause
 * (task_attempt.failure_detail). Opened from AttemptDetail's "실패 원인" block when the
 * message is long. The cause is usually a Feign exception message with a trailing JSON
 * body (not pure JSON), so formatJson pretty-prints it ONLY when the whole string is
 * valid JSON and otherwise shows it verbatim. Mirrors the JobViewer modal grammar
 * (ModalShell + dark panel + copy). Mouse-only: Escape is disabled (`closeOnEsc={false}`)
 * so it never competes with the drawer's own Esc navigation; close via the ✕ or the overlay.
 */
import { type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { j } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { formatJson } from '@/app/admin/pipelines/_detail/jsonFormat';

export function FailureReasonModal({
  detail,
  subtitle,
  onClose,
}: {
  detail: string;
  subtitle: string;
  onClose: () => void;
}): ReactElement {
  const text = formatJson(detail); // verbatim unless the whole string is valid JSON
  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy="pl-fail-reason-title"
      className={j.viewer}
      style={j.viewerBaseSize}
      closeOnEsc={false}
    >
      <div className={j.vHead}>
        <div className="min-w-0">
          <div className={j.vTitle} id="pl-fail-reason-title">
            <span className={j.vJid}>실패 원인</span>
          </div>
          <div className={j.vSub}>{subtitle}</div>
        </div>
        <button type="button" className={j.vClose} onClick={onClose} aria-label="닫기" title="닫기 (Esc)">
          <Icon name="x" size="lg" />
        </button>
      </div>

      <div className={cn(j.panel, j.panelDark)}>
        <div className={j.strip}>
          <span className={j.toolbarGrow} />
          <PlButton
            variant="primary"
            size="sm"
            onClick={() => void navigator.clipboard?.writeText(text)}
            disabled={!text}
          >
            복사
          </PlButton>
        </div>
        <div className={j.logBody} tabIndex={0} role="region" aria-label="실패 원인 전체">
          <pre className={j.logPre}>{text}</pre>
        </div>
      </div>
    </ModalShell>
  );
}
