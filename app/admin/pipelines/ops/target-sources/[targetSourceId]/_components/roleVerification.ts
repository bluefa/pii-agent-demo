/**
 * Role verification verdict — folds the wire pair (status × fail_reason) into
 * what the operator does next. Four outcomes: valid / not configured / wrong /
 * undeterminable.
 *
 * The tone comes from fail_reason, not status. The contract froze fail_reason
 * as a stable enum, so the client owns the sentence and the follow-up action;
 * fail_message is deprecated and survives only as the fallback for unmapped
 * codes (GCP/Azure, plus codes we do not know yet).
 *
 * codegen strips enums, so the generated type is a bare string: the map in this
 * file is the only expression of the contract, and an unmapped code is surfaced
 * verbatim rather than flattened into "unknown error".
 *
 * Rationale: docs/redesign/ops-role-verification.md
 */
import { getAwsRoleVerification } from '@/app/lib/api/aws';
import { getAzureScanApp } from '@/app/lib/api/azure';
import { getGcpScanServiceAccount } from '@/app/lib/api/gcp';
import type { CloudProvider } from '@/lib/types';
import { ROLE_META, type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';

/** Structural union of the three providers' responses — every schema is partial, so all optional. */
export interface CredentialVerification {
  status?: string | null;
  fail_reason?: string | null;
  fail_message?: string | null;
  last_verified_at?: string | null;
  role_arn?: string | null;
  app_id?: string | null;
  gcp_project_id?: string | null;
}

/**
 * Fetch a verification. Only AWS has an execution-role contract — GCP/Azure
 * expose the scan credential alone, and callers never ask them for execution.
 */
export const fetchCredential = (
  provider: CloudProvider,
  targetSourceId: number,
  kind: RoleKind,
): Promise<CredentialVerification> => {
  switch (provider) {
    case 'AWS':
      return getAwsRoleVerification(targetSourceId, kind);
    case 'Azure':
      return getAzureScanApp(targetSourceId);
    case 'GCP':
      return getGcpScanServiceAccount(targetSourceId);
    case 'IDC':
      // IDC has no cloud scan — callers do not render this card for it.
      return Promise.resolve({});
  }
};

export type VerdictTone = 'ok' | 'off' | 'err' | 'warn';

export interface VerdictAction {
  label: string;
  /** edit = open RoleEditModal, retry = re-fetch. */
  kind: 'edit' | 'retry';
  /** Target of an edit — may differ from what was verified (SCAN_ROLE_* points at the Scan Role). */
  role?: RoleKind;
}

export interface RoleVerdict {
  tone: VerdictTone;
  /** Text of the verdict pill. */
  label: string;
  /** Failure guidance — null while valid or in progress, and then no box is drawn. */
  message: string | null;
  action: VerdictAction | null;
  /** A supporting line the sentence cannot carry (target switch, propagation delay). */
  note: string | null;
  /** An unmapped code, surfaced verbatim. Null for mapped codes. */
  rawCode: string | null;
}

type ReasonSpec = Omit<RoleVerdict, 'rawCode'>;

const FALLBACK_MESSAGE = '자격 검증에 실패했습니다. 권한 설정을 확인해 주세요.';
const UNDETERMINED_MESSAGE = '지금은 검증 결과를 확정할 수 없습니다. 설정 문제가 아닐 수 있습니다.';

/**
 * The six codes the contract froze. Only ROLE_NOT_CONFIGURED words itself after
 * the role that was verified, so map values take `kind` as an argument.
 *
 * ROLE_NOT_CONFIGURED arrives as INVALID (a definitive configuration error) but
 * the screen paints it neutral: painting a target that has registered nothing
 * yet in red contradicts the header, which calls the same target "unregistered".
 * fail_reason is a stable key, so this is decidable without consulting status.
 */
const REASONS: Record<string, (kind: RoleKind) => ReasonSpec> = {
  ROLE_NOT_CONFIGURED: (kind) => ({
    tone: 'off',
    label: '설정 필요',
    message: `${ROLE_META[kind].title}이 등록되어 있지 않습니다.`,
    action: { kind: 'edit', role: kind, label: '등록하기' },
    note: null,
  }),
  INVALID_ROLE_ARN: (kind) => ({
    tone: 'err',
    label: '검증 실패',
    message: '등록된 Role ARN 형식이 올바르지 않습니다.',
    action: { kind: 'edit', role: kind, label: '수정하기' },
    note: null,
  }),
  ROLE_NOT_FOUND: (kind) => ({
    tone: 'err',
    label: '검증 실패',
    message: 'ARN은 올바르지만 AWS IAM에 해당 Role이 없습니다.',
    action: { kind: 'edit', role: kind, label: '수정하기' },
    note: null,
  }),
  SCAN_ROLE_NOT_CONFIGURED: () => ({
    tone: 'off',
    label: '설정 필요',
    message: 'Terraform Role을 검증하려면 Scan Role이 먼저 등록되어야 합니다.',
    action: { kind: 'edit', role: 'scan', label: 'Scan Role 등록하기' },
    note: '조치 대상이 Scan Role로 넘어갑니다.',
  }),
  SCAN_ROLE_NOT_ASSUMABLE: () => ({
    tone: 'err',
    label: '검증 실패',
    // The contract does not split the cause apart (bad ARN / trust policy /
    // caller permissions), so the screen does not pretend to know either.
    message: 'Scan Role을 넘겨받지 못했습니다. ARN 또는 신뢰 정책을 확인해 주세요.',
    action: { kind: 'edit', role: 'scan', label: 'Scan Role 수정하기' },
    note: '등록된 Terraform Role ARN은 원인이 아닙니다.',
  }),
  ROLE_VERIFICATION_UNAVAILABLE: () => ({
    tone: 'warn',
    label: '판정 불가',
    message: UNDETERMINED_MESSAGE,
    action: { kind: 'retry', label: '다시 확인' },
    note: 'IAM 변경 직후라면 잠시 후 다시 확인해 주세요.',
  }),
};

/**
 * Fallback when the code is unmapped — decide from status. Unknown codes are
 * deliberately NOT all routed to "undeterminable": INVALID means the server has
 * already decided, and GCP/Azure use their own code vocabulary (SA_NOT_CONFIGURED
 * and friends) while sharing this status vocabulary.
 */
const byStatus = (status: string | null, failMessage: string | null): ReasonSpec => {
  switch (status) {
    case 'VALID':
    case 'COMPLETED':
      return { tone: 'ok', label: '검증 완료', message: null, action: null, note: null };
    case 'IN_PROGRESS':
      return { tone: 'warn', label: '검증 중', message: null, action: null, note: null };
    case 'UNVERIFIED':
      return {
        tone: 'warn',
        label: '판정 불가',
        message: failMessage ?? UNDETERMINED_MESSAGE,
        action: { kind: 'retry', label: '다시 확인' },
        note: null,
      };
    case 'FAIL':
    case 'INVALID':
      return {
        tone: 'err',
        label: '검증 실패',
        message: failMessage ?? FALLBACK_MESSAGE,
        action: null,
        note: null,
      };
    default:
      // Open set — an unknown status becomes its own label.
      return { tone: 'off', label: status ?? '미확인', message: failMessage, action: null, note: null };
  }
};

export const roleVerdict = (kind: RoleKind, data: CredentialVerification): RoleVerdict => {
  const reason = data.fail_reason ?? null;
  const spec = reason ? REASONS[reason] : undefined;
  if (spec) return { ...spec(kind), rawCode: null };

  const base = byStatus(data.status ?? null, data.fail_message ?? null);
  // A code with no sentence to carry it would leave the box undrawn, and the
  // code would disappear from the screen with it.
  const message = base.message ?? (reason !== null ? FALLBACK_MESSAGE : null);
  return { ...base, message, rawCode: reason };
};

/** Verdict pill, beside the card title. */
export const VERDICT_PILL: Record<VerdictTone, string> = {
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
};

/** Guidance box — only "not configured" (off) keeps neutral body ink; gray on gray does not read. */
export const VERDICT_BOX: Record<VerdictTone, string> = {
  ok: '',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-text-medium)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
};
