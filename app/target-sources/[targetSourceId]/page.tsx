import { bff } from '@/lib/bff/client';
import { extractTargetSourceFromSnake } from '@/lib/target-source-response';
import { ProjectDetail } from '@/app/target-sources/[targetSourceId]/_components/ProjectDetail';
import { ErrorState } from '@/app/target-sources/[targetSourceId]/_components/common';

interface PageProps {
  params: Promise<{ targetSourceId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const targetSourceId = Number((await params).targetSourceId);

  if (!Number.isInteger(targetSourceId) || targetSourceId <= 0) {
    return <ErrorState error="유효하지 않은 과제 식별자입니다." />;
  }

  const [data, status] = await Promise.all([
    bff.targetSources.get(targetSourceId),
    bff.confirm.getProcessStatus(targetSourceId),
  ]);
  const project = extractTargetSourceFromSnake(data, status.process_status);

  return <ProjectDetail initialProject={project} />;
}
