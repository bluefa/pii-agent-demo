/**
 * CSR helpers for the Target Source ops page.
 *
 * Backed by ASSUMED contracts (docs/api/ops-assumed-contracts.md) — the Next
 * routes exist, the upstream BFF endpoints do not yet. Wire shapes are snake
 * verbatim (no camel reshape needed by the consumers).
 */
import { fetchInfraJson } from '@/app/lib/api/infra';
import type { BffProcessStatus } from '@/app/lib/api';

export interface StatusHistoryItem {
  changed_at: string;
  from_status: BffProcessStatus | null;
  to_status: BffProcessStatus;
  actor: string;
}

export interface StatusHistoryPage {
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  content: StatusHistoryItem[];
}

export interface CollaborationChannel {
  issue_key: string;
  url: string;
}

export const getStatusHistory = (
  targetSourceId: number,
  page = 0,
  size = 10,
): Promise<StatusHistoryPage> =>
  fetchInfraJson<StatusHistoryPage>(
    `/target-sources/${targetSourceId}/status-history?page=${page}&size=${size}`,
  );

export const updateInstallationMode = (
  targetSourceId: number,
  grant: boolean,
): Promise<{ target_source_id: number; grant_service_terraform_execution_permission: boolean }> =>
  fetchInfraJson(`/target-sources/${targetSourceId}/installation-mode`, {
    method: 'PUT',
    body: { grant_service_terraform_execution_permission: grant },
  });

export const updateAwsRole = (
  targetSourceId: number,
  kind: 'scan' | 'execution',
  roleName: string,
): Promise<{ role_arn: string }> =>
  fetchInfraJson(`/aws/target-sources/${targetSourceId}/${kind === 'scan' ? 'scan-role' : 'execution-role'}`, {
    method: 'PUT',
    body: { role_name: roleName },
  });

export const getCollaborationChannel = (
  targetSourceId: number,
): Promise<CollaborationChannel | null> =>
  fetchInfraJson<CollaborationChannel | null>(
    `/target-sources/${targetSourceId}/collaboration-channel`,
  );

export const saveCollaborationChannel = (
  targetSourceId: number,
  channel: CollaborationChannel,
): Promise<CollaborationChannel> =>
  fetchInfraJson(`/target-sources/${targetSourceId}/collaboration-channel`, {
    method: 'PUT',
    body: channel,
  });

/* ── 운영 콘솔 목록 (assumed §5) / 서비스 상세 (실계약 조합) ── */

/** CSP 계정 식별자 — provider 마다 채워지는 필드가 다르고, IDC·SDU 는 전부 null. */
export interface OpsTargetSourceAccount {
  aws_account_id: string | null;
  aws_region_type: 'global' | 'china' | null;
  subscription_id: string | null;
  /**
   * Azure 만 갖는 두 번째 식별자 — 그 구독이 어느 디렉터리에 속하는지.
   * 계약(TargetSourceMetadata.tenant_id)에 선언돼 있는데 라우트가 추리면서 버리고
   * 있었다. /pass/services 의 Azure 행은 이미 표시한다.
   */
  tenant_id: string | null;
  gcp_project_id: string | null;
  /**
   * 계약 필드를 그대로 나른다 (TargetSourceMetadata.is_china_region).
   *
   * `aws_region_type` 에서 읽지 않는 이유: 그 값은 라우트가 `aws_account_id` 가 있을
   * 때만 파생시키는데, SDU 대상은 계정 식별자 없이 오면서도 중국일 수 있다. 파생값을
   * 거치면 그런 행에서 중국이라는 사실이 조용히 사라진다.
   */
  is_china_region: boolean;
}

export interface OpsTargetSourceListItem {
  target_source_id: number;
  service_code: string;
  service_name: string;
  /** TargetSourceInfo.description — 대상이 무엇인지 오너가 적은 한 줄. */
  description: string | null;
  cloud_provider: string;
  is_sdu_type: boolean;
  database_type: string | null;
  process_status: BffProcessStatus;
  last_changed_at: string;
  metadata: OpsTargetSourceAccount;
}

export interface OpsTargetSourceListPage {
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  content: OpsTargetSourceListItem[];
}

/**
 * 서비스 운영 상세의 대상 행. 위 `OpsTargetSourceListItem`(Target Source 운영,
 * assumed §5)과 일부러 분리했다 — 그쪽은 단계(process_status)를 계속 그리지만
 * 이 화면은 단계를 보여주지 않으므로, 한 타입을 공유하면 쓰지도 않는 필드를
 * 채우려고 `/process-statuses` 를 다시 불러야 한다.
 */
export interface OpsServiceTargetRow {
  target_source_id: number;
  /** TargetSourceInfo.description — 대상이 무엇인지 오너가 적은 한 줄. */
  description: string | null;
  cloud_provider: string;
  is_sdu_type: boolean;
  /** 정렬 키 (updatedAt ?? createdAt). */
  last_changed_at: string;
  metadata: OpsTargetSourceAccount;
}

/**
 * 서비스 운영 상세. 라우트가 실계약 `/target-sources/page?serviceCode` 하나로 만든다.
 * `owner`(계약에 필드 없음), 설치 진행 단계, EOS 는 담지 않는다 — 근거는 라우트 주석.
 */
export interface OpsServiceDetail {
  service_code: string;
  service_name: string;
  /**
   * 업스트림이 보고한 총 대상 수. `target_sources.length` 와 다를 수 있다 — 라우트가
   * 페이지 집계 상한에 걸리면 목록만 잘리고 이 값은 진짜 총계를 유지한다. 건수 표기는
   * 목록 길이가 아니라 이 값을 쓴다.
   */
  total_count: number;
  target_sources: OpsServiceTargetRow[];
}

export const getOpsTargetSources = (
  query: string | undefined,
  page = 0,
  size = 20,
): Promise<OpsTargetSourceListPage> => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query?.trim()) params.set('query', query.trim());
  return fetchInfraJson<OpsTargetSourceListPage>(`/admin/ops/target-sources?${params}`);
};

export const getOpsService = (serviceCode: string): Promise<OpsServiceDetail> =>
  fetchInfraJson<OpsServiceDetail>(`/admin/ops/services/${encodeURIComponent(serviceCode)}`);

/* ── Jira Ticket 연결 — REAL contract (docs/api/jira-tickets.md §1) ── */

/** Jira ticket 연결 키. 서비스 1건은 provider 마다 티켓을 최대 1개 갖는다. */
export const JIRA_CLOUD_PROVIDERS = ['AWS', 'GCP', 'AZURE', 'IDC', 'SDU'] as const;
export type JiraCloudProvider = (typeof JIRA_CLOUD_PROVIDERS)[number];

/** JiraTicketResponse — 이 도메인만 camel wire (install-v1). */
export interface JiraTicket {
  id: number;
  targetSourceId: number;
  serviceCode: string;
  issueKey: string;
  cloudProvider: string;
}

export const getServiceJiraTickets = (serviceCode: string): Promise<JiraTicket[]> =>
  fetchInfraJson<JiraTicket[]>(`/services/${encodeURIComponent(serviceCode)}/jira-tickets`);

/** 이미 존재하는 Jira 티켓을 이 서비스·provider 에 매핑한다. 티켓을 만들지 않는다. */
export const attachJiraTicket = (
  serviceCode: string,
  cloudProvider: JiraCloudProvider,
  issueKey: string,
): Promise<void> =>
  fetchInfraJson(
    `/services/${encodeURIComponent(serviceCode)}/jira-tickets/${cloudProvider}`,
    { method: 'POST', body: { issueKey } },
  );

/** 매핑만 끊는다 — Jira 의 티켓은 삭제되지 않는다. 응답은 끊긴 issueKey. */
export const detachJiraTicket = (
  serviceCode: string,
  cloudProvider: JiraCloudProvider,
): Promise<{ issueKey: string }> =>
  fetchInfraJson(`/services/${encodeURIComponent(serviceCode)}/jira-tickets/${cloudProvider}`, {
    method: 'DELETE',
  });
