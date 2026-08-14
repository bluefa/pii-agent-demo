import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { schemas } from '@/lib/generated/install-v1';
import { extractTargetSourceFromSnake } from '@/lib/target-source-response';
import { ProjectDetail } from '@/app/target-sources/[targetSourceId]/_components/ProjectDetail';
import { AccessDeniedState, ErrorState } from '@/app/target-sources/[targetSourceId]/_components/common';
import { classifyTargetSourceLoad } from '@/app/target-sources/[targetSourceId]/load-error';
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
    const failure = classifyTargetSourceLoad(err);
    if (failure.unexpected) {
      console.error(`[target-sources/${targetSourceId}] 상세 조회 실패`, err);
    } else {
      // 한 줄만, 에러 객체는 빼고. Next dev 오버레이는 서버 console.error 를 빨간 카드로
      // 띄우므로, 정상 처리한 404 를 거기 올리면 개발자에게는 터진 화면으로 보인다.
      const status = err instanceof BffError ? err.status : '?';
      console.warn(`[target-sources/${targetSourceId}] 상세 조회 ${status} — 안내 화면으로 대체`);
    }
    // 권한 없음은 오류 화면이 아니라 요청으로 이어지는 화면을 받는다.
    return failure.kind === 'forbidden' ? <AccessDeniedState /> : <ErrorState message={failure.message} />;
  }

  return <ProjectDetail initialProject={project} jiraTicket={jiraTicket} />;
}
