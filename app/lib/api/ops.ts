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

/* ── 운영 콘솔 목록/서비스 (assumed §5–6) ── */

export interface OpsTargetSourceListItem {
  target_source_id: number;
  service_code: string;
  service_name: string;
  cloud_provider: string;
  is_sdu_type: boolean;
  database_type: string | null;
  process_status: BffProcessStatus;
  last_changed_at: string;
}

export interface OpsTargetSourceListPage {
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  content: OpsTargetSourceListItem[];
}

export type OpsJiraTicketStatus = 'TO_DO' | 'IN_PROGRESS' | 'DONE';

export interface OpsJiraTicket {
  ticket_key: string;
  summary: string;
  status: OpsJiraTicketStatus;
  users: string[];
}

export interface OpsServiceSummary {
  service_code: string;
  service_name: string;
  owner: string;
  status: 'OPERATING' | 'EOS';
  target_source_count: number;
  jira_ticket_count: number;
}

export interface OpsServiceDetail {
  service_code: string;
  service_name: string;
  owner: string;
  status: 'OPERATING' | 'EOS';
  jira_tickets: OpsJiraTicket[];
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

export const getOpsServices = (): Promise<OpsServiceSummary[]> =>
  fetchInfraJson<OpsServiceSummary[]>('/admin/ops/services');

export const getOpsService = (serviceCode: string): Promise<OpsServiceDetail> =>
  fetchInfraJson<OpsServiceDetail>(`/admin/ops/services/${encodeURIComponent(serviceCode)}`);

export const requestServiceEos = (
  serviceCode: string,
  force: boolean,
): Promise<OpsServiceSummary> =>
  fetchInfraJson(`/admin/ops/services/${encodeURIComponent(serviceCode)}/eos`, {
    method: 'POST',
    body: { force },
  });

export const addJiraTicketUser = (
  serviceCode: string,
  ticketKey: string,
  userId: string,
): Promise<OpsJiraTicket> =>
  fetchInfraJson(
    `/admin/ops/services/${encodeURIComponent(serviceCode)}/jira-tickets/${encodeURIComponent(ticketKey)}/users`,
    { method: 'POST', body: { user_id: userId } },
  );
