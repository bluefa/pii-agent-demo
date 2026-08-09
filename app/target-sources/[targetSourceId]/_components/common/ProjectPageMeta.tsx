'use client';

import { Fragment, useState } from 'react';
import type { CloudProvider, TargetSource } from '@/lib/types';
import { AwsIcon, AzureIcon, GcpIcon, IdcIcon } from '@/app/components/ui/CloudProviderIcon';
import { CopyIcon, StatusSuccessIcon } from '@/app/components/ui/icons';
import { InstallationProcessProgressBar } from '@/app/components/features/process-status';
import { TIMINGS } from '@/lib/constants/timings';
import {
  cn,
  identityBarStyles,
  pageHeaderTitleStyle,
  projectHeaderStyles as h,
} from '@/lib/theme';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';
import { TcHeaderTag } from '@/app/target-sources/[targetSourceId]/_components/common/TcHeaderTag';

interface ProjectPageMetaProps {
  project: TargetSource;
  identity: ProjectIdentity;
  /** Optional header action slot (none by default — destructive actions live in the guide rail). */
  action?: React.ReactNode;
}

/**
 * SDU is an account TYPE, not a brand — customers upload their data themselves,
 * so the glyph is a non-brand upload arrow, not a logomark.
 */
const SduUploadIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    <path d="M12 4.5V14" />
    <path d="M8.2 8.3 12 4.5l3.8 3.8" />
  </svg>
);

interface ProviderDisplay {
  name: string;
  /** Plain-language gloss after a bare token (IDC → 사내망) for first-time readers. */
  gloss?: string;
  /** Group eyebrow — follows what the provider IS: cloud / on-prem / direct upload. */
  group: string;
  Icon: React.ComponentType<{ className?: string }>;
}

// Brand marks are the Simple Icons paths CloudProviderIcon already carries —
// tinted a single neutral so shape identifies the provider without shouting.
const PROVIDER_DISPLAY: Record<CloudProvider, ProviderDisplay> = {
  AWS: { name: 'AWS Cloud', group: '클라우드 정보', Icon: AwsIcon },
  Azure: { name: 'Azure Cloud', group: '클라우드 정보', Icon: AzureIcon },
  GCP: { name: 'Google Cloud', group: '클라우드 정보', Icon: GcpIcon },
  IDC: { name: 'IDC', gloss: '사내망', group: '인프라 정보', Icon: IdcIcon },
};

const SDU_DISPLAY: ProviderDisplay = {
  name: 'SDU',
  group: '데이터 제공',
  Icon: SduUploadIcon,
};

/** Copy affordance on mono identifiers — hover-reveal (TargetSourceIdentifier.mono spec). */
const CopyButton = ({ value, label }: { value: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), TIMINGS.COPY_FEEDBACK_MS);
    } catch (error) {
      console.warn('[ProjectPageMeta] clipboard.writeText failed', { error, label });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        identityBarStyles.copyBase,
        copied ? identityBarStyles.copyCopied : identityBarStyles.copyIdle,
        h.copyReveal,
      )}
    >
      {copied ? <StatusSuccessIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
    </button>
  );
};

/**
 * Flat page header for the target-source detail — chrome, not a card. One
 * label grammar throughout (12px eyebrow above 14px content), grouping by
 * distance instead of rules, and the quiet install stepper as the single
 * statement of step position. Body cards below keep the only card chrome.
 */
export const ProjectPageMeta = ({ project, identity, action }: ProjectPageMetaProps) => {
  // SDU wins over the underlying CSP (metadata.is_sdu_type, owner call) — the
  // account has no CSP identifiers, so identifier rows drop out on their own.
  const display = project.isSduType ? SDU_DISPLAY : PROVIDER_DISPLAY[identity.cloudProvider];
  const { Icon } = display;

  // The normalizer falls serviceName back to the code, so the line is never empty.
  const serviceTitle = project.serviceName || project.serviceCode;
  const description = project.description.trim();

  // Absent identifiers vanish instead of rendering "-": IDC·SDU have no CSP
  // account, and an empty slot is the truthful rendering (결정 #49).
  const identifierRows = identity.identifiers.filter(
    (id): id is typeof id & { value: string } => !!id.value && id.value.trim() !== '',
  );

  return (
    <header className={cn(h.surface, h.inner)}>
      <div className={h.titleRow}>
        <div className={h.titleGroup}>
          {/* 시안 2 (P2): the H1 states the page's JOB, not the object — the
              left service rail already answers "which service". */}
          <h1 className={pageHeaderTitleStyle}>PII Agent 설치</h1>
        </div>
        {action && <div className="flex flex-wrap items-center justify-end gap-2">{action}</div>}
      </div>

      {/* Demoted service identity — 12px eyebrow + 14px name + the code chip,
          the same facts the old title carried, one hierarchy level down. */}
      <div className={h.targetRow}>
        <span className={h.kvLabel}>설치 대상</span>
        <span className={h.providerName}>{serviceTitle}</span>
        <span className={h.codeChip}>
          <span className={h.codeChipLabel}>서비스 코드</span>
          <span className={h.codeChipValue}>{project.serviceCode}</span>
        </span>
      </div>

      {description !== '' && (
        <div className={h.block}>
          <div className={h.blockLabel}>설명</div>
          <p className={h.descText}>{description}</p>
        </div>
      )}

      <div className={h.block}>
        <div className={h.blockLabel}>{display.group}</div>
        <div className={h.groupRow}>
          <span className={h.provider}>
            <span className={h.providerIcon} aria-hidden="true">
              <Icon className="h-4 w-4" />
            </span>
            <span className={h.providerName}>
              {display.name}
              {display.gloss && (
                <>
                  <span className={h.providerGlossBar} aria-hidden="true">
                    |
                  </span>
                  <span className={h.providerGloss}>{display.gloss}</span>
                </>
              )}
            </span>
          </span>

          {project.isSduType && (
            <>
              <span className={h.divider} aria-hidden="true" />
              <span className={h.kv}>
                <span className={h.kvLabel}>연동 방식</span>
                <span className={h.kvValue}>고객사가 데이터를 직접 업로드</span>
              </span>
            </>
          )}

          {identifierRows.map((id) => (
            <Fragment key={id.label}>
              <span className={h.divider} aria-hidden="true" />
              <span className={h.kv}>
                <span className={h.kvLabel}>{id.label}</span>
                <span className={cn(h.kvValue, id.mono && h.kvValueMono)}>
                  <span className="min-w-0 truncate">{id.value}</span>
                  {id.mono && <CopyButton value={id.value} label={`${id.label} 복사`} />}
                </span>
              </span>
            </Fragment>
          ))}

          {identity.installMode && (
            <>
              <span className={h.divider} aria-hidden="true" />
              <span className={h.kv}>
                <span className={h.kvLabel}>설치 모드</span>
                <span className={h.kvValue}>
                  <span
                    className={
                      identity.installMode === 'auto' ? h.modeChipAuto : h.modeChipManual
                    }
                  >
                    {identity.installMode === 'auto' ? '자동 설치' : '수동 설치'}
                  </span>
                  {/* What the mode MEANS stays on-screen — a hover tooltip would
                      hide information the user needs to know. */}
                  <span className={h.modeNote}>
                    {identity.installMode === 'auto'
                      ? 'Terraform 권한 위임'
                      : '설치 스크립트 직접 실행'}
                  </span>
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* #661 P5: the latest connection-test verdict rides its own step, not the
          page title. Rendered without liveJob, so the tag self-fetches
          latest_version once. */}
      <InstallationProcessProgressBar
        currentStep={project.processStatus}
        tcTag={<TcHeaderTag targetSourceId={project.targetSourceId} />}
      />
    </header>
  );
};
