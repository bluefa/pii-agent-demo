'use client';

/**
 * Scan credential (permission) card — invalid credentials are the most common
 * cause of scan failures, so the verification verdict and its cause render
 * inside the scan tab, in place. The three providers share one response shape:
 * { status, fail_reason, fail_message, last_verified_at } + a provider identity
 * (role_arn/app_id/gcp_project_id).
 *
 * Since the contract froze `fail_reason` as a stable enum, the client owns the
 * per-cause sentence and the follow-up action (roleVerification.ts), which
 * reordered the card: [verdict] → [guidance + action] → [raw response] →
 * [last verified]. The raw box does not collapse — cross-checking the backend
 * is standing work, and anything that costs a click stops happening.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { SCAN_CREDENTIAL_LABELS } from '@/app/components/features/scan/scan-labels';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type { CloudProvider } from '@/lib/types';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import type { RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import {
  fetchCredential,
  roleVerdict,
  VERDICT_BOX,
  VERDICT_PILL,
  type CredentialVerification,
  type RoleVerdict,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleVerification';

type JsonTokenKind = 'key' | 'string' | 'number' | 'bool' | 'null';

/**
 * Mini tokenizer for JSON.stringify(…, 2) output — distinguishes keys /
 * strings / numbers / booleans / null and leaves punctuation/whitespace as
 * plain gaps in between. Concatenating token texts must round-trip the input
 * exactly.
 */
export const tokenizeJson = (
  text: string,
): Array<{ kind: JsonTokenKind | 'plain'; text: string }> => {
  const tokens: Array<{ kind: JsonTokenKind | 'plain'; text: string }> = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let last = 0;
  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    if (match.index > last) tokens.push({ kind: 'plain', text: text.slice(last, match.index) });
    const [raw, str, colon] = match;
    if (str !== undefined) {
      // A string followed by a colon is a key (valid JSON never puts a colon after a value).
      tokens.push({ kind: colon ? 'key' : 'string', text: str });
      if (colon) tokens.push({ kind: 'plain', text: colon });
    } else if (raw === 'true' || raw === 'false') {
      tokens.push({ kind: 'bool', text: raw });
    } else if (raw === 'null') {
      tokens.push({ kind: 'null', text: raw });
    } else {
      tokens.push({ kind: 'number', text: raw });
    }
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push({ kind: 'plain', text: text.slice(last) });
  return tokens;
};

/** JSON token colors — semantic tokens only: keys primary, strings ok, numbers/booleans warn; null retreats via italic alone. */
const JSON_TOKEN_CLASS: Record<JsonTokenKind, string> = {
  key: 'text-[var(--pl-primary)]',
  string: 'text-[var(--pl-ok-text)]',
  number: 'text-[var(--pl-warn-text)]',
  bool: 'text-[var(--pl-warn-text)]',
  null: 'italic text-[var(--pl-text-weak)]',
};

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'done'; data: CredentialVerification };

export interface ScanCredentialCardProps {
  provider: CloudProvider;
  targetSourceId: number;
  /**
   * Opens RoleEditModal — OpsTargetView owns that modal. Only AWS has a
   * register/edit contract, so other providers get no callback, and without one
   * the card draws no CTA.
   */
  onEditRole?: (role: RoleKind) => void;
  /** Changes when a role is saved — re-verifies so a fixed credential never sits under a stale verdict. */
  reloadKey?: string;
}

export function ScanCredentialCard({
  provider,
  targetSourceId,
  onEditRole,
  reloadKey,
}: ScanCredentialCardProps): ReactElement {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  // Re-fetch, offered only on an undeterminable verdict — not a standing button
  // (that one was removed earlier). The skeleton flip happens here, in the event
  // handler: setting state straight from the effect cascades renders.
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => {
    setState({ phase: 'loading' });
    setRetryKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCredential(provider, targetSourceId, 'scan');
        if (!cancelled) setState({ phase: 'done', data });
      } catch {
        if (!cancelled) setState({ phase: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, targetSourceId, reloadKey, retryKey]);

  const credentialLabel = SCAN_CREDENTIAL_LABELS[provider];
  // Verdict beside the title — same slot as the recent-scan card's status pill (ops feedback).
  const data = state.phase === 'done' ? state.data : null;
  const verdict = data && roleVerdict('scan', data);

  return (
    // flex-col — mt-auto pins the bottom time row (last verified) so the floor lines up with the sibling card.
    <section className={cn(pipelineStyles.card.base, 'flex flex-col')} aria-label="스캔 권한">
      <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
        <Icon name="shield" size={18} className="text-[var(--pl-primary)]" />
        스캔 권한
        {verdict && (
          <span
            className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, VERDICT_PILL[verdict.tone])}
          >
            {verdict.label}
          </span>
        )}
      </h2>
      <p className={opsStyles.cardDesc}>{credentialLabel} 권한을 검증합니다.</p>

      {state.phase === 'loading' ? (
        // Skeleton drawing the response box + bottom time row — no jump on load.
        // The box skeleton is flex-1 too, holding the same slack-absorbing slot as the real box.
        <div className="mt-4 flex min-h-0 flex-1 flex-col" aria-busy>
          <div className={cn(opsStyles.skeleton, 'min-h-[176px] flex-1')} aria-hidden="true" />
          <div className={cn(opsStyles.skeleton, 'mt-4 h-4 w-44 flex-none')} aria-hidden="true" />
        </div>
      ) : data && verdict ? (
        <CredentialResult data={data} verdict={verdict} onEditRole={onEditRole} onRetry={retry} />
      ) : (
        <p className={cn(pipelineStyles.text.meta, 'mt-4')}>자격 정보를 불러오지 못했습니다.</p>
      )}
    </section>
  );
}

function CredentialResult({
  data,
  verdict,
  onEditRole,
  onRetry,
}: {
  data: CredentialVerification;
  verdict: RoleVerdict;
  onEditRole?: (role: RoleKind) => void;
  onRetry: () => void;
}): ReactElement {
  const { action } = verdict;
  // An action is drawn only when it can actually run — on a provider with no
  // register/edit contract the button would be there and do nothing.
  const editTarget = action?.kind === 'edit' ? action.role : undefined;
  const runAction =
    action?.kind === 'retry'
      ? onRetry
      : editTarget != null && onEditRole != null
        ? () => onEditRole?.(editTarget)
        : null;

  return (
    <>
      {/* Guidance goes first — now that fail_reason is a stable code, the
          per-cause sentence and the next action are what the operator reads
          first. Valid and in-progress carry no message, so nothing is drawn. */}
      {verdict.message && (
        <div className={cn('mt-4 rounded-lg px-3.5 py-3', VERDICT_BOX[verdict.tone])}>
          <p className="text-[14px] leading-[1.5]">{verdict.message}</p>
          {(runAction || verdict.note || verdict.rawCode) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              {runAction && action && (
                <PlButton variant="secondary" size="sm" onClick={runAction}>
                  {action.label}
                </PlButton>
              )}
              {/* An unmapped code is shown as-is — flattened, it never gets reported. */}
              {verdict.rawCode && (
                <span className="text-[12px] font-semibold text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]">
                  {verdict.rawCode}
                </span>
              )}
              {verdict.note && (
                <span className="text-[12px] text-[var(--pl-text-weak)]">{verdict.note}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Raw verification response — the full payload, identity included. The
          label is an in-box header; the body gets token highlighting (real
          JSON-viewer grammar) for diagnosis and backend cross-checks.
          flex-1 — when the sibling (recent scan) card is taller, the gray box
          absorbs the slack so no bare white gap is left under it (ops feedback). */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--pl-gray-100)] bg-[var(--pl-bg-inner)]">
        {/* 12/500 — same label grammar as time-row labels and modal th (600+tracking would be the odd one out). */}
        <p className="px-3.5 pt-2.5 text-[12px] font-medium text-[var(--pl-text-faint)]">
          응답 원문
        </p>
        {/* Punctuation stays the pre's base color (weak); only value tokens get
            color — faint at 12px is ≈2.6:1 contrast, below AA, so never body text. */}
        <pre className="min-h-0 flex-1 overflow-auto px-3.5 pb-3 pt-1 text-[12px] leading-[1.7] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]">
          {tokenizeJson(JSON.stringify(data, null, 2)).map((token, index) =>
            token.kind === 'plain' ? (
              token.text
            ) : (
              <span key={index} className={JSON_TOKEN_CLASS[token.kind]}>
                {token.text}
              </span>
            ),
          )}
        </pre>
      </div>

      {/* Bottom time row — same grammar as the recent-scan card (label over value),
          mt-auto pins it to the floor. Omitted when there is no value: a verdict
          we cannot date reads like a guarantee. */}
      {data.last_verified_at && (
        <div className="mt-auto">
          <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--pl-text-faint)]">마지막 검증</p>
              <p className="mt-0.5 whitespace-nowrap text-[14px] font-medium tabular-nums text-[var(--pl-text-medium)]">
                {fmtDateTimeSec(data.last_verified_at)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
