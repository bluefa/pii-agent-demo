import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { schemas } from '@/lib/generated/install-v1';
import { extractTargetSourceFromSnake } from '@/lib/target-source-response';
import { ProjectDetail } from '@/app/target-sources/[targetSourceId]/_components/ProjectDetail';
import { ErrorState } from '@/app/target-sources/[targetSourceId]/_components/common';
import { targetSourceLoadMessage } from '@/app/target-sources/[targetSourceId]/load-error';
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
    // v5 — 열 주소는 browseUrl 이 싣는다 (loose schema: 없으면 null 로 흡수).
    return raw.issueKey ? { issueKey: raw.issueKey, browseUrl: raw.browseUrl ?? null } : null;
  } catch (err) {
    return err instanceof BffError && err.status === 404 ? null : 'error';
  }
};

export default async function ProjectDetailPage({ params }: PageProps) {
  const targetSourceId = Number((await params).targetSourceId);

  if (!Number.isInteger(targetSourceId) || targetSourceId <= 0) {
    return <ErrorState message="주소의 연동 대상 번호가 올바르지 않아요." />;
  }

  // Caught HERE, not in error.tsx. This is the last place the failure still has a
  // status: a Server Component throw reaches the boundary with its message stripped
  // in production builds, so error.tsx cannot tell 404 from 500 and could only ever
  // show the fallback — while rendering Next's own English notice as the copy.
  let project;
  let jiraTicket;
  try {
    const [data, status, ticket] = await Promise.all([
      bff.targetSources.get(targetSourceId),
      bff.confirm.getProcessStatus(targetSourceId),
      fetchJiraTicket(targetSourceId),
    ]);
    project = extractTargetSourceFromSnake(data, status.process_status);
    jiraTicket = ticket;
  } catch (err) {
    // 진단은 서버 로그로. 사용자에게는 상태 코드로 고른 문구만 간다.
    console.error(`[target-sources/${targetSourceId}] 상세 조회 실패`, err);
    return <ErrorState message={targetSourceLoadMessage(err)} />;
  }

  return <ProjectDetail initialProject={project} jiraTicket={jiraTicket} />;
}
