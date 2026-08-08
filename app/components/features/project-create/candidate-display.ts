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

/** The account this card is about — whichever identifier its provider is keyed by. */
export const candidateIdentifier = (
  candidate: TargetSourceCreationCandidateResponse,
): string => {
  const meta = candidate.metadata ?? {};
  switch (candidateProviderKey(candidate.cloud_type)) {
    case 'aws':
      return meta.aws_account_id ? `Payer ${meta.aws_account_id}` : '—';
    case 'azure':
      return meta.subscription_id ? `Sub ${meta.subscription_id}` : '—';
    case 'gcp':
      return meta.project_id ? `Project ${meta.project_id}` : '—';
    case 'idc':
    case 'other':
      return meta.description || '—';
  }
};

/** Identifier · 리전 · 선택한 Database — the region only where a region was asked for. */
export const candidateMetaLine = (
  candidate: TargetSourceCreationCandidateResponse,
  dbSummary: string,
): string => {
  const providerKey = candidateProviderKey(candidate.cloud_type);
  const parts = [candidateIdentifier(candidate)];
  if (isCspChip(providerKey)) {
    parts.push(candidate.is_china_region === true ? 'China 리전' : 'Global 리전');
  }
  parts.push(dbSummary);
  return parts.join(' · ');
};
