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
  const accent = providerAccent[String(identity.cloudProvider).toLowerCase()] ?? providerAccentDefault;

  return (
    <>
      <Breadcrumb crumbs={crumbs} />
      <PageHeader
        title={`${project.name || project.projectCode} (${project.serviceCode})`}
        action={action}
      />
      <IdentityBar
        accent={accent}
        providerName={providerLabel}
        providerSub="Cloud Provider"
        icon={PROVIDER_ICON}
        fields={buildIdentityFields(identity)}
        agentLabel={identity.monitoringMethod}
      />
    </>
  );
};
