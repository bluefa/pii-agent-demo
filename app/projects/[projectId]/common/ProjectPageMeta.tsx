import type { Project } from '@/lib/types';
import { Breadcrumb } from '@/app/components/ui/Breadcrumb';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { integrationRoutes } from '@/lib/routes';
import { ProjectIdentityCard } from './ProjectIdentityCard';
import type { ProjectIdentity } from './ProjectIdentityCard';

interface ProjectPageMetaProps {
  project: Project;
  providerLabel: string;
  identity: ProjectIdentity;
  action?: React.ReactNode;
}

const STATIC_HEAD_CRUMBS = [
  { label: 'SIT Home', href: '/' },
  { label: 'Service List', href: integrationRoutes.admin },
];

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
      <ProjectIdentityCard identity={identity} />
    </>
  );
};
