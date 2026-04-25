export type ProviderTab = 'aws' | 'azure' | 'gcp' | 'idc' | 'sdu';

export const ENABLED_PROVIDERS = ['aws', 'azure', 'gcp'] as const satisfies readonly ProviderTab[];
export const DISABLED_PROVIDERS = ['idc', 'sdu'] as const satisfies readonly ProviderTab[];
export const ALL_PROVIDER_TABS = [...ENABLED_PROVIDERS, ...DISABLED_PROVIDERS] as const;

const DISABLED_SET = new Set<ProviderTab>(DISABLED_PROVIDERS);
export const isDisabledProvider = (tab: ProviderTab): boolean => DISABLED_SET.has(tab);

// Lower-case ProviderTab → upper-case GuidePlacement.provider. Encodes
// the casing seam in one place so callers stay typed end-to-end.
export const PLACEMENT_PROVIDER_BY_TAB: Record<'aws' | 'azure' | 'gcp', 'AWS' | 'AZURE' | 'GCP'> = {
  aws: 'AWS',
  azure: 'AZURE',
  gcp: 'GCP',
};

export const PROVIDER_LABELS: Record<ProviderTab, string> = {
  aws: 'AWS',
  azure: 'AZURE',
  gcp: 'GCP',
  idc: 'IDC',
  sdu: 'SDU',
};
