/**
 * 자격(Role) 검증 판정 — wire (status × fail_reason) 를 "운영자가 다음에 할 일"
 * 단위로 접는다. 넷이다: 정상 / 설정 필요 / 잘못됨 / 판정 불가.
 *
 * 톤을 정하는 것은 status 가 아니라 fail_reason 이다. 계약이 fail_reason 을 안정
 * enum 으로 확정했으므로 문장과 조치의 주인은 클라이언트다 — fail_message 는
 * deprecated 라, 매핑이 없는 코드(GCP·Azure 및 아직 모르는 신규 코드)에서만
 * 폴백으로 쓴다.
 *
 * codegen 이 enum 을 strip 하므로 생성 타입은 그냥 string 이다: 이 파일의 맵이
 * 계약의 유일한 표현이고, 맵에 없는 코드는 뭉개지 않고 그대로 노출한다.
 *
 * 설계 근거: docs/redesign/ops-role-verification.md
 */
import { getAwsRoleVerification } from '@/app/lib/api/aws';
import { getAzureScanApp } from '@/app/lib/api/azure';
import { getGcpScanServiceAccount } from '@/app/lib/api/gcp';
import type { CloudProvider } from '@/lib/types';
import { ROLE_META, type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';

/** 세 프로바이더 검증 응답의 구조적 합집합 — 모든 스키마가 partial 이라 전부 optional. */
export interface CredentialVerification {
  status?: string | null;
  fail_reason?: string | null;
  fail_message?: string | null;
  last_verified_at?: string | null;
  role_arn?: string | null;
  app_id?: string | null;
  gcp_project_id?: string | null;
}

export type CredentialLoad =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'done'; data: CredentialVerification };

/**
 * 검증 조회. execution 은 AWS 에만 계약이 있다 — GCP·Azure 는 scan 자격만 부르고,
 * 호출부(OpsTargetView)가 그 둘에는 execution 을 요청하지 않는다.
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
      // IDC 는 클라우드 스캔이 없다 — 호출부가 이 카드를 렌더하지 않는다.
      return Promise.resolve({});
  }
};

export type VerdictTone = 'ok' | 'off' | 'err' | 'warn';

export interface VerdictAction {
  label: string;
  /** edit = RoleEditModal 열기, retry = 재조회. */
  kind: 'edit' | 'retry';
  /** edit 의 대상 — 검증 대상과 다를 수 있다 (SCAN_ROLE_* 는 Scan Role 을 가리킨다). */
  role?: RoleKind;
}

export interface RoleVerdict {
  tone: VerdictTone;
  /** 판정 pill 문구. */
  label: string;
  /** 실패 안내 — 정상·검증 중에는 null (이때 안내 박스를 그리지 않는다). */
  message: string | null;
  action: VerdictAction | null;
  /** 문장에 담기지 않는 보조 한 줄 (조치 대상 전환·전파 지연). */
  note: string | null;
  /** 맵에 없는 코드 — 그대로 노출한다. 매핑된 코드에서는 null. */
  rawCode: string | null;
}

type ReasonSpec = Omit<RoleVerdict, 'rawCode'>;

const FALLBACK_MESSAGE = '자격 검증에 실패했습니다. 권한 설정을 확인해 주세요.';
const UNDETERMINED_MESSAGE = '지금은 검증 결과를 확정할 수 없습니다. 설정 문제가 아닐 수 있습니다.';

/**
 * 계약이 확정한 여섯 코드. ROLE_NOT_CONFIGURED 만 검증 대상에 따라 문구가 달라지므로
 * 맵의 값은 kind 를 받는 함수다.
 *
 * ROLE_NOT_CONFIGURED 는 계약상 INVALID(확정적 구성 오류)로 오지만 화면은 중립으로
 * 그린다 — 아직 아무것도 등록하지 않은 대상을 빨갛게 칠하면, 같은 순간 헤더가 말하는
 * "미등록"과 어긋난다. fail_reason 이 안정 키라서 status 와 무관하게 결정할 수 있다.
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
    // 계약이 원인(ARN 오류 / trust policy / 호출자 권한)을 세분화하지 않으므로
    // 화면도 아는 척하지 않는다.
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
 * 매핑이 없을 때의 폴백 — status 로 판정한다. 미지의 코드를 무조건 "판정 불가"로
 * 보내지 않는 이유: INVALID 는 서버가 이미 확정했다는 뜻이고, GCP·Azure 는 자기
 * 코드 체계(SA_NOT_CONFIGURED 등)를 쓰면서 status 는 같은 어휘를 공유한다.
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
      // 열린 집합 — 모르는 status 는 값을 그대로 라벨로 쓴다.
      return { tone: 'off', label: status ?? '미확인', message: failMessage, action: null, note: null };
  }
};

export const roleVerdict = (kind: RoleKind, data: CredentialVerification): RoleVerdict => {
  const reason = data.fail_reason ?? null;
  const spec = reason ? REASONS[reason] : undefined;
  if (spec) return { ...spec(kind), rawCode: null };

  const base = byStatus(data.status ?? null, data.fail_message ?? null);
  // 코드는 왔는데 담을 문장이 없으면 박스 자체가 안 그려져 코드가 사라진다.
  const message = base.message ?? (reason !== null ? FALLBACK_MESSAGE : null);
  return { ...base, message, rawCode: reason };
};

/** 판정 pill (카드 제목 옆). */
export const VERDICT_PILL: Record<VerdictTone, string> = {
  ok: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
};

/** 안내 박스 — 설정 필요(off)만 본문을 중립 먹으로 둔다(회색 위 회색은 안 읽힌다). */
export const VERDICT_BOX: Record<VerdictTone, string> = {
  ok: '',
  off: 'bg-[var(--pl-off-bg)] text-[var(--pl-text-medium)]',
  err: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  warn: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
};

/** 헤더 role 행의 점 + 글자 — 판정만 말하고 이유는 카드에 맡긴다. */
export const VERDICT_DOT: Record<VerdictTone, string> = {
  ok: 'bg-[var(--pl-ok)]',
  off: 'bg-[var(--pl-off)]',
  err: 'bg-[var(--pl-err)]',
  warn: 'bg-[var(--pl-warn)]',
};

export const VERDICT_TEXT: Record<VerdictTone, string> = {
  ok: 'text-[var(--pl-ok-text)]',
  off: 'text-[var(--pl-text-faint)]',
  err: 'text-[var(--pl-err-text)]',
  warn: 'text-[var(--pl-warn-text)]',
};
