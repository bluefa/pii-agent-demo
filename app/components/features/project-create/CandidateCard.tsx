'use client';

import type { ReactNode } from 'react';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { ProviderLogo } from '@/app/components/features/admin/v7/ProviderLogo';
import {
  IdValue,
  KindWord,
  MetaPair,
} from '@/app/components/features/admin/v7/RowIdentityText';
import { OtherGlyph } from '@/app/components/features/project-create/ProviderGlyphTile';
import {
  candidateDescriptionLine,
  candidateIdentity,
  candidateInstallModeIsAuto,
  candidateProviderKey,
  isSduCandidate,
} from '@/app/components/features/project-create/candidate-display';
import type { AwsInstallMode } from '@/app/components/features/project-create/wizard-model';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';
import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';
import type { CloudProvider } from '@/lib/types';
import {
  bgColors,
  borderColors,
  chipStyles,
  cn,
  rowLabelColor,
  statusColors,
  textColors,
} from '@/lib/theme';

const SDU_EXPLAINER =
  'Self Data Upload — PII Agent를 설치하는 대신, 데이터를 직접 업로드해 모니터링하는 방식이에요.';

const SduBadge = () => (
  <>
    {/* `value`: the white popover. The dark one is the app's state-explainer box and
        over a white card it reads as UI from another system. */}
    <Tooltip content={SDU_EXPLAINER} variant="value">
      <button
        type="button"
        aria-describedby="sdu-badge-explainer"
        className={cn(
          'inline-flex cursor-help items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold',
          statusColors.warning.bg,
          statusColors.warning.textDark,
        )}
      >
        SDU ⓘ
      </button>
    </Tooltip>
    {/* The visual tip is portaled, so it carries no id a trigger can point at. This
        copy of the sentence is what a screen reader announces. */}
    <span id="sdu-badge-explainer" className="sr-only">
      {SDU_EXPLAINER}
    </span>
  </>
);

const CANDIDATE_CLOUD_PROVIDER: Record<ProviderChipKey, CloudProvider | null> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
  idc: 'IDC',
  other: null,
};

/**
 * The /services row mark (ProviderLogo `bare`: 64px block, 36px monotone glyph,
 * self-centered). `CloudProvider` has no 기타 member, so that one case is drawn here
 * at the same geometry instead of passing ProviderLogo a provider the card is not.
 */
const CandidateLogo = ({
  providerKey,
  isSdu,
  className,
}: {
  providerKey: ProviderChipKey;
  isSdu: boolean;
  className?: string;
}) => {
  const provider = CANDIDATE_CLOUD_PROVIDER[providerKey];
  if (provider === null) {
    return (
      <span
        aria-label={isSdu ? 'SDU' : '기타'}
        className={cn(
          'inline-flex h-16 w-16 items-center justify-center rounded-lg',
          textColors.secondary,
          className,
        )}
      >
        {isSdu ? (
          <ProviderGlyph provider="sdu" isSdu className="h-9 w-9" />
        ) : (
          <OtherGlyph className="h-9 w-9" />
        )}
      </span>
    );
  }
  return <ProviderLogo provider={provider} isSdu={isSdu} variant="bare" className={className} />;
};

interface CandidateCardProps {
  candidate: TargetSourceCreationCandidateResponse;
  /** Fallback for the 설치 모드 chip when the response does not echo the permission. */
  installMode: AwsInstallMode;
  /** Right-hand slot — step 5 hangs each row's registration status here. */
  trailing?: ReactNode;
}

/** The step-4/step-5 candidate row, at the /services list's card anatomy. */
export const CandidateCard = ({ candidate, installMode, trailing }: CandidateCardProps) => {
  const providerKey = candidateProviderKey(candidate.cloud_type);
  const isSdu = isSduCandidate(candidate);
  const isDuplicate = candidate.status !== 'ADD';
  const identity = candidateIdentity(candidate);
  const description = candidateDescriptionLine(candidate);

  // Same three rules the /services row follows: 설치 모드 and 중국 리전 are both
  // AWS-only concepts (no other CSP carries a Terraform permission or a China
  // partition tag), and an SDU card hides the CSP underneath it — so neither the
  // tenant nor the region rides along.
  const showInstallMode = providerKey === 'aws' && !isSdu;
  const showTenant =
    providerKey === 'azure' && !isSdu && Boolean(candidate.metadata?.tenant_id);
  const showChinaRegion = providerKey === 'aws' && candidate.is_china_region === true && !isSdu;
  const hasSecondLayer =
    showTenant || showInstallMode || Boolean(identity.gloss) || Boolean(identity.secondValue);
  const isAutoInstall = candidateInstallModeIsAuto(candidate, installMode === 'auto');

  return (
    <div
      className={cn(
        'flex items-start gap-3.5 rounded-[12px] border px-[21px] py-[19px]',
        borderColors.card,
        isDuplicate ? bgColors.muted : bgColors.surface,
      )}
    >
      {/* `self-center` like the /services row: the card is items-start so the text can
          stack from the top, but the mark is one 64px block against three text layers
          and top-aligning it left the card bottom-heavy. */}
      <CandidateLogo
        providerKey={providerKey}
        isSdu={isSdu}
        className={cn('flex-none self-center', isDuplicate && 'opacity-60')}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-[16px] font-medium tracking-[-0.01em]',
              isDuplicate ? textColors.tertiary : textColors.primary,
            )}
          >
            {identity.name}
          </span>
          {/* The kind word names the id that follows it, so with no id it names
              nothing — the provider shows its name alone. */}
          {identity.kind && identity.value && (
            <>
              <KindWord>{identity.kind}</KindWord>
              <IdValue>{identity.value}</IdValue>
            </>
          )}
          {showChinaRegion && (
            <span
              className={cn(
                chipStyles.base,
                statusColors.error.bg,
                statusColors.error.textDark,
                statusColors.error.border,
                'border',
              )}
            >
              중국 리전
            </span>
          )}
          {isSdu && !isDuplicate && <SduBadge />}
        </div>

        {hasSecondLayer && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-0.5">
            {identity.gloss && (
              <span className={cn('text-[14px] font-medium', textColors.tertiary)}>
                {identity.gloss}
              </span>
            )}
            {identity.secondValue && (
              <span className="flex items-center gap-2">
                <KindWord>{identity.secondKind}</KindWord>
                <span
                  className={cn('text-[16px] font-medium tracking-[-0.01em]', textColors.primary)}
                >
                  {identity.secondValue}
                </span>
              </span>
            )}
            {showTenant && (
              <MetaPair label="Tenant">
                <IdValue>{candidate.metadata?.tenant_id}</IdValue>
              </MetaPair>
            )}
            {showInstallMode && (
              <MetaPair label="설치 모드">
                <span
                  className={cn(
                    chipStyles.base,
                    isAutoInstall ? chipStyles.variant.auto : chipStyles.variant.manual,
                  )}
                >
                  {isAutoInstall ? '자동 설치' : '수동 설치'}
                </span>
              </MetaPair>
            )}
          </div>
        )}

        {description && (
          <div className="flex min-w-0 gap-1.5 pl-0.5">
            <span className={cn('flex-none pt-0.5 text-[12px]', rowLabelColor)}>설명</span>
            <span className={cn('truncate text-[14px]', textColors.secondary)}>{description}</span>
          </div>
        )}

        {/* One step down from whatever the card is sitting on — on a muted duplicate
            card the gray-50 box would have vanished into it. */}
        <div
          className={cn(
            'mt-0.5 rounded-lg px-2.5 py-2 text-xs',
            isDuplicate ? bgColors.panel : bgColors.muted,
            textColors.secondary,
          )}
        >
          {isDuplicate
            ? '이미 등록된 계정이라 제외돼요.'
            : isSdu
              ? 'PII Agent 설치 방식을 지원하지 않는 Region·Cloud·Database가 포함되어 있어 Self Data Upload 방식을 추천했어요.'
              : '선택하신 계정에 PII Agent를 설치해 모니터링해요.'}
        </div>
      </div>

      {trailing && <div className="flex-none self-center">{trailing}</div>}
    </div>
  );
};
