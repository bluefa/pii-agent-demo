'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  cn,
  getButtonClass,
  idcStyles,
  stackGap,
  statusColors,
  textColors,
  textStyles,
} from '@/lib/theme';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { getAwsRoleVerification, type AwsRoleVerification } from '@/app/lib/api/aws';
import { useRelativeStamp } from '@/app/components/features/process-status/install-status-detail/LastCheckStamp';
import {
  terraformRoleFinding,
  type TerraformRoleFinding,
} from '@/app/components/features/process-status/aws/terraform-role-finding';

/**
 * Terraform 권한 부여 확인 단계의 오른쪽 패널.
 *
 * 이 자리에는 세 줄짜리 표가 있었다 — 검증 결과 / Role ARN / 확인 시각. 계약이 설치
 * 상태에 실어 보내는 `terraform_execution_role_verify` 가 `{status, role_arn}` 둘뿐이라,
 * 그 표는 "대기"라고만 말하고 왜 대기인지는 말할 수 없었다.
 *
 * 사유는 다른 오퍼레이션이 갖고 있다: `GET …/aws/verify-execution-role` 이 Role 을
 * 실시간으로 검증하고 동결된 `fail_reason` 여섯 코드 중 하나를 돌려준다. 이 패널이
 * 그 호출의 유일한 소비자이고, 순서는 관리자 콘솔의 자격 카드와 같다 —
 * [무엇을 검증했나] → [왜 막혔나 + 한 마디] → [지금 확인 + 마지막 검증].
 *
 * 판정 알약은 그리지 않는다. 패널 헤더의 상태 태그가 이미 계약(설치 상태)의 판정을
 * 걸고 있어서, 여기에 두 번째 판정을 두면 같은 단계가 두 어휘로 서로 다른 말을 하게
 * 된다(설치 상태는 COMPLETED/FAIL/…, 검증 API 는 VALID/INVALID/…). 이 패널이 더하는
 * 것은 판정이 아니라 그 판정의 근거다.
 */

const IDENTITY_LABEL_WIDTH = 'w-24'; // 96px — 이 패널이 원래 쓰던 라벨 폭 그대로.

const IdentityRow = ({ label, value }: { label: string; value: string | null }) => (
  <div className={cn('flex items-center', stackGap.group, textStyles.body)}>
    <span className={cn(IDENTITY_LABEL_WIDTH, 'flex-shrink-0', textColors.tertiary)}>{label}</span>
    {value ? (
      <span className="inline-flex items-center gap-1.5 min-w-0 group">
        <span className={cn('font-mono break-all', textStyles.caption, textColors.primary)}>
          {value}
        </span>
        <CopyButton value={value} label={`${label} 복사`} className="opacity-0 group-hover:opacity-100" />
      </span>
    ) : (
      <span className={textColors.tertiary}>—</span>
    )}
  </div>
);

/**
 * 원인 블록 — Step 2 반려 사유와 같은 인용 룰 문법(3px 룰 + 12px 태그 + 문장).
 * 채운 판을 쓰지 않는 이유도 같다: 카드 폭 그대로 선 색면은 "두 번째 카드"로 읽힌다.
 */
const FindingBlock = ({ finding }: { finding: TerraformRoleFinding }) => (
  <div className={cn('border-l-[3px] pl-4', statusColors.error.borderStrong)}>
    <p className={cn('text-[12px] font-bold tracking-[0.02em]', statusColors.error.textDark)}>
      확인 필요
      {/* 매핑되지 않은 코드는 그대로 — 뭉개면 아무도 보고하지 못한다. */}
      {finding.rawCode && (
        <span className={cn('ml-1.5 font-mono font-semibold', textColors.tertiary)}>
          {finding.rawCode}
        </span>
      )}
    </p>
    <p className={cn('mt-1.5 break-keep', textStyles.body, textColors.primary)}>{finding.message}</p>
    {finding.note && (
      <p className={cn('mt-1.5 break-keep', textStyles.caption, textColors.secondary)}>
        {finding.note}
      </p>
    )}
  </div>
);

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'done'; data: AwsRoleVerification };

interface TerraformRoleVerifyPanelProps {
  targetSourceId: number;
  /** metadata.aws_account_id — 어느 계정을 검증했는지가 조치의 출발점이다. */
  awsAccountId: string | null;
  /**
   * metadata.aws_terraform_execution_role_arn — **등록된 Role 의 유일한 출처**.
   *
   * 설치 상태(`terraform_execution_role_verify.role_arn`)와 검증 응답도 같은 이름의
   * 필드를 싣지만, 둘 다 "검증이 본 값"이라 검증 전이거나 실패하면 비어 있다. 실제
   * 캡처 응답(1008)이 정확히 그 모양이다 — 메타데이터에는 ARN 이 있는데 두 응답은
   * null 이라, 그 둘을 출처로 삼으면 화면이 등록된 Role 을 "—" 라고 말한다.
   */
  roleArn: string | null;
}

export const TerraformRoleVerifyPanel = ({
  targetSourceId,
  awsAccountId,
  roleArn,
}: TerraformRoleVerifyPanelProps) => {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  // 재검증 트리거. 스켈레톤 전환은 이벤트 핸들러에서 일으킨다 — 이펙트 본문에서
  // 상태를 세우면 렌더가 연쇄한다.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAwsRoleVerification(targetSourceId, 'execution')
      .then((data) => {
        if (!cancelled) setState({ phase: 'done', data });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, attempt]);

  const verifyNow = useCallback(() => {
    setState({ phase: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const data = state.phase === 'done' ? state.data : null;
  const finding = data ? terraformRoleFinding(data) : null;
  const stamp = useRelativeStamp(data?.last_verified_at);
  const verifying = state.phase === 'loading';

  return (
    // 라벨↔값은 한 덩어리(tight), 항목끼리는 형제(related), 블록 사이는 group.
    <div className={cn('flex flex-col', stackGap.group)}>
      {/* 판을 두르지 않는다 — 이 두 줄은 패널의 부제이지 별개의 블록이 아니고,
          카드 안에 카드를 만들지 않기로 한 결정이 이 안쪽에도 그대로 적용된다(오너).
          경계선이 없는 만큼 묶는 일은 여백이 한다: 라벨↔값은 96px 열로 정렬되고,
          두 줄 사이는 related, 아래 원인 블록과는 group 으로 벌어진다. */}
      <div className={cn('flex flex-col', stackGap.related)}>
        <IdentityRow label="AWS 계정" value={awsAccountId} />
        <IdentityRow label="Terraform Role" value={roleArn} />
      </div>

      {verifying ? (
        // 검증은 최대 30초까지 걸린다(라우트 expectedDuration). 그동안 이 자리를 비워
        // 두면 "원인 없음"과 구분되지 않으므로, 원인 블록이 설 자리를 그대로 세운다.
        <div aria-busy="true" aria-label="권한 검증 중" className="flex flex-col gap-1.5">
          <div className={cn(idcStyles.skeletonBar, 'h-3 w-20 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-5 w-[60%] rounded')} />
        </div>
      ) : state.phase === 'error' ? (
        <p role="alert" className={cn(textStyles.body, statusColors.error.textDark)}>
          권한 검증 결과를 불러오지 못했습니다.
        </p>
      ) : finding ? (
        <FindingBlock finding={finding} />
      ) : null}

      {/* 액션과 그 액션이 마지막으로 남긴 시각은 한 줄이다 — 버튼을 누르면 바뀌는 값이
          바로 옆에 있어야 눌린 것이 보인다. 채운 버튼은 카드에 하나뿐이어야 하므로
          outline (PR #666 에서 오너가 고른 CTA 무게). */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={verifyNow}
          disabled={verifying}
          className={cn(getButtonClass('outline'), 'whitespace-nowrap')}
        >
          {verifying ? '확인 중...' : '지금 확인'}
        </button>
        {/* 카드 헤더의 확인 시각과 같은 문법 — 경과가 앞에 서고 정확한 시각이 뒤를 받친다. */}
        {stamp && (
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            {stamp.elapsed && (
              <span className={cn(textStyles.captionStrong, textColors.secondary)}>
                {stamp.elapsed} 검증
              </span>
            )}
            <span className={cn(textStyles.caption, textColors.tertiary)}>{stamp.absolute}</span>
          </span>
        )}
      </div>
    </div>
  );
};
