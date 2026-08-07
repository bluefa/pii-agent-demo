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
  gcp_project_id: string | null;
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
 * 서비스 운영 상세. 라우트가 실계약 `/target-sources/page` + `/process-statuses` 를
 * 조합해 만든다 — `owner` 는 install-v1.yaml 어디에도 없어 뺐고, `status` 는
 * service_info.is_eos_service 에서 읽는 읽기 전용 값이다 (EOS 처리 계약 없음).
 */
export interface OpsServiceDetail {
  service_code: string;
  service_name: string;
  status: 'OPERATING' | 'EOS';
  target_sources: OpsTargetSourceListItem[];
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
