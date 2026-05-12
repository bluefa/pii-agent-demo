/**
 * Provider chip taxonomy for the inf-registration modal (v7).
 *
 * The chip key is a UI concept; `apiProvider` is the value sent to the
 * BFF preview/create endpoints (swagger `CloudProvider` enum).
 *
 * `other` shares IDC's API path — the swagger enum does not distinguish
 * an "Other" category, so we route it through IDC's description-based
 * identifier.
 */

export type ProviderChipKey = 'aws' | 'azure' | 'gcp' | 'idc' | 'other';

export type ApiProvider = 'AWS' | 'Azure' | 'GCP' | 'IDC';

export interface ProviderChipDef {
  key: ProviderChipKey;
  label: string;
  apiProvider: ApiProvider;
}

export const PROVIDER_CHIPS: ProviderChipDef[] = [
  { key: 'aws', label: 'AWS', apiProvider: 'AWS' },
  { key: 'azure', label: 'Azure', apiProvider: 'Azure' },
  { key: 'gcp', label: 'GCP', apiProvider: 'GCP' },
  { key: 'idc', label: 'IDC', apiProvider: 'IDC' },
  { key: 'other', label: 'Other', apiProvider: 'IDC' },
];

export const PROVIDER_CHIP_BY_KEY: Record<ProviderChipKey, ProviderChipDef> = PROVIDER_CHIPS.reduce(
  (acc, chip) => ({ ...acc, [chip.key]: chip }),
  {} as Record<ProviderChipKey, ProviderChipDef>,
);
