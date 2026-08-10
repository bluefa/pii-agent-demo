'use client';

/**
 * Scan credential (permission) card — invalid credentials are the most common
 * cause of scan failures, so the verification verdict and its cause render
 * inside the scan tab, in place. The three providers share one response shape:
 * { status, fail_reason, fail_message, last_verified_at } + a provider identity
 * (role_arn/app_id/gcp_project_id).
 *
 * 계약이 `fail_reason` 을 안정 enum 으로 확정한 뒤로, 원인별 문장과 다음 행동의
 * 주인은 클라이언트다 (roleVerification.ts). 그래서 순서가 바뀌었다:
 * [판정] → [안내 + 조치] → [응답 원문] → [마지막 검증]. 원문 박스는 접지 않는다 —
 * 백엔드 대조는 운영자의 상시 작업이고, 클릭 한 번을 요구하면 대조를 안 하게 된다.
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
   * RoleEditModal 을 여는 콜백 — 모달의 주인은 OpsTargetView 다. 등록·수정 계약이
   * AWS 에만 있어 다른 프로바이더에서는 내려오지 않고, 그때는 CTA 를 그리지 않는다.
   */
  onEditRole?: (role: RoleKind) => void;
  /** Role 저장 후 바뀌는 값 — 고친 자격을 옛 판정 위에 두지 않도록 재검증을 건다. */
  reloadKey?: string;
}

export function ScanCredentialCard({
  provider,
  targetSourceId,
  onEditRole,
  reloadKey,
}: ScanCredentialCardProps): ReactElement {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  // 판정 불가에서만 쓰는 재조회 — 상시 버튼이 아니다 (그건 이전에 걷어냈다).
  // 스켈레톤 전환은 여기(이벤트 핸들러)에서 한다: 이펙트 안에서 곧바로 setState 하면
  // 연쇄 렌더가 된다.
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
  const verdict = state.phase === 'done' ? roleVerdict('scan', state.data) : null;

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
      ) : state.phase === 'error' ? (
        <p className={cn(pipelineStyles.text.meta, 'mt-4')}>자격 정보를 불러오지 못했습니다.</p>
      ) : (
        <CredentialResult
          data={state.data}
          verdict={verdict as RoleVerdict}
          onEditRole={onEditRole}
          onRetry={retry}
        />
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
  // 조치는 실제로 수행할 수 있을 때만 그린다 — 등록·수정 계약이 없는 프로바이더에서
  // 버튼만 남으면 눌러도 아무 일이 없다.
  const actionable =
    action !== null && (action.kind === 'retry' || (onEditRole != null && action.role != null));

  return (
    <>
      {/* 안내가 첫 자리 — fail_reason 이 안정 코드가 된 이상, 원인별 문장과 다음 행동이
          운영자가 먼저 읽어야 할 것이다. 정상·검증 중에는 message 가 없어 그리지 않는다. */}
      {verdict.message && (
        <div className={cn('mt-4 rounded-lg px-3.5 py-3', VERDICT_BOX[verdict.tone])}>
          <p className="text-[14px] leading-[1.5]">{verdict.message}</p>
          {(actionable || verdict.note || verdict.rawCode) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              {actionable && action && (
                <PlButton
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    action.kind === 'retry' ? onRetry() : onEditRole?.(action.role as RoleKind)
                  }
                >
                  {action.label}
                </PlButton>
              )}
              {/* 맵에 없는 코드는 뭉개지 않는다 — 그대로 보여야 제보가 올라온다. */}
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
