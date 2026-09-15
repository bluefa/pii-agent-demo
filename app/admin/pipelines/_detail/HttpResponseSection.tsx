/**
 * Infra Manager 응답 — the HTTP response Infra Manager returned for one FAILED
 * attempt (#5c), fetched when the attempt is shown. The task detail carries
 * only `failure_detail` ("Unexpected Infra Manager HTTP status: 400"); the
 * body that says why lives behind this call. Renders nothing while loading,
 * when nothing was stored (204), or when the call fails.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { d, Section } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { formatJson } from '@/app/admin/pipelines/_detail/jsonFormat';
import { getAttemptHttpResponse } from '@/app/lib/api/pipeline';
import { fmtDateTime } from '@/lib/pipeline/format';
import type { HttpResponseDetail } from '@/lib/pipeline/types';

export function HttpResponseSection({
  pipelineId,
  taskId,
  attemptNumber,
}: {
  pipelineId: number;
  taskId: number;
  attemptNumber: number;
}): ReactElement | null {
  // Keyed by attempt so a stale body never shows under a newly picked attempt.
  const [loaded, setLoaded] = useState<{ attemptNumber: number; response: HttpResponseDetail } | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getAttemptHttpResponse(pipelineId, taskId, attemptNumber, { signal: ac.signal })
      .then((res) => res && setLoaded({ attemptNumber, response: res }))
      .catch(() => {});
    return () => ac.abort();
  }, [pipelineId, taskId, attemptNumber]);

  if (!loaded || loaded.attemptNumber !== attemptNumber) return null;
  const { metadata, body } = loaded.response;
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
