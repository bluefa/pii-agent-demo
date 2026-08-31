import type { AwsRoleVerification } from '@/app/lib/api/aws';
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';

/**
 * Terraform Execution Role 검증 결과 → 서비스 담당자가 읽을 한 문장.
 *
 * 계약은 `fail_reason` 을 안정된 enum 으로 동결했으므로, 문장을 소유하는 쪽은
 * 클라이언트다. `fail_message` 는 deprecated 라 매핑되지 않은 코드의 폴백으로만 산다.
 * codegen 이 enum 을 지우기 때문에 생성 타입은 맨 string 이고, 이 파일의 맵이 계약을
 * 표현하는 유일한 자리다 — 모르는 코드는 "알 수 없는 오류"로 뭉개지 않고 그대로 노출한다.
 *
 * 운영자용 쌍둥이는 `roleVerification.ts`(관리자 콘솔)다. 같은 여섯 코드를 다루지만
 * 문장이 다른 이유는 청중이 다르기 때문이다: 관리자는 Role 을 등록·수정할 수 있어
 * 문장이 곧 버튼이고, 이 화면의 사용자는 자기 AWS 계정에서 권한을 부여하는 쪽이라
 * 조치 대상이 화면 밖에 있다. 두 맵이 같은 키 집합을 덮는지는 테스트가 지킨다.
 */
export interface TerraformRoleFinding {
  /** 왜 막혔는가 — 한 문장. */
  message: string;
  /** 문장이 담지 못하는 한 마디(조치 대상이 다른 곳이라거나, 전파 지연이라거나). */
  note: string | null;
  /** 맵에 없는 코드. 그대로 보여 준다 — 뭉개면 보고되지 않는다. */
  rawCode: string | null;
}

/**
 * The sentences in one language. Every export below takes it as a parameter and
 * defaults to Korean, so a caller with no locale in hand keeps the behaviour it
 * had; the panel passes `INSTALL_COPY[locale].roleFinding`.
 */
export type TerraformRoleFindingCopy = (typeof INSTALL_COPY)['ko']['roleFinding'];

const KO = INSTALL_COPY.ko.roleFinding;

/** 계약이 동결한 여섯 코드. */
const reasons = (
  t: TerraformRoleFindingCopy,
): Record<string, Omit<TerraformRoleFinding, 'rawCode'>> => ({
  ROLE_NOT_CONFIGURED: {
    message: t.notConfigured,
    note: null,
  },
  INVALID_ROLE_ARN: {
    message: t.invalidArn,
    note: null,
  },
  ROLE_NOT_FOUND: {
    message: t.notFound,
    note: t.notFoundNote,
  },
  SCAN_ROLE_NOT_CONFIGURED: {
    message: t.scanNotConfigured,
    note: t.scanNotConfiguredNote,
  },
  SCAN_ROLE_NOT_ASSUMABLE: {
    // 계약이 원인을 더 쪼개 주지 않는다(ARN / 신뢰 정책 / 호출자 권한). 화면도
    // 아는 척하지 않는다.
    message: t.scanNotAssumable,
    note: t.scanNotAssumableNote,
  },
  ROLE_VERIFICATION_UNAVAILABLE: {
    message: t.undetermined,
    note: t.unavailableNote,
  },
});

/**
 * 코드가 맵에 없을 때는 status 로 판단한다. 전부 "판정 불가"로 보내지 않는 이유:
 * INVALID 은 서버가 이미 결론을 낸 것이고, UNVERIFIED 만이 결론이 없는 상태다.
 */
const byStatus = (
  status: string | null,
  failMessage: string | null,
  t: TerraformRoleFindingCopy,
): Omit<TerraformRoleFinding, 'rawCode'> | null => {
  switch (status) {
    case 'VALID':
    case 'COMPLETED':
    case 'IN_PROGRESS':
      // 통과했거나 아직 진행 중 — 할 말이 없으면 블록을 그리지 않는다.
      return null;
    case 'UNVERIFIED':
      return { message: failMessage ?? t.undetermined, note: null };
    case 'FAIL':
    case 'INVALID':
      return { message: failMessage ?? t.fallback, note: null };
    default:
      return failMessage ? { message: failMessage, note: null } : null;
  }
};

/** 검증 응답 → 사용자에게 보여 줄 원인. 통과·진행 중이면 null(그릴 것이 없다). */
export const terraformRoleFinding = (
  data: AwsRoleVerification,
  t: TerraformRoleFindingCopy = KO,
): TerraformRoleFinding | null => {
  const reason = data.fail_reason ?? null;
  const mapped = reason ? reasons(t)[reason] : undefined;
  if (mapped) return { ...mapped, rawCode: null };

  const base = byStatus(data.status ?? null, data.fail_message ?? null, t);
  // 문장 없이 코드만 있으면 블록이 안 그려지고 코드도 화면에서 사라진다.
  if (!base) {
    return reason ? { message: t.fallback, note: null, rawCode: reason } : null;
  }
  return { ...base, rawCode: reason };
};

/**
 * 실시간 응답이 **통과라고 말했는가**. VALID / COMPLETED 둘뿐이다.
 *
 * `terraformRoleFinding(data) === null` 은 통과와 같은 뜻이 아니다: IN_PROGRESS 도,
 * 문장 없는 미매핑 status 도 null 을 준다("할 말이 없으면 블록을 그리지 않는다").
 * 없는 말을 합격으로 번역하면 화면이 응답에 없는 사실을 만들어 낸다 — 화면이
 * 「막힌 곳은 없었어요」라고 말할 수 있는 것은 응답이 그렇게 말했을 때뿐이다.
 *
 * 판정 어휘가 이 파일에 있는 이유는 검증 API 의 status enum(VALID/INVALID/…)을 아는
 * 곳이 여기이기 때문이다. 패널이 status 문자열을 직접 분기하면 같은 enum 이 두 군데서
 * 해석된다.
 */
export const terraformRolePassed = (data: AwsRoleVerification): boolean =>
  data.status === 'VALID' || data.status === 'COMPLETED';

/** 테스트가 두 맵의 키 집합을 대조한다 — 계약에 코드가 붙으면 한쪽만 늘어나지 않도록. */
export const TERRAFORM_ROLE_REASON_CODES = Object.keys(reasons(KO));
