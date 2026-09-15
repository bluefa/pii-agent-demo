/**
 * Infra Manager 응답 — the HTTP response Infra Manager returned for one FAILED
 * attempt (#5c), fetched when the attempt is shown. The task detail carries
 * only `failure_detail` ("Unexpected Infra Manager HTTP status: 400"); the
 * body that says why lives behind this call.
 *
 * loading → label + skeleton · 204 (nothing stored) → nothing ·
 * call failed → one line + 재시도 · ok → status line + body verbatim.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { d, Section } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { formatJson } from '@/app/admin/pipelines/_detail/jsonFormat';
import { getAttemptHttpResponse } from '@/app/lib/api/pipeline';
import { fmtDateTime } from '@/lib/pipeline/format';
import type { HttpResponseDetail } from '@/lib/pipeline/types';

type Load =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'failed' }
  | { kind: 'ok'; response: HttpResponseDetail };

export function HttpResponseSection({
  pipelineId,
  taskId,
  attemptNumber,
}: {
  pipelineId: number;
  taskId: number;
  attemptNumber: number;
}): ReactElement | null {
  // Keyed by attempt so a stale result never shows under a newly picked attempt.
  const [state, setState] = useState<{ attemptNumber: number; load: Load } | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    const settle = (load: Load): void => {
      if (!ac.signal.aborted) setState({ attemptNumber, load });
    };
    getAttemptHttpResponse(pipelineId, taskId, attemptNumber, { signal: ac.signal })
      .then((res) => settle(res ? { kind: 'ok', response: res } : { kind: 'none' }))
      .catch(() => settle({ kind: 'failed' }));
    return () => ac.abort();
  }, [pipelineId, taskId, attemptNumber, retryKey]);

  const load: Load = state?.attemptNumber === attemptNumber ? state.load : { kind: 'loading' };

  if (load.kind === 'none') return null;

  if (load.kind === 'loading') {
    return (
      <Section label="Infra Manager 응답">
        <div
          className={`${d.httpSkeleton} mt-2.5 h-24 w-full`}
          role="status"
          aria-label="Infra Manager 응답을 불러오는 중"
        />
      </Section>
    );
  }

  if (load.kind === 'failed') {
    return (
      <Section label="Infra Manager 응답">
        <div className="mt-2.5 flex items-center gap-3">
          <span className={d.httpNote}>Infra Manager 응답을 불러오지 못했습니다</span>
          <PlButton
            variant="secondary"
            size="sm"
            onClick={() => {
              // Cleared here, not in the effect (setState in an effect body is a lint error).
              setState({ attemptNumber, load: { kind: 'loading' } });
              setRetryKey((k) => k + 1);
            }}
          >
            재시도
          </PlButton>
        </div>
      </Section>
    );
  }

  const { metadata, body } = load.response;
  return (
    <Section label="Infra Manager 응답">
      <div className={d.httpHead}>
        HTTP {metadata.status_code ?? '—'} · {metadata.operation}
        {metadata.received_at && ` · ${fmtDateTime(metadata.received_at)}`}
        {metadata.truncated && ' · 잘림'}
      </div>
      <pre className={d.httpPre}>{body ? formatJson(body) : '(본문 없음)'}</pre>
    </Section>
  );
}
