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
  /** Always the mark's accessible name; printed in ink only when `brandMark` is unset. */
  name: string;
  /**
   * The vendor's own logo already names the provider, so printing the name beside it
   * is the name twice (오너 8차 지시 — 「AWS Cloud」 came off for exactly that). AWS's
   * brand mark IS the wordmark; Azure's and Google Cloud's are the symbols everyone
   * reads as those clouds.
   */
  brandMark?: true;
  /** Plain-language gloss after a bare token (IDC → 사내망) for first-time readers. */
  gloss?: string;
}

// The mark itself comes from `ProviderGlyph`, the same source the ops dashboard
// identity cell draws from, so one provider looks the same across the product.
// No group eyebrow any more — the fold has no 클라우드 정보 group to label.
//
// `brandMark` tracks BRAND_BY_KEY in CloudProviderIcon: IDC and SDU are ours and have
// no brand, so their glyphs are generic outlines — a server rack and an upload arrow,
// which name nothing on their own. Those two keep their name in ink.
const PROVIDER_DISPLAY: Record<CloudProvider, ProviderDisplay> = {
  AWS: { name: 'AWS Cloud', brandMark: true },
  Azure: { name: 'Azure Cloud', brandMark: true },
  GCP: { name: 'Google Cloud', brandMark: true },
  IDC: { name: 'IDC', gloss: '사내망' },
};

const SDU_DISPLAY: ProviderDisplay = { name: 'SDU' };

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
 * Page header for the target-source detail. One label grammar throughout (12px
 * eyebrow above 14px content), grouping by distance instead of rules, and the
 * quiet install stepper as the single statement of step position.
 *
 * The header itself is still chrome — it paints no plane. Its one card is the
 * 설치 대상 summary, which earns the surface because it is the only object here
 * rather than furniture: it names the target and folds the whole meta block
 * behind it (오너 5차 지시). The step cards below stay distinct on radius (20 vs
 * 10) and on having no stroke at all.
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
  const autoInstall = identity.installMode === 'auto';

  return (
    <header className={cn(h.surface, h.inner)}>
      {/* One card holding both tiers of the target's identity: the path says WHICH
          target, the row under it says WHAT SCOPE the install runs in. They were
          already stacked 8px apart — the path floating bare on the wash, the scope
          in a strokes-only rectangle — so housing them costs 5px and is what makes
          this read as a summary instead of a toolbar (오너 5차 지시). */}
      <div className={h.targetGroup}>
        <div className={h.titleRow}>
          {/* 시안 C: the heading is the path. 「PII Agent 설치」 states the page's job at
              the weight of a location instead of a 24px title, and the service name
              gets the width it needs — clamped, because there is no contract maximum
              on it (swagger `service_name` has no maxLength). The last segment is the
              service code, the identifier the reader actually recognises. */}
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
            <span className={h.crumbHere}>{project.serviceCode}</span>
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {action}
            <button
              type="button"
              onClick={() => setMetaOpen((open) => !open)}
              aria-expanded={metaOpen}
              aria-controls={META_BLOCK_ID}
              className={h.metaCue}
            >
              설치 대상 정보
              <ChevronDownIcon
                className={cn(h.metaToggleIcon, metaOpen && h.metaToggleIconOpen)}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {/* The scope the install runs in: the provider as the subject, every
            identifier it owns listed against it — Azure's two on two rows (오너 6차
            지시). This is the whole cloud record now, which is what let the fold drop
            its 클라우드 정보 group: it was repeating these same values 60px lower for
            the sake of the copy buttons, and those live here instead. */}
        <div className={h.summaryRow}>
          <span className={cn(h.summaryFact, 'flex-none')}>
            {/* The glyph takes no accessible name of its own — ProviderGlyph has no
                aria prop to pass, so the name below carries the reading whether it is
                printed or not. */}
            <span aria-hidden="true" className="flex">
              <ProviderGlyph
                provider={identity.cloudProvider}
                isSdu={project.isSduType}
                tone="brand"
                className={h.summaryGlyph}
              />
            </span>
            {/* Hidden, not dropped: a logo announces nothing, so removing 「AWS Cloud」
                from the screen must not remove it from the accessible name too. */}
            <span className={display.brandMark ? 'sr-only' : h.providerName}>
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
          {(identifierRows.length > 0 || identity.installMode) && (
            <>
              <span className={h.divider} aria-hidden="true" />
              <div className={h.summaryIds}>
                {identifierRows.map((id) => (
                  <Fragment key={id.label}>
                    <span className={h.kvLabel}>{id.label}</span>
                    <span className={h.summaryValue} title={id.value}>
                      <span className={cn(h.summaryValueText, id.mono && h.summaryValueMono)}>
                        {id.value}
                      </span>
                      {id.mono && <CopyButton value={id.value} label={`${id.label} 복사`} />}
                    </span>
                  </Fragment>
                ))}
                {/* 자동/수동 is not reference material — it decides whether the reader
                    has anything to do on this screen (오너 7차 지시), so it belongs
                    where the scope is, not behind a fold. Last row: the identifiers
                    say WHAT this is, the mode says how it runs. */}
                {identity.installMode && (
                  <>
                    <span className={h.kvLabel}>설치 모드</span>
                    <span className={h.modeRow}>
                      <span className={autoInstall ? h.modeChipAuto : h.modeChipManual}>
                        {autoInstall ? '자동 설치' : '수동 설치'}
                      </span>
                      {/* What the mode MEANS stays on-screen — a hover tooltip would
                          hide information the user needs to know. */}
                      <span className={h.modeNote}>
                        {autoInstall ? 'Terraform 권한 위임' : '설치 스크립트 직접 실행'}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {metaOpen && (
          <div id={META_BLOCK_ID} className={h.targetBody}>
            {description !== '' && (
              <div className={h.block}>
                <div className={h.blockLabel}>설명</div>
                <p className={h.descText}>{description}</p>
              </div>
            )}

            {/* No 클라우드 정보 group any more (오너 6·7차 지시): the identifiers, their
                copy buttons and the install mode are all on the card, so the group
                had become a second printing of the same facts. What is left behind
                the fold is what the card cannot say on a line — the description, and
                SDU's one-sentence 연동 방식. */}
            {project.isSduType && (
              <div className={h.block}>
                <div className={h.blockLabel}>연동 방식</div>
                <p className={h.descText}>고객사가 데이터를 직접 업로드</p>
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
