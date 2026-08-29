'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProcessStatus, type CloudProvider, type TargetSource } from '@/lib/types';
import { passRoutes } from '@/lib/routes';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { ChevronDownIcon, CopyIcon, InfoCircleIcon, StatusSuccessIcon } from '@/app/components/ui/icons';
import { InstallationProcessProgressBar } from '@/app/components/features/process-status';
import { installRoadPosition } from '@/app/components/features/process-status/install-road';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { TIMINGS } from '@/lib/constants/timings';
import {
  cn,
  identityBarStyles,
  installStepperStyles as s,
  projectHeaderStyles as h,
} from '@/lib/theme';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';
import { TcHeaderTag } from '@/app/target-sources/[targetSourceId]/_components/common/TcHeaderTag';
import type { TcScope } from '@/app/lib/api/tc-scope';

/**
 * Which connection-test run the header tag reports. Steps 6·7 stand on a run that passed, so
 * they keep reporting that run even after a later one fails; every other step — Step 5 above
 * all, where fixing the failure is the user's job — reports the raw latest.
 */
const tcScopeFor = (status: TargetSource['processStatus']): TcScope =>
  status === ProcessStatus.CONNECTION_VERIFIED || status === ProcessStatus.INSTALLATION_COMPLETE
    ? 'latestSuccess'
    : 'latest';

/** Ties the disclosure button to the body it opens (`aria-controls`). */
const META_BLOCK_ID = 'target-source-meta';
/** Names the 설치 대상 region (`aria-labelledby`) — the card never had a name. */
const TARGET_LABEL_ID = 'target-source-scope-label';
/**
 * The 연결 테스트 verdict is the second thing that press reveals, and it lives up on the
 * head row — outside the drawer body and BEFORE it in the DOM. `aria-controls` takes an
 * ID list, so both go in it; a reader who expands is otherwise pointed at the body alone
 * and the freshest fact on the header arrives with no tie to the control that produced it.
 */
const VERDICT_SLOT_ID = 'target-source-meta-verdict';

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
  /**
   * What the drawer's description is a description OF. The field name follows the
   * provider because the thing being described does: a CSP account, a GCP project, or —
   * for IDC and SDU, which own no cloud account — the target itself.
   */
  descLabel: string;
}

// The mark itself comes from `ProviderGlyph`, the same source the ops dashboard
// identity cell draws from, so one provider looks the same across the product. It rides
// the 설치 대상 head row now (오너 2026-08-28), the slot `OpsHeader` gives its own glyph.
//
// `brandMark` tracks BRAND_BY_KEY in CloudProviderIcon: IDC and SDU are ours and have
// no brand, so their glyphs are generic outlines — a server rack and an upload arrow,
// which name nothing on their own. Those two keep their name in ink.
const PROVIDER_DISPLAY: Record<CloudProvider, ProviderDisplay> = {
  AWS: { name: 'AWS Cloud', brandMark: true, descLabel: '계정 설명' },
  Azure: { name: 'Azure Cloud', brandMark: true, descLabel: '계정 설명' },
  GCP: { name: 'Google Cloud', brandMark: true, descLabel: '프로젝트 설명' },
  IDC: { name: 'IDC', gloss: '사내망', descLabel: '대상 설명' },
};

const SDU_DISPLAY: ProviderDisplay = { name: 'SDU', descLabel: '대상 설명' };

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
 * Page header for the target-source detail: a path, ONE named block, ONE cue, and no
 * rules at all (확정형 — 경로 A + 합안 ㄱ + 시안 1 + AWS 격자, 오너 2026-08-28,
 * `docs/ux/benchmark/ts-header-aws-grid.md`).
 *
 * Five things changed; the first four only work together:
 *
 * 1. **The second block is gone.** 설치 진행 was a name, a hairline and ~70px spent
 *    stating one tag. The tag moved onto this block's head row — the slot `OpsHeader`
 *    gives `StepPill` on the same target — and its road moved behind this block's drawer.
 * 2. **The second cue is gone.** Two disclosures 32px apart made the reader choose
 *    between two promises before knowing what either held. One cue, one body, in reading
 *    order: the description first (what this target IS), the road second (where it goes).
 * 3. **Every rule is gone.** Two hairlines and a vertical divider, on a header that
 *    paints no plane of its own. The horizontal one measured 1.16:1 on the lavender
 *    canvas — too faint to group anything. Grouping is what the 16px name and the 22px
 *    gap under it do now, exactly as `opsStyles.fmHead` does after the same instruction.
 * 4. **The path's painted tags are gone.** 「서비스」 and 「서비스 코드」 were the header's
 *    last two fills. The code is the identifier segment, so it says so in mono
 *    (`opsStyles.pathLinkId`'s value) instead of in a box.
 *    ⛔ No `Target Source #{id}` segment — the id is a database key (오너 지시).
 * 5. **The path navigates** (오너 2026-08-29, reversing what 4 originally said — that
 *    nothing here links). The service segment had to take the reader to their own
 *    service, so the line is a real breadcrumb: `<nav aria-label="경로">`, two links, and
 *    `aria-current="page"` on the code. The links stay out of blue for the same reason
 *    the cue did — see `projectHeaderStyles.crumbLink`.
 *
 * The facts became a kv grid, label above value, because the old `provider | label·value`
 * row could only state what ONE provider owned before it ran out of width — AWS owns four
 * facts, and three of them had nowhere to go.
 */
export const ProjectPageMeta = ({ project, identity, action }: ProjectPageMetaProps) => {
  // Open at step 1, closed after (오너 2026-08-28). 연동 대상 DB 선택 IS the first-time
  // reader's state: they have not seen the road and have not been told what the target
  // is. From step 2 on they have, and the drawer is reference they can call back.
  // Deliberately not persisted — re-opening the page at step 1 re-opens it, which is
  // accepted: a cookie would make the header's shape depend on history the reader
  // cannot see.
  const [metaOpen, setMetaOpen] = useState(
    project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION,
  );
  // SDU wins over the underlying CSP (metadata.is_sdu_type, owner call) — the
  // account has no CSP identifiers, so fact cells drop out on their own.
  const display = project.isSduType ? SDU_DISPLAY : PROVIDER_DISPLAY[identity.cloudProvider];

  // The normalizer falls serviceName back to the code, so the line is never empty.
  const serviceTitle = project.serviceName || project.serviceCode;
  const description = project.description.trim();

  const roadVariant = project.isSduType ? 'sdu' : undefined;
  const road = installRoadPosition(project.processStatus, roadVariant);
  const roadDone = road.index === road.total - 1;

  // A cell drops only when it has neither a value nor something to say in its place:
  // IDC·SDU own no CSP account, and an empty slot is the truthful rendering (결정 #49).
  // A fact positively known to be absent — 미등록, 역할 불필요 — keeps its cell and says so.
  const facts = identity.identifiers.filter(
    (id) => (id.value ?? '').trim() !== '' || !!id.emptyText,
  );
  const autoInstall = identity.installMode === 'auto';

  return (
    <header className={cn(h.surface, h.inner)}>
      {/* Page chrome: the job, and which service it is being done for. WHAT it is
          being installed into is the named block below, not part of this line. */}
      <div className={h.titleRow}>
        {/* The heading is the path, and the path now NAVIGATES (오너 2026-08-29). 「PII
            Agent 설치」 states the page's job at the weight of a location instead of a
            24px title, and the service name gets the width it needs — clamped, because
            there is no contract maximum on it (swagger `service_name` declares no
            maxLength). Three segments, `/` separators, one identifier among them.

            The landmark comes with the links: a heading shaped like a path needed none,
            a breadcrumb does. ⛔ Do not ship the links without it — that is the gap this
            screen's ops sibling still has, and we are not copying it.

            No `<ol>`: the list markup a breadcrumb usually wants cannot hold this `<h1>`
            (a heading may not live inside a list item without splitting the page's only
            h1, and an `<ol>` may not live inside the heading at all). The landmark plus
            `aria-current` is what a reader actually needs here. */}
        <nav aria-label="경로" className="min-w-0">
          <h1 className={h.crumb}>
            <Link href={passRoutes.services} className={cn(h.crumbRoot, h.crumbLink)}>
              PII Agent 설치
            </Link>
            <span className={h.crumbSep} aria-hidden="true">
              /
            </span>
            {/* The reader's own service. `passRoutes.service` owns the shape of this
                deep link — `/services` is URL-driven, so `?service_code=` IS the
                service's address, and the two places that already push it use the same
                helper. */}
            <Link
              href={passRoutes.service(project.serviceCode)}
              className={cn(h.crumbName, h.crumbLink)}
              title={serviceTitle}
            >
              {serviceTitle}
            </Link>
            <span className={h.crumbSep} aria-hidden="true">
              /
            </span>
            {/* ⛔ Not a link. It names where the reader already is, and the segment
                before it goes to that same service — two adjacent links to one
                destination is one link too many. `aria-current` says "here" instead. */}
            <span className={h.crumbCode} aria-current="page">
              {project.serviceCode}
            </span>
          </h1>
        </nav>
        {action}
      </div>

      {/* 설치 대상 — the header's one named region. The card it replaced grouped these
          facts visually and named them nowhere, so nothing but position said what they
          were; the block that used to stand beside it is dissolved into this head row. */}
      <section aria-labelledby={TARGET_LABEL_ID} className={h.targetGroup}>
        <div className={h.blockHead}>
          <span className={h.blockName}>
            {/* The glyph takes no accessible name of its own — ProviderGlyph has no
                aria prop to pass, so the name beside it carries the reading whether it
                is printed or not. */}
            <span aria-hidden="true" className="flex">
              <ProviderGlyph
                provider={identity.cloudProvider}
                isSdu={project.isSduType}
                tone="brand"
                className={h.summaryGlyph}
              />
            </span>
            {/* Hidden, not dropped: a logo announces nothing, so removing 「AWS Cloud」
                from the screen must not remove it from the accessible name too. IDC and
                SDU have no brand mark, so they keep their name in ink. */}
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
            <span id={TARGET_LABEL_ID} className={h.blockLabel}>
              설치 대상
            </span>
            {/* Position, on the block's own head row (오너 2026-08-28). It answers 「어디」
                and stops: the step's NAME belongs to the card head below, which prints it
                at 20px beside its own 「N단계」 tag, and carrying it here too put one
                string on the screen three times over.
                An unknown status prints nothing rather than 「0단계」 — ProcessStatus is
                exactly seven values but it arrives over the wire. */}
            {road.index >= 0 &&
              (roadDone ? (
                /* 「7단계 중 7단계 완료」 said the same thing three times (오너 18차 지시).
                   At the end there is no position left to report, only the sequence now
                   behind the reader — 모두 carries that, and the total stays because it
                   is what got completed. */
                <span className={s.stepTag}>
                  <span>
                    <b className={s.tagCount}>{road.total}</b>단계 모두 완료
                  </span>
                </span>
              ) : (
                <span className={s.stepTag}>
                  {/* One span, so both 14px digits baseline-align inside the phrase rather
                      than becoming flex items that have to be aligned against it. */}
                  <span>
                    <b className={s.tagCount}>{road.total}</b>단계 중{' '}
                    <b className={s.tagCount}>{road.index + 1}</b>단계
                  </span>
                </span>
              ))}
            {/* Two gates on the verdict, neither widened nor narrowed by this round.
                1. The target has REACHED 연결 테스트. A verdict surviving on a target at
                   step 1–4 belongs to a previous cycle — the agent is not installed yet,
                   so nothing can have tested this configuration.
                2. The drawer is open (오너 14차 지시 후속). The verdict is detail about
                   one step, so it belongs to the same press that names the steps.
                Neither gate merely hides the tag: `TcHeaderTag` fetches latest_version on
                mount, so not rendering it is also not asking.

                SDU passes no verdict at all. Not because the test does not happen — it
                does, in the Admin console — but because it is not this reader's step:
                their road has no 연결 테스트 slot, and a verdict about work they can
                neither see nor repeat is noise. */}
            {metaOpen && road.reachedConnectionTest && !project.isSduType && (
              <span id={VERDICT_SLOT_ID} className={s.tagSlot}>
                <TcHeaderTag
                  targetSourceId={project.targetSourceId}
                  scope={tcScopeFor(project.processStatus)}
                />
              </span>
            )}
          </span>
          {/* The header's one cue. Not gated any more: the road always exists, so the
              body is never empty and the old `hasFold` check could only ever be true.
              ⛔ Not blue (오너 2026-08-28) — it opens read-once reference, and blue in this
              palette also reads as 「you must look at this」. Hover and the chevron say it
              is pressable; see `projectHeaderStyles.metaCue` for the measured ratios. */}
          <button
            type="button"
            onClick={() => setMetaOpen((open) => !open)}
            aria-expanded={metaOpen}
            aria-controls={`${META_BLOCK_ID} ${VERDICT_SLOT_ID}`}
            className={h.metaCue}
          >
            상세 정보
            <ChevronDownIcon
              className={cn(h.metaToggleIcon, metaOpen && h.metaToggleIconOpen)}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* The facts, one cell each: 계정 · 스캔 역할 · 테라폼 역할 · 설치 모드 on AWS.
            The CSP gets no cell — the brand mark on the head row is its statement
            (오너 8차 지시: the logo already is the name).

            Read-only, all of it. On the ops screen these same values are buttons opening
            an edit modal; here the service owner may copy them and nothing else, so
            ⛔ no blue, no underline, no CTA. */}
        <div className={h.factGrid}>
          {facts.map((fact) => (
            <div key={fact.label} className={cn(h.factCell, fact.wide && h.factCellWide)}>
              <span className={h.kvLabel}>{fact.label}</span>
              {fact.value ? (
                /* `display` is what is PRINTED, `value` is what gets copied and what the
                   title spells out — a role reads as its role name in a 240px cell while
                   the full ARN stays one hover or one copy away. */
                <span className={h.summaryValue} title={fact.value}>
                  <span className={cn(h.summaryValueText, fact.mono && h.summaryValueMono)}>
                    {fact.display ?? fact.value}
                  </span>
                  {fact.mono && <CopyButton value={fact.value} label={`${fact.label} 복사`} />}
                </span>
              ) : (
                <span className={h.factNone} title={fact.emptyHint}>
                  {fact.emptyText}
                </span>
              )}
            </div>
          ))}
          {/* 자동/수동 is not reference material — it decides whether the reader has
              anything to do on this screen (오너 7차 지시), so it stays on the face. Last
              cell: the identifiers say WHAT this is, the mode says how it runs. */}
          {identity.installMode && (
            <div className={h.factCell}>
              <span className={h.kvLabel}>설치 모드</span>
              <span className={h.modeRow}>
                <span className={autoInstall ? h.modeChipAuto : h.modeChipManual}>
                  {autoInstall ? '자동 설치' : '수동 설치'}
                  {/* The gloss that used to sit beside the chip (「Terraform 권한 위임」/
                      「설치 스크립트 직접 실행」) is behind this icon (오너 17차 지시) — four
                      words never said what the mode MEANT, and a tip has room for the
                      sentence that does. One sentence, and it is the one the reader is
                      standing in: what the mode costs them AT THE INSTALL STEP
                      (오너 18차 지시).
                      `openOn="click"` is the pin, not the only way in: hover and keyboard
                      focus reveal it, and a press keeps it up for a reader whose pointer
                      drifts off the 14px target. */}
                  <Tooltip
                    openOn="click"
                    variant="value"
                    position="bottom"
                    content={
                      <span className={h.modeTipBody}>
                        {autoInstall
                          ? '설치 단계에서 BDC 측에 Terraform 수행 권한을 위임해요.'
                          : '설치 단계에서 제공되는 설치 스크립트를 받아 직접 실행해야 해요.'}
                      </span>
                    }
                  >
                    <button
                      type="button"
                      className={h.modeTipButton}
                      aria-label={`${autoInstall ? '자동 설치' : '수동 설치'} 설명`}
                    >
                      <InfoCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </span>
              </span>
            </div>
          )}
        </div>

        {metaOpen && (
          <div id={META_BLOCK_ID} className={h.targetBody}>
            {/* Description first, road second (오너 2026-08-28): what this target IS
                before where it is going. The label is a FIELD name, not a block name —
                `kvLabel`, the tier the grid's own labels wear — because it names one
                paragraph, and the drawer titles nothing else. */}
            {description !== '' && (
              <div className={h.block}>
                <div className={h.kvLabel}>{display.descLabel}</div>
                <p className={h.descText}>{description}</p>
              </div>
            )}

            <InstallationProcessProgressBar
              currentStep={project.processStatus}
              variant={roadVariant}
            />

            {/* SDU's one-sentence 연동 방식 — the other thing a line cannot say. No 클라우드
                정보 group any more (오너 6·7차 지시): the facts, their copy buttons and the
                install mode are all in the grid above. */}
            {project.isSduType && (
              <div className={h.block}>
                <div className={h.kvLabel}>연동 방식</div>
                <p className={h.descText}>고객사가 데이터를 직접 업로드</p>
              </div>
            )}
          </div>
        )}
      </section>
    </header>
  );
};
