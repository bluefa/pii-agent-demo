import { bff } from '@/lib/bff/client';
import { extractTargetSource } from '@/lib/target-source-response';
import { ProjectDetail } from '@/app/integration/target-sources/[targetSourceId]/_components/ProjectDetail';
import { ErrorState } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

interface PageProps {
  params: Promise<{ targetSourceId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const targetSourceId = Number((await params).targetSourceId);

  if (!Number.isInteger(targetSourceId) || targetSourceId <= 0) {
    return <ErrorState error="유효하지 않은 과제 식별자입니다." />;
  }

  const data = await bff.targetSources.get(targetSourceId);
  const project = extractTargetSource(data);

  return <ProjectDetail initialProject={project} />;
}
