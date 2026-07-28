import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { schemas } from '@/lib/generated/install-v1';
import { extractTargetSourceFromSnake } from '@/lib/target-source-response';
import { ProjectDetail } from '@/app/target-sources/[targetSourceId]/_components/ProjectDetail';
import { ErrorState } from '@/app/target-sources/[targetSourceId]/_components/common';
import type { JiraTicketState } from '@/app/target-sources/[targetSourceId]/_components/common/GuidePanel';

interface PageProps {
  params: Promise<{ targetSourceId: string }>;
}

// Collab-channel ticket rides the same server fetch as the project. A ticket
// failure must never take the page down: 404 = no ticket mapped → null,
// anything else → 'error' so the rail card shows its outage row, not 미연결.
const fetchJiraTicket = async (targetSourceId: number): Promise<JiraTicketState> => {
  try {
    const raw = schemas.JiraTicketResponse.parse(
      await bff.targetSources.getJiraTicket(targetSourceId),
    );
    return raw.issueKey ? { issueKey: raw.issueKey } : null;
  } catch (err) {
    return err instanceof BffError && err.status === 404 ? null : 'error';
  }
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const targetSourceId = Number((await params).targetSourceId);

  if (!Number.isInteger(targetSourceId) || targetSourceId <= 0) {
    return <ErrorState error="유효하지 않은 과제 식별자입니다." />;
  }

  const [data, status, jiraTicket] = await Promise.all([
    bff.targetSources.get(targetSourceId),
    bff.confirm.getProcessStatus(targetSourceId),
    fetchJiraTicket(targetSourceId),
  ]);
  const project = extractTargetSourceFromSnake(data, status.process_status);

  return <ProjectDetail initialProject={project} jiraTicket={jiraTicket} />;
}
