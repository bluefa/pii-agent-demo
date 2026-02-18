import { bff } from '@/lib/bff/client';
import { ProjectDetail } from '@/app/projects/[projectId]/ProjectDetail';
import { ErrorState } from '@/app/projects/[projectId]/common';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  const targetSourceId = Number(projectId);

  if (!Number.isInteger(targetSourceId) || targetSourceId <= 0) {
    return <ErrorState error="유효하지 않은 과제 식별자입니다." />;
  }

  const [project, currentUser, credentials] = await Promise.all([
    bff.targetSources.get(targetSourceId),
    bff.users.me(),
    bff.targetSources.secrets(targetSourceId),
  ]);

  return (
    <ProjectDetail
      initialProject={project}
      initialUser={currentUser}
      initialCredentials={credentials}
    />
  );
}
