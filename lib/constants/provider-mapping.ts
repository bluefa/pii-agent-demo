/**
 * Provider chip taxonomy for the 인프라 등록 wizard.
 *
 * The chip key is a UI concept; `cloudType` is the lowercase value sent as
 * `cloud_type` on the creation-candidates request (swagger
 * `TargetSourceCreationCandidateRequest`: aws|azure|gcp|idc|others).
 *
 * `other` sends `others` — the contract enum carries it, so the chip no longer
 * has to borrow IDC's path.
 */

export type ProviderChipKey = 'aws' | 'azure' | 'gcp' | 'idc' | 'other';

/** Lowercase request `cloud_type` enum — distinct from the UPPERCASE response enum. */
export type TargetSourceRequestCloudType = 'aws' | 'azure' | 'gcp' | 'idc' | 'others';

export interface ProviderChipDef {
  key: ProviderChipKey;
  label: string;
  description: string;
  cloudType: TargetSourceRequestCloudType;
}

export const PROVIDER_CHIPS: ProviderChipDef[] = [
  { key: 'aws', label: 'AWS', description: 'Amazon Web Services', cloudType: 'aws' },
  { key: 'azure', label: 'Azure', description: 'Microsoft Azure', cloudType: 'azure' },
  { key: 'gcp', label: 'GCP', description: 'Google Cloud', cloudType: 'gcp' },
  { key: 'idc', label: 'IDC', description: '사내 데이터 센터', cloudType: 'idc' },
  { key: 'other', label: '기타', description: '그 외 환경', cloudType: 'others' },
];

export const PROVIDER_CHIP_BY_KEY: Record<ProviderChipKey, ProviderChipDef> = PROVIDER_CHIPS.reduce(
  (acc, chip) => ({ ...acc, [chip.key]: chip }),
  {} as Record<ProviderChipKey, ProviderChipDef>,
);

/**
 * The three public clouds — the chips that talk about a "계정" rather than an
 * "인프라". Allowlist, not `!== 'idc'`: a new chip must opt in deliberately.
 *
 * NOTE: this is no longer the same set as `hasChinaRegion` — being a public cloud
 * and having a China partition are two different facts about a provider.
 */
export const isCspChip = (key: ProviderChipKey): boolean =>
  key === 'aws' || key === 'azure' || key === 'gcp';

/**
 * Which chips have a China partition worth asking about. GCP has no China region,
 * so the wizard neither asks for one nor ever sends `is_china_region: true` for it —
 * a question with one possible answer is not a question.
 *
 * Allowlist, not `isCspChip(key) && key !== 'gcp'`: a new provider must opt in
 * deliberately rather than inherit the region question by being a cloud.
 */
export const hasChinaRegion = (key: ProviderChipKey): boolean =>
  key === 'aws' || key === 'azure';
