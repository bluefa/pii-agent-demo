import type { TargetSource } from '@/lib/types';
import { Breadcrumb } from '@/app/components/ui/Breadcrumb';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { IdentityBar, type IdentityBarField } from '@/app/components/ui/IdentityBar';
import { integrationRoutes } from '@/lib/routes';
import { cn, primaryColors, providerAccent, providerAccentDefault } from '@/lib/theme';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common/project-identity';

interface ProjectPageMetaProps {
  project: TargetSource;
  providerLabel: string;
  identity: ProjectIdentity;
  action?: React.ReactNode;
}

const STATIC_HEAD_CRUMBS = [
  { label: 'SIT Home', href: '/' },
  { label: 'Service List', href: integrationRoutes.admin },
];

const JIRA_KEY_PATTERN = /\/browse\/([A-Z][A-Z0-9]+-\d+)/;

const extractJiraLabel = (url: string): string => {
  const match = url.match(JIRA_KEY_PATTERN);
  return match ? match[1] : 'Jira';
};

/** v16 sample collab-channel ticket key, used when the project has no real Jira link yet. */
const COLLAB_CHANNEL_FALLBACK = 'BDCDIP-1353';

/**
 * v16 page-header `.actions` collab chip (HTML 5745–5750, `.btn.collab-chip`):
 * a pill linking to the project's Jira discussion. Shared chrome — rendered
 * before the page action across every provider. Tokens map to the v16 vars
 * (inner-bg fill #F7F8FA, hover #ECEEF1, weak-text key #8B95A1, medium-text icon #4E5968).
 */
const CollabChannelChip = ({ jiraLink }: { jiraLink?: string | null }) => {
  const value = jiraLink ? extractJiraLabel(jiraLink) : COLLAB_CHANNEL_FALLBACK;

  return (
    <a
      href={jiraLink ?? '#'}
      target={jiraLink ? '_blank' : undefined}
      rel={jiraLink ? 'noopener noreferrer' : undefined}
      title="협업 채널 — Jira에서 논의하기"
      className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#F7F8FA] px-3.5 text-[13px] font-semibold tracking-[-0.005em] text-[#191F28] no-underline transition-colors hover:bg-[#ECEEF1]"
    >
      <svg
        className="shrink-0 text-[#4E5968]"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="text-[12px] font-semibold tracking-normal text-[#8B95A1]">협업 채널</span>
      <span className="font-mono text-[12.5px] font-semibold">{value}</span>
      <svg
        className="shrink-0 opacity-50"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 17L17 7" />
        <polyline points="9 7 17 7 17 15" />
      </svg>
    </a>
  );
};

const PROVIDER_ICON = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 18a4 4 0 0 1-.5-7.97 5.5 5.5 0 0 1 10.62-1.46A4.5 4.5 0 0 1 17.5 18H7Z" />
  </svg>
);

const buildIdentityFields = (identity: ProjectIdentity): IdentityBarField[] => {
  const fields: IdentityBarField[] = identity.identifiers.map((id) => ({
    label: id.label,
    value: id.value ?? '-',
    mono: id.mono,
    copyText: id.value ?? undefined,
  }));

  if (identity.jiraLink) {
    const jiraLink = identity.jiraLink;
    fields.push({
      label: 'Jira',
      value: (
        <a
          href={jiraLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(primaryColors.text, 'font-semibold hover:underline')}
        >
          {extractJiraLabel(jiraLink)}
        </a>
      ),
    });
  }

  return fields;
};

export const ProjectPageMeta = ({ project, providerLabel, identity, action }: ProjectPageMetaProps) => {
  const crumbs = [
    ...STATIC_HEAD_CRUMBS,
    { label: project.serviceCode, href: integrationRoutes.admin },
    { label: providerLabel },
  ];
  const provider = String(identity.cloudProvider).toLowerCase();
  const accent = providerAccent[provider] ?? providerAccentDefault;
  // v16 hides the "Cloud Provider" sub-line for IDC — it has no cloud account (HTML 9439).
  const isIdc = provider === 'idc';

  // v16 `.page-title` = stable NAME + a gray, weight-500 code in parens (e.g. "Big Data Platform (999)").
  // Strip the step-specific " - {step}" suffix so the title stays stable across steps, and render the
  // projectCode (e.g. "IDC-025") as a gray span rather than baking it into a flat string.
  const stableName = (project.name || project.projectCode).split(' - ')[0];

  return (
    <>
      <Breadcrumb crumbs={crumbs} />
      <PageHeader
        title={
          <>
            {stableName}{' '}
            <span className="font-medium text-[#8B95A1]">({project.projectCode})</span>
          </>
        }
        action={
          <>
            <CollabChannelChip jiraLink={identity.jiraLink} />
            {action}
          </>
        }
      />
      <IdentityBar
        accent={accent}
        // v16 identity bar shows the BARE provider token ('GCP'/'Azure'/'AWS'/'IDC',
        // HTML 9426-9429), not the '{Provider} Infrastructure' string used for the
        // breadcrumb crumb above. `cloudProvider` already carries v16's exact casing.
        providerName={identity.cloudProvider}
        providerSub={isIdc ? undefined : 'Cloud Provider'}
        icon={PROVIDER_ICON}
        fields={buildIdentityFields(identity)}
        agentLabel={identity.monitoringMethod}
      />
    </>
  );
};
