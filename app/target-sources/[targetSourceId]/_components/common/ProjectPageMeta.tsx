'use client';

import { Fragment, useState } from 'react';
import type { CloudProvider, TargetSource } from '@/lib/types';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { ChevronDownIcon, CopyIcon, StatusSuccessIcon } from '@/app/components/ui/icons';
import { InstallationProcessProgressBar } from '@/app/components/features/process-status';
import { TIMINGS } from '@/lib/constants/timings';
import { cn, identityBarStyles, projectHeaderStyles as h } from '@/lib/theme';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';
import { TcHeaderTag } from '@/app/target-sources/[targetSourceId]/_components/common/TcHeaderTag';

/** Ties the disclosure button to the block it opens (`aria-controls`). */
const META_BLOCK_ID = 'target-source-meta';

interface ProjectPageMetaProps {
  project: TargetSource;
  identity: ProjectIdentity;
  /** Optional header action slot (none by default — destructive actions live in the guide rail). */
  action?: React.ReactNode;
}

interface ProviderDisplay {
  name: string;
  /** Plain-language gloss after a bare token (IDC → 사내망) for first-time readers. */
  gloss?: string;
  /** Group eyebrow — follows what the provider IS: cloud / on-prem / direct upload. */
  group: string;
}

// The mark itself comes from `ProviderGlyph`, the same source the ops dashboard
// identity cell draws from, so one provider looks the same across the product.
const PROVIDER_DISPLAY: Record<CloudProvider, ProviderDisplay> = {
  AWS: { name: 'AWS Cloud', group: '클라우드 정보' },
  Azure: { name: 'Azure Cloud', group: '클라우드 정보' },
  GCP: { name: 'Google Cloud', group: '클라우드 정보' },
  IDC: { name: 'IDC', gloss: '사내망', group: '인프라 정보' },
};

const SDU_DISPLAY: ProviderDisplay = { name: 'SDU', group: '데이터 제공' };

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
 *
 * 개선안 D: three tiers at rest — the heading, the 설치 대상 summary, the progress
 * band. The meta blocks fold into that summary, because the header ran 333px
 * before the first card and only those tiers answer anything a reader needs
 * before starting work. Everything else is reference: true all day, read once.
 *
 * The summary line is the disclosure's own head, not a control parked beside it:
 * the facts on it are exactly what identifies the block below, so they state the
 * folded content instead of hiding it (오너 3차 지시).
 *
 * 시안 C splits WHERE from WHAT (오너 4차 지시, `docs/ux/benchmark/target-source-summary-line.md`):
 * the path names the target, the bar names the scope it installs into. That is
 * what let the provider and the account onto the folded line at all — the name
 * had been spending the bar's whole 542px budget, and a 50-char one wrapped it.
 */
export const ProjectPageMeta = ({ project, identity, action }: ProjectPageMetaProps) => {
  const [metaOpen, setMetaOpen] = useState(false);
  // SDU wins over the underlying CSP (metadata.is_sdu_type, owner call) — the
  // account has no CSP identifiers, so identifier rows drop out on their own.
  const display = project.isSduType ? SDU_DISPLAY : PROVIDER_DISPLAY[identity.cloudProvider];

  // The normalizer falls serviceName back to the code, so the line is never empty.
  const serviceTitle = project.serviceName || project.serviceCode;
  const description = project.description.trim();

  // Absent identifiers vanish instead of rendering "-": IDC·SDU have no CSP
  // account, and an empty slot is the truthful rendering (결정 #49).
  const identifierRows = identity.identifiers.filter(
    (id): id is typeof id & { value: string } => !!id.value && id.value.trim() !== '',
  );
  // The account rides the folded bar (오너 4차 지시). The first identifier IS the
  // account everywhere: AWS Account ID, Azure Subscription ID, GCP Project ID —
  // Azure's second (Tenant ID) stays in the block, and IDC·SDU have none at all.
  const account = identifierRows[0];

  // What the block still holds after the bar took the provider and the account:
  // the copy affordance, any second identifier, and how the install runs. A list,
  // so the group can disappear whole — IDC has no account and no mode, and a
  // labelled group with nothing under it says less than no group at all.
  const cloudFacts: React.ReactElement[] = [];
  if (project.isSduType) {
    cloudFacts.push(
      <span key="연동 방식" className={h.kv}>
        <span className={h.kvLabel}>연동 방식</span>
        <span className={h.kvValue}>고객사가 데이터를 직접 업로드</span>
      </span>,
    );
  }
  for (const id of identifierRows) {
    cloudFacts.push(
      <span key={id.label} className={h.kv}>
        <span className={h.kvLabel}>{id.label}</span>
        <span className={cn(h.kvValue, id.mono && h.kvValueMono)}>
          <span className="min-w-0 truncate">{id.value}</span>
          {id.mono && <CopyButton value={id.value} label={`${id.label} 복사`} />}
        </span>
      </span>,
    );
  }
  if (identity.installMode) {
    const auto = identity.installMode === 'auto';
    cloudFacts.push(
      <span key="설치 모드" className={h.kv}>
        <span className={h.kvLabel}>설치 모드</span>
        <span className={h.kvValue}>
          <span className={auto ? h.modeChipAuto : h.modeChipManual}>
            {auto ? '자동 설치' : '수동 설치'}
          </span>
          {/* What the mode MEANS stays on-screen — a hover tooltip would hide
              information the user needs to know. */}
          <span className={h.modeNote}>
            {auto ? 'Terraform 권한 위임' : '설치 스크립트 직접 실행'}
          </span>
        </span>
      </span>,
    );
  }

  return (
    <header className={cn(h.surface, h.inner)}>
      <div className={h.titleRow}>
        {/* 시안 C: the heading is the path. 「PII Agent 설치」 states the page's job at
            the weight of a location instead of a 24px title, and the service name
            gets the width it needs — clamped, because there is no contract maximum
            on it (swagger `service_name` has no maxLength). */}
        <h1 className={h.crumb}>
          PII Agent 설치
          <span className={h.crumbSep} aria-hidden="true">
            /
          </span>
          <span className={h.crumbName} title={serviceTitle}>
            {serviceTitle}
          </span>
          <span className={h.crumbSep} aria-hidden="true">
            /
          </span>
          <span className={h.crumbHere}>#{project.targetSourceId}</span>
        </h1>
        {action && <div className="flex flex-wrap items-center justify-end gap-2">{action}</div>}
      </div>

      <div className={h.targetGroup}>
        {/* The bar states the SCOPE the install runs in — which provider, which
            account, which service code. Those are the facts the owner asked to keep
            visible while folded, and they are also exactly what the block details,
            so the head summarises its own body and the press belongs to the whole
            bar. The name is not here: the path above already said it. */}
        <button
          type="button"
          onClick={() => setMetaOpen((open) => !open)}
          aria-expanded={metaOpen}
          aria-controls={META_BLOCK_ID}
          className={cn(h.targetSummary, metaOpen && h.targetSummaryOpen)}
        >
          <span className={h.targetSummaryFacts}>
            <span aria-hidden="true" className="flex flex-none items-center">
              <ProviderGlyph
                provider={identity.cloudProvider}
                isSdu={project.isSduType}
                tone="brand"
                className={h.summaryGlyph}
              />
            </span>
            <span className={cn(h.providerName, 'flex-none')}>
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
            {account && (
              <>
                <span className={h.divider} aria-hidden="true" />
                <span className={h.kvLabel}>{account.label}</span>
                <span className={h.summaryMono} title={account.value}>
                  {account.value}
                </span>
              </>
            )}
            <span className={h.codeChip}>
              <span className={h.codeChipLabel}>서비스 코드</span>
              <span className={h.codeChipValue}>{project.serviceCode}</span>
            </span>
          </span>
          <span className={h.metaCue}>
            설치 대상 정보
            <ChevronDownIcon
              className={cn(h.metaToggleIcon, metaOpen && h.metaToggleIconOpen)}
              aria-hidden="true"
            />
          </span>
        </button>

        {metaOpen && (
          <div id={META_BLOCK_ID} className={h.targetBody}>
            {description !== '' && (
              <div className={h.block}>
                <div className={h.blockLabel}>설명</div>
                <p className={h.descText}>{description}</p>
              </div>
            )}

            {cloudFacts.length > 0 && (
              <div className={h.block}>
                {/* The bar above already names the provider, so this group is the
                    record behind it, not a second statement of it: every identifier
                    with the copy affordance the bar cannot carry (nothing inside the
                    press may steal the click), plus how the install runs. The eyebrow
                    rides the kv label line, which keeps 클라우드 정보 level with
                    Account ID rather than floating above the row. */}
                <div className={h.groupRow}>
                  <span className={h.blockLabel}>{display.group}</span>
                  {cloudFacts.map((fact) => (
                    <Fragment key={fact.key}>
                      <span className={h.divider} aria-hidden="true" />
                      {fact}
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* #661 P5: the latest connection-test verdict rides its own step, not the
          page title. */}
      <InstallationProcessProgressBar
        currentStep={project.processStatus}
        tcTag={<TcHeaderTag targetSourceId={project.targetSourceId} />}
      />
    </header>
  );
};
