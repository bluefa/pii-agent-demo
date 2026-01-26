import { ProjectDetail } from './ProjectDetail';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  return <ProjectDetail projectId={projectId} />;
}
