import type { TargetSource } from '@/lib/types';
import { Breadcrumb } from '@/app/components/ui/Breadcrumb';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { PageMeta, type PageMetaItem } from '@/app/components/ui/PageMeta';
import { integrationRoutes } from '@/lib/routes';
import { cn, primaryColors } from '@/lib/theme';
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

const buildPageMetaItems = (identity: ProjectIdentity): PageMetaItem[] => {
  const items: PageMetaItem[] = [
    { label: 'Cloud Provider', value: identity.cloudProvider },
  ];

  for (const id of identity.identifiers) {
    items.push({
      label: id.label,
      value: id.value ?? '-',
      mono: id.mono,
      copyText: id.value ?? undefined,
    });
  }

  if (identity.jiraLink) {
    const jiraLink = identity.jiraLink;
    items.push({
      label: 'Jira Link',
      value: (
        <a
          href={jiraLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(primaryColors.text, 'hover:underline')}
        >
          {extractJiraLabel(jiraLink)}
        </a>
      ),
    });
  }

  items.push({ label: '모니터링 방식', value: identity.monitoringMethod });
  return items;
};

export const ProjectPageMeta = ({ project, providerLabel, identity, action }: ProjectPageMetaProps) => {
  const crumbs = [
    ...STATIC_HEAD_CRUMBS,
    { label: project.serviceCode, href: integrationRoutes.admin },
    { label: providerLabel },
  ];

  return (
    <>
      <Breadcrumb crumbs={crumbs} />
      <PageHeader
        title={`${project.name || project.projectCode} (${project.serviceCode})`}
        action={action}
      />
      <PageMeta items={buildPageMetaItems(identity)} />
    </>
  );
};
