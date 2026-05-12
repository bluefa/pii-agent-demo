import type { CloudProvider } from '@/lib/types';

/**
 * 하나의 식별자 레코드. "TargetSource"가 가리키는 클라우드 계정을 고유하게
 * 지정하는 공개 정보 — AWS Account ID, Azure Subscription/Tenant ID, GCP
 * Project ID 등. 비밀키(SecretKey)와는 별개의 개념이다.
 */
export interface TargetSourceIdentifier {
  label: string;
  value: string | null;
  /** true면 mono font + hover 시 복사 버튼 노출 */
  mono?: boolean;
}

export interface ProjectIdentity {
  cloudProvider: CloudProvider;
  /** e.g. "AWS Agent", "Azure Agent", "SDU" */
  monitoringMethod: string;
  /** Jira 티켓 URL. null/undefined면 chip 렌더하지 않음 */
  jiraLink?: string | null;
  /** provider별 공개 식별자들 (account id, subscription id, tenant id, project id 등) */
  identifiers: TargetSourceIdentifier[];
}
