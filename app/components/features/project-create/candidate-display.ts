import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';
import {
  PROVIDER_CHIP_BY_KEY,
  isCspChip,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';

/**
 * Response `cloud_type` (AWS|GCP|AZURE|IDC|SDU|UNKNOWN, loose casing) → chip key.
 *
 * Anything the enum does not name a cloud for — UNKNOWN, an absent value, and the
 * 기타 registrations that come back as UNKNOWN — lands on `other`, NOT on AWS: a
 * default that names a real provider tells the user something we do not know.
 */
export const candidateProviderKey = (raw?: string | null): ProviderChipKey => {
  switch ((raw ?? '').trim().toUpperCase()) {
    case 'AWS':
      return 'aws';
    case 'AZURE':
      return 'azure';
    case 'GCP':
      return 'gcp';
    case 'IDC':
      return 'idc';
    default:
      return 'other';
  }
};

export const isSduCandidate = (candidate: TargetSourceCreationCandidateResponse): boolean =>
  candidate.is_sdu_type === true;

export const candidateTitle = (candidate: TargetSourceCreationCandidateResponse): string =>
  isSduCandidate(candidate)
    ? 'Self Data Upload 계정'
    : `${PROVIDER_CHIP_BY_KEY[candidateProviderKey(candidate.cloud_type)].label} 계정`;

/**
 * The step-4 card's identity block, in the anatomy the /services list uses
 * (app/components/features/admin/v7/InfraRow.tsx `identityOf`): the provider name
 * leads, then the word for the kind of id it owns, then the id. Where a provider has
 * no account of its own the second layer carries a gloss instead, and GCP puts its
 * project on its own line because the id is long enough to want the whole width.
 *
 * Every field here comes from the RESPONSE. Nothing the user typed into the wizard is
 * echoed back as if the API had said it.
 */
export interface CandidateIdentity {
  /** Layer 1: the provider's own name. */
  name: string;
  /** Layer 1 continued — the word for the id ("Account", "Subscription"). */
  kind?: string;
  value?: string;
  /** Layer 2 when the account id belongs on its own line (GCP). */
  secondKind?: string;
  secondValue?: string;
  /** Layer 2 when there is no account at all (SDU, IDC, 기타). */
  gloss?: string;
}

export const candidateIdentity = (
  candidate: TargetSourceCreationCandidateResponse,
): CandidateIdentity => {
  const meta = candidate.metadata ?? {};
  if (isSduCandidate(candidate)) {
    return { name: 'SDU', gloss: '서비스 담당자가 데이터를 직접 업로드' };
  }
  switch (candidateProviderKey(candidate.cloud_type)) {
    case 'aws':
      return { name: 'AWS', kind: 'Account', value: meta.aws_account_id ?? undefined };
    case 'azure':
      return { name: 'Azure', kind: 'Subscription', value: meta.subscription_id ?? undefined };
    case 'gcp':
      return { name: 'GCP', secondKind: 'Project', secondValue: meta.project_id ?? undefined };
    // IDC/기타 own no account id — the description IS how the user names the box, so
    // it takes the gloss slot rather than repeating under a 설명 label.
    case 'idc':
      return { name: 'IDC 인프라', gloss: meta.description || '사내망' };
    case 'other':
      return { name: '기타 인프라', gloss: meta.description || '그 외 환경' };
  }
};

/**
 * 설치 모드 is AWS-only and two-state. The response echoes the permission when it was
 * granted; an absent key means it was never granted, so the card falls back to what the
 * wizard asked for rather than inventing a third reading.
 */
export const candidateInstallModeIsAuto = (
  candidate: TargetSourceCreationCandidateResponse,
  requestedAuto: boolean,
): boolean =>
  typeof candidate.grant_service_terraform_execution_permission === 'boolean'
    ? candidate.grant_service_terraform_execution_permission
    : requestedAuto;

/** 설명 as its own layer — only where it is not already the identity's gloss. */
export const candidateDescriptionLine = (
  candidate: TargetSourceCreationCandidateResponse,
): string | null => {
  const providerKey = candidateProviderKey(candidate.cloud_type);
  if (isSduCandidate(candidate) || !isCspChip(providerKey)) return null;
  return candidate.metadata?.description || null;
};
