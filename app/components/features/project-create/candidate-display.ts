import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';
import {
  PROVIDER_CHIP_BY_KEY,
  isCspChip,
  type ProviderChipKey,
} from '@/lib/constants/provider-mapping';
import { COPY } from '@/lib/copy';

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

/** The wizard dictionary, so the display builders below can take it as a parameter. */
type WizardCopy = (typeof COPY)['ko']['wizard'];

/**
 * `PROVIDER_CHIP_BY_KEY` is a plain constants module and keeps its Korean defaults,
 * so the one label of its five that is a word rather than a brand is swapped here.
 */
const providerLabel = (t: WizardCopy, key: ProviderChipKey): string =>
  key === 'other' ? t.other : PROVIDER_CHIP_BY_KEY[key].label;

export const candidateTitle = (
  t: WizardCopy,
  candidate: TargetSourceCreationCandidateResponse,
): string =>
  isSduCandidate(candidate)
    ? t.sduAccount
    : t.accountOf(providerLabel(t, candidateProviderKey(candidate.cloud_type)));

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
  t: WizardCopy,
  candidate: TargetSourceCreationCandidateResponse,
): CandidateIdentity => {
  const meta = candidate.metadata ?? {};
  if (isSduCandidate(candidate)) {
    return { name: 'SDU', gloss: t.sduUploadGloss };
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
      return { name: t.idcInfra, gloss: meta.description || t.intranet };
    case 'other':
      return { name: t.otherInfra, gloss: meta.description || t.otherEnv };
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
