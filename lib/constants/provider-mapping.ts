import type { CloudProvider } from '@/lib/types';

export type ProviderChipKey =
  | 'aws-global'
  | 'aws-china'
  | 'azure'
  | 'gcp'
  | 'idc'
  | 'other'
  | 'saas';

export interface ProviderChipDef {
  key: ProviderChipKey;
  label: string;
  sublabel?: string;
  enabled: boolean;
  cloudProvider?: CloudProvider;
  awsRegionType?: 'global' | 'china';
  communicationModule?: 'AWS Agent' | 'Azure Agent' | 'GCP Agent';
}

export const PROVIDER_CHIPS: ProviderChipDef[] = [
  { key: 'aws-global', label: 'AWS', sublabel: '(Global)', enabled: true, cloudProvider: 'AWS', awsRegionType: 'global', communicationModule: 'AWS Agent' },
  { key: 'aws-china', label: 'AWS', sublabel: '(China)', enabled: true, cloudProvider: 'AWS', awsRegionType: 'china', communicationModule: 'AWS Agent' },
  { key: 'azure', label: 'Azure', enabled: true, cloudProvider: 'Azure', communicationModule: 'Azure Agent' },
  { key: 'gcp', label: 'GCP', enabled: true, cloudProvider: 'GCP', communicationModule: 'GCP Agent' },
  { key: 'idc', label: 'IDC /', sublabel: 'On-prem', enabled: false },
  { key: 'other', label: 'Other', sublabel: 'Cloud / IDC', enabled: false },
  { key: 'saas', label: 'SaaS', enabled: false },
];

export const PROVIDER_CHIP_BY_KEY: Record<ProviderChipKey, ProviderChipDef> = PROVIDER_CHIPS.reduce(
  (acc, chip) => ({ ...acc, [chip.key]: chip }),
  {} as Record<ProviderChipKey, ProviderChipDef>,
);

export const getProviderChipDisplayLabel = (chip: ProviderChipDef): string =>
  chip.sublabel ? `${chip.label} ${chip.sublabel}` : chip.label;
