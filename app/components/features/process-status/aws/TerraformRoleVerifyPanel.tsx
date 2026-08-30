'use client';

import { useCallback, useState } from 'react';
import {
  buttonStyles,
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
import {
  LastVerifyStamp,
  useRelativeStamp,
} from '@/app/components/features/process-status/install-status-detail/LastCheckStamp';
import { isSettledInstallStatus } from '@/app/components/features/process-status/install-status-detail/model';
import {
  terraformRoleFinding,
  terraformRolePassed,
  type TerraformRoleFinding,
} from '@/app/components/features/process-status/aws/terraform-role-finding';
import type { AwsInstallStepValue } from '@/lib/types';

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
 *
 * That is also why the 30-second live call no longer fires on mount. Opening the step
 * used to spend it before anyone asked, and it bought nothing the header had not
 * already said: `terraform_execution_role_verify.status` arrives free with the
 * installation status and covers the verdict for every entry — COMPLETED, SKIP, FAIL,
 * IN_PROGRESS. What the enum cannot carry is the reason, so the reason is what the
 * button is for, and pressing it is the only thing that calls verify-execution-role.
 *
 * The division of labour that follows: **the header pill owns the verdict; the body
 * says what the header cannot** — the reason, once the live call has one, and before
 * that the invitation to go get it.
 *
 * ⛔ The body says nothing at all for COMPLETED / SKIP / BDC_INSTALL_REQUIRED. It is
 * tempting to fill that slot with the age of the verdict, and this panel did: a
 * caption reading 마지막 확인은 {시각} 기준이에요. The number was `last_check.checked_at`
 * — when the *installation status* was polled, not when the Role was verified — and it
 * sat above a button that verifies the Role. The card header already carries that
 * instant (`LastCheckStamp`) **with the tooltip that draws exactly that distinction**;
 * reprinting it here dropped the qualifier and advanced on every 30s poll while
 * nothing re-verified.
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

/**
 * The idle slot — what stands here before anyone has asked for a live check.
 *
 * Plain text, in the same left-aligned column as the identity rows
 * above and the button row below. That plainness is the whole distinction from the
 * finding block (Cloudscape: don't use an empty state for an error) — the error case
 * is marked by its 3px red rule and its 확인 필요 label, so nothing has to be added
 * here to say this is not one. A dashed glyph stood here and could not earn its place:
 * legible enough to see is legible enough to read as a status mark, which the body
 * does not own.
 *
 * ⛔ The lead line must NOT borrow the finding label's type. That label is 12px bold
 * `tracking-[0.02em]` in `statusColors.error.textDark`, and the two lines share the
 * words 확인 필요 — give them the same treatment and the idle slot becomes a greyed-out
 * copy of the error slot, which is the collapse the glyph was removed to avoid. It is a
 * lead line, not a status label: same size as the sentence under it, one step up in
 * weight and colour.
 */
const IdlePrompt = ({ lead }: { lead: boolean }) => (
  <div className={cn('flex flex-col', stackGap.tight)}>
    {/* 리드 줄은 FAIL 에서만 선다 — 아래 `blocked` 참조. */}
    {lead && (
      <span className={cn(textStyles.bodyStrong, textColors.primary)}>
        Terraform 권한 확인 필요
      </span>
    )}
    {/* 막힌 것이 있다고 전제하지 않는 문장. IN_PROGRESS/UNKNOWN 에서는 막혔는지조차
        모르는 상태이므로, 확인이 가져다주는 것을 그대로 적는다(상태 + 막힌 원인). */}
    <span className={cn(textStyles.body, textColors.secondary)}>
      지금 확인하면 권한 상태와 막힌 원인까지 알 수 있어요
    </span>
  </div>
);

type LoadState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'done'; data: AwsRoleVerification };

interface TerraformRoleVerifyPanelProps {
  targetSourceId: number;
  /**
   * `terraform_execution_role_verify.status` — the verdict the installation status
   * already carries, and the same value the panel header's pill hangs on.
   *
   * The body never restates it. It reads the enum only to decide whether it has
   * anything of its own to say, and how heavy the button below it is.
   */
  verifyStatus: AwsInstallStepValue;
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
  verifyStatus,
  awsAccountId,
  roleArn,
}: TerraformRoleVerifyPanelProps) => {
  const [state, setState] = useState<LoadState>({ phase: 'idle' });

  // The fetch lives in the handler, not in an effect: there is exactly one trigger
  // (the button), so an effect would only add a keyed counter to stop it firing on
  // the first render.
  const verifyNow = useCallback(() => {
    setState({ phase: 'loading' });
    getAwsRoleVerification(targetSourceId, 'execution')
      .then((data) => setState({ phase: 'done', data }))
      .catch(() => setState({ phase: 'error' }));
  }, [targetSourceId]);

  const data = state.phase === 'done' ? state.data : null;
  const finding = data ? terraformRoleFinding(data) : null;
  // A live response counts as an all-clear only when it says so. Absence of a finding
  // is not a pass — see `terraformRolePassed`.
  const passed = data ? terraformRolePassed(data) : false;
  const stamp = useRelativeStamp(data?.last_verified_at);
  const verifying = state.phase === 'loading';

  // ⛔ What the body says is decided by **positive** predicates over the six values of
  // `AwsInstallStepValue`, never by `!settled`. `settled` is COMPLETED|SKIP, so its
  // negation admits FAIL, IN_PROGRESS, UNKNOWN **and** BDC_INSTALL_REQUIRED — four
  // situations that do not share a sentence.
  //
  // • FAIL — the contract says the step is blocked. Only here is 확인 필요 true.
  // • IN_PROGRESS / UNKNOWN — the enum has no not-started value and nothing schedules
  //   a background verification (the live check is an on-demand GET), so the frontend
  //   cannot tell "running" from "never run". It must therefore claim neither that
  //   something is in flight nor that the user must act. UNKNOWN is the adapter's
  //   normalization sink for an unrecognised wire value, and the live call is the only
  //   source of information there. Both get the invitation, without the lead line.
  // • BDC_INSTALL_REQUIRED — not the service owner's turn. Inviting a 30-second call
  //   asks them to spend it on someone else's blocker.
  // • COMPLETED / SKIP — the header pill already answered; the body has nothing to add.
  const blocked = verifyStatus === 'FAIL';
  const invitesCheck =
    blocked || verifyStatus === 'IN_PROGRESS' || verifyStatus === 'UNKNOWN';
  // The button's weight measures whether there is something to act on. A live finding
  // contradicts a settled verdict (the enum can say COMPLETED simply because the last
  // installation-status poll predates the permission being revoked), and a failed
  // request is the one moment the button must be pressed again — it cannot be the
  // moment the button is weakest.
  const heavy = blocked || Boolean(finding) || state.phase === 'error';
  // 「다시」인가 「처음」인가 — 이것만은 계약이 답했는지가 진짜 질문이라 settled 를 쓴다.
  const settled = isSettledInstallStatus(verifyStatus);

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

      {/* 낭독용 한 줄 — 결과는 이제 사용자가 눌러서 오는 것이라, 화면을 보지 않는
          사용자에게는 누른 뒤 무엇이 왔는지 말해 줄 자리가 필요하다. 불러오기 실패는
          아래 줄이 role="alert" 로 이미 알리므로 여기서 두 번 말하지 않는다. */}
      <p className="sr-only" aria-live="polite">
        {finding
          ? `확인 필요. ${finding.message}`
          : passed
            ? '방금 확인했고, 막힌 곳은 없었어요.'
            : ''}
      </p>

      {/* One slot, and its content is the whole of what the body says. A live result
          replaces whatever the enum said; before that, only the statuses that are the
          service owner's turn get an invitation, and the rest get nothing. */}
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
      ) : passed ? (
        <p className={cn(textStyles.body, textColors.secondary)}>
          방금 확인했고, 막힌 곳은 없었어요.
        </p>
      ) : data ? (
        // 응답은 왔는데 원인도 통과도 말하지 않았다(진행 중이거나 미매핑 status).
        // 할 말이 없으면 그리지 않는다 — 침묵을 합격으로 번역하지 않는다.
        null
      ) : invitesCheck ? (
        <IdlePrompt lead={blocked} />
      ) : null}

      {/* 액션과 그 액션이 마지막으로 남긴 시각은 한 줄이다 — 버튼을 누르면 바뀌는 값이
          바로 옆에 있어야 눌린 것이 보인다. This row is fixed: the slot above changes
          with the state, the button does not move (owner's condition on this design). */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={verifyNow}
          disabled={verifying}
          className={
            heavy
              // 채운 버튼은 카드에 하나뿐이어야 하므로 outline (PR #666 에서 오너가 고른 CTA 무게).
              ? cn(getButtonClass('outline'), 'whitespace-nowrap')
              // Nothing to act on — the contract answered and no live check has said
              // otherwise, so this is a second opinion and steps back out of button
              // chrome (ScanStrip's 권한 확인 uses the same weight).
              : cn(buttonStyles.ghostText, textColors.secondary)
          }
        >
          {verifying ? '확인 중...' : settled || data ? '다시 확인' : '권한 확인'}
        </button>
        {/* 소요 시간은 **행동의 성질**이라 결과 슬롯이 아니라 버튼 옆에 산다 — 슬롯을
            따라 나타났다 사라지면 같은 버튼이 어떤 상태에서는 시간을 말하고 어떤
            상태에서는 말하지 않는다. 30000ms 는 라우트의 expectedDuration, 곧 타임아웃
            예산이지 관측값이 아니다(실측 748ms). 그래서 「약 30초」가 아니라 상한으로
            적는다 — 근거 없는 평균을 약속하지 않는다(docs/redesign/step3-applying-approved.md).
            누르는 동안에는 감춘다: 스켈레톤이 이미 진행 중이라고 말하고 있다. */}
        {!verifying && (
          <span className={cn(textStyles.caption, textColors.tertiary)}>
            최대 30초까지 걸릴 수 있어요
          </span>
        )}
        {/* 카드 헤더의 확인 시각과 같은 문법 — 시계 + 두 층, 경과가 위. */}
        {stamp && <LastVerifyStamp stamp={stamp} />}
      </div>
    </div>
  );
};
