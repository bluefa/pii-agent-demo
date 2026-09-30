/**
 * Jira Ticket 콘솔 버킷 정의 — 서버(페이지)와 클라이언트(타일·표) 양쪽이 읽는다.
 *
 * 운영 알림의 `buckets.ts` 와 같은 자리다. 버킷 판정은 서버(BFF)의 것이고, 여기 있는 것은
 * 두 목록을 화면에서 부르는 이름뿐이다. 둘 다 관리자가 움직인다 — 티켓은 관리자가 직접
 * 만들어 연결하고, watcher 는 관리자가 Jira 에서 직접 추가한다.
 */
import type { DashboardSummary, JiraAlertKind } from '@/lib/types/task-queue';
import type { IconName } from '@/app/admin/pipelines/_components/icons';

/** 'jira' = the Jira brand mark (brandMarks.JiraLogo); the rest are shared glyphs. */
export type JiraBucketIcon = IconName | 'jira';

export type JiraCounts = Pick<DashboardSummary, 'jiraTicketFailedCount' | 'jiraWatcherFailedCount'>;

export interface JiraBucketMeta {
  kind: JiraAlertKind;
  label: string;
  /** 필요한 작업 — 타일 캡션이 이것만 말한다. */
  need: string;
  owner: string;
  icon: JiraBucketIcon;
  count: (counts: JiraCounts) => number;
}

export const JIRA_BUCKETS: readonly JiraBucketMeta[] = [
  {
    kind: 'jira-ticket-failed',
    label: '티켓 생성 실패',
    need: '티켓을 직접 만들고 협업 채널에 연결',
    owner: '관리자',
    icon: 'jira',
    count: (s) => s.jiraTicketFailedCount,
  },
  {
    kind: 'jira-watcher-failed',
    label: 'Watcher 등록 실패',
    need: 'Jira 티켓에 watcher 직접 추가',
    owner: '관리자',
    icon: 'user-plus',
    count: (s) => s.jiraWatcherFailedCount,
  },
];

export const EMPTY_JIRA_COUNTS: JiraCounts = {
  jiraTicketFailedCount: 0,
  jiraWatcherFailedCount: 0,
};

/** 기본 버킷 — 건수가 있는 첫 버킷, 없으면 첫 버킷 (운영 알림과 같은 판정). */
export const defaultJiraKind = (counts: JiraCounts): JiraAlertKind =>
  JIRA_BUCKETS.find((bucket) => bucket.count(counts) > 0)?.kind ?? JIRA_BUCKETS[0].kind;

export const jiraBucket = (kind: JiraAlertKind): JiraBucketMeta =>
  JIRA_BUCKETS.find((bucket) => bucket.kind === kind) ?? JIRA_BUCKETS[0];
