import type { AwsRoleVerification } from '@/app/lib/api/aws';

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

const FALLBACK_MESSAGE = '권한 검증에 실패했습니다. 대상 AWS 계정의 권한 설정을 확인해 주세요.';
const UNDETERMINED_MESSAGE = '지금은 검증 결과를 확정할 수 없습니다. 설정 문제가 아닐 수 있습니다.';

/** 계약이 동결한 여섯 코드. */
const REASONS: Record<string, Omit<TerraformRoleFinding, 'rawCode'>> = {
  ROLE_NOT_CONFIGURED: {
    message: 'Terraform 실행 Role 이 아직 등록되지 않았습니다.',
    note: null,
  },
  INVALID_ROLE_ARN: {
    message: '등록된 Role ARN 형식이 올바르지 않습니다.',
    note: null,
  },
  ROLE_NOT_FOUND: {
    message: 'ARN 형식은 올바르지만 AWS IAM 에서 해당 Role 을 찾지 못했습니다.',
    note: '대상 AWS 계정에 Role 이 그대로 남아 있는지 확인해 주세요.',
  },
  SCAN_ROLE_NOT_CONFIGURED: {
    message: 'Terraform 권한을 검증하려면 Scan Role 이 먼저 등록되어야 합니다.',
    note: '이 단계에서 막힌 원인은 Terraform Role 이 아닙니다.',
  },
  SCAN_ROLE_NOT_ASSUMABLE: {
    // 계약이 원인을 더 쪼개 주지 않는다(ARN / 신뢰 정책 / 호출자 권한). 화면도
    // 아는 척하지 않는다.
    message: 'Scan Role 을 넘겨받지 못했습니다. Role ARN 또는 신뢰 정책을 확인해 주세요.',
    note: '등록된 Terraform Role ARN 은 원인이 아닙니다.',
  },
  ROLE_VERIFICATION_UNAVAILABLE: {
    message: UNDETERMINED_MESSAGE,
    note: 'IAM 변경 직후라면 잠시 후 다시 확인해 주세요.',
  },
};

/**
 * 코드가 맵에 없을 때는 status 로 판단한다. 전부 "판정 불가"로 보내지 않는 이유:
 * INVALID 은 서버가 이미 결론을 낸 것이고, UNVERIFIED 만이 결론이 없는 상태다.
 */
const byStatus = (status: string | null, failMessage: string | null): Omit<TerraformRoleFinding, 'rawCode'> | null => {
  switch (status) {
    case 'VALID':
    case 'COMPLETED':
    case 'IN_PROGRESS':
      // 통과했거나 아직 진행 중 — 할 말이 없으면 블록을 그리지 않는다.
      return null;
    case 'UNVERIFIED':
      return { message: failMessage ?? UNDETERMINED_MESSAGE, note: null };
    case 'FAIL':
    case 'INVALID':
      return { message: failMessage ?? FALLBACK_MESSAGE, note: null };
    default:
      return failMessage ? { message: failMessage, note: null } : null;
  }
};

/** 검증 응답 → 사용자에게 보여 줄 원인. 통과·진행 중이면 null(그릴 것이 없다). */
export const terraformRoleFinding = (data: AwsRoleVerification): TerraformRoleFinding | null => {
  const reason = data.fail_reason ?? null;
  const mapped = reason ? REASONS[reason] : undefined;
  if (mapped) return { ...mapped, rawCode: null };

  const base = byStatus(data.status ?? null, data.fail_message ?? null);
  // 문장 없이 코드만 있으면 블록이 안 그려지고 코드도 화면에서 사라진다.
  if (!base) {
    return reason ? { message: FALLBACK_MESSAGE, note: null, rawCode: reason } : null;
  }
  return { ...base, rawCode: reason };
};

/** 테스트가 두 맵의 키 집합을 대조한다 — 계약에 코드가 붙으면 한쪽만 늘어나지 않도록. */
export const TERRAFORM_ROLE_REASON_CODES = Object.keys(REASONS);
