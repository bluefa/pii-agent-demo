import type { Project } from '@/lib/types';
import { Breadcrumb } from '@/app/components/ui/Breadcrumb';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { PageMeta } from '@/app/components/ui/PageMeta';
import { integrationRoutes } from '@/lib/routes';

interface ProjectPageMetaProps {
  project: Project;
  providerLabel: string;
  metaItems: Array<{ label: string; value: React.ReactNode }>;
  action?: React.ReactNode;
}

const STATIC_HEAD_CRUMBS = [
  { label: 'SIT Home', href: '/' },
  { label: 'Service List', href: integrationRoutes.admin },
];

export const ProjectPageMeta = ({ project, providerLabel, metaItems, action }: ProjectPageMetaProps) => {
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
        backHref={integrationRoutes.admin}
        action={action}
      />
      <PageMeta items={metaItems} />
    </>
  );
};
