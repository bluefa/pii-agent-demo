'use client';

/**
 * Scan credential (permission) card — invalid credentials are the most common
 * cause of scan failures, so the verification verdict and its cause
 * (fail_reason/fail_message) render inside the scan tab, in place (read-only).
 * The three providers share one response shape: { status, fail_reason,
 * fail_message, last_verified_at } + a provider identity
 * (role_arn/app_id/gcp_project_id).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { getAwsRoleVerification } from '@/app/lib/api/aws';
import { getAzureScanApp } from '@/app/lib/api/azure';
import { getGcpScanServiceAccount } from '@/app/lib/api/gcp';
import { SCAN_CREDENTIAL_LABELS } from '@/app/components/features/scan/scan-labels';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type { CloudProvider } from '@/lib/types';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/** Structural union of the three providers' verification responses — every schema is partial, so all fields are optional. */
interface CredentialVerification {
  status?: string | null;
  fail_reason?: string | null;
  fail_message?: string | null;
  last_verified_at?: string | null;
  role_arn?: string | null;
  app_id?: string | null;
  gcp_project_id?: string | null;
}

const fetchByProvider = (
  provider: CloudProvider,
  targetSourceId: number,
): Promise<CredentialVerification> => {
  switch (provider) {
    case 'AWS':
      return getAwsRoleVerification(targetSourceId, 'scan');
    case 'Azure':
      return getAzureScanApp(targetSourceId);
    case 'GCP':
      return getGcpScanServiceAccount(targetSourceId);
    case 'IDC':
      // IDC has no cloud scan — the caller (ScanTab) never renders this card.
      return Promise.resolve({});
  }
};

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'done'; data: CredentialVerification };

/**
 * Only GCP enumerates the status contract (VALID/INVALID/UNVERIFIED) — AWS and
 * Azure send free strings, so map as an open set. Vocabulary and tone align
 * with RoleVerifyModal verdictMeta (검증 완료/검증 중/검증 실패); UNVERIFIED is
 * "not verified yet" (off), not an error.
 */
const pillSpec = (status: string | null | undefined): { cls: string; label: string } => {
  switch (status) {
    case 'VALID':
    case 'COMPLETED':
      return { cls: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', label: '검증 완료' };
    case 'IN_PROGRESS':
      return { cls: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]', label: '검증 중' };
    case 'UNVERIFIED':
      return { cls: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', label: '미검증' };
    case 'FAIL':
    case 'INVALID':
      return { cls: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]', label: '검증 실패' };
    default:
      return { cls: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', label: status ?? '미확인' };
  }
};

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

export interface ScanCredentialCardProps {
  provider: CloudProvider;
  targetSourceId: number;
}

export function ScanCredentialCard({ provider, targetSourceId }: ScanCredentialCardProps): ReactElement {
  // Read-only — the "re-verify" button was dropped (ops feedback: refreshing the screen is enough).
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchByProvider(provider, targetSourceId);
        if (!cancelled) setState({ phase: 'done', data });
      } catch {
        if (!cancelled) setState({ phase: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, targetSourceId]);

  const credentialLabel = SCAN_CREDENTIAL_LABELS[provider];
  // Verdict beside the title — same slot as the recent-scan card's status pill (ops feedback).
  const pill = state.phase === 'done' ? pillSpec(state.data.status) : null;

  return (
    // flex-col — mt-auto pins the bottom time row (last verified) so the floor lines up with the sibling card.
    <section className={cn(pipelineStyles.card.base, 'flex flex-col')} aria-label="스캔 권한">
      <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
        <Icon name="shield" size={18} className="text-[var(--pl-primary)]" />
        스캔 권한
        {pill && (
          <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, pill.cls)}>
            {pill.label}
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
      ) : state.phase === 'error' ? (
        <p className={cn(pipelineStyles.text.meta, 'mt-4')}>자격 정보를 불러오지 못했습니다.</p>
      ) : (
        <CredentialResult data={state.data} />
      )}
    </section>
  );
}

function CredentialResult({ data }: { data: CredentialVerification }): ReactElement {
  // Error box only for failure (FAIL/INVALID) or when the server sent a cause — unverified is not an error.
  const failed =
    data.status === 'FAIL'
    || data.status === 'INVALID'
    || data.fail_reason != null
    || data.fail_message != null;

  return (
    <>
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

      {/* On failure the cause (code + message) shows right here — free strings by contract, passed through as-is. */}
      {failed && (
        <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
          {data.fail_reason && (
            <span className="[font-family:var(--pl-font-mono)] font-semibold">{data.fail_reason}</span>
          )}
          <span className={data.fail_reason ? 'ml-2' : undefined}>
            {data.fail_message ?? '자격 검증에 실패했습니다. 권한 설정을 확인해 주세요.'}
          </span>
        </p>
      )}

      {/* Bottom time row — same grammar as the recent-scan card (label over value),
          mt-auto pins it to the floor. Omitted when there is no value. */}
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
