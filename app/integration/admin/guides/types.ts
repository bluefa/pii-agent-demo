export type ProviderTab = 'aws' | 'azure' | 'gcp' | 'idc' | 'sdu';

export const ENABLED_PROVIDERS: ProviderTab[] = ['aws', 'azure', 'gcp'];
export const DISABLED_PROVIDERS: ProviderTab[] = ['idc', 'sdu'];

/** Display label for each provider tab. */
export const PROVIDER_LABELS: Record<ProviderTab, string> = {
  aws: 'AWS',
  azure: 'AZURE',
  gcp: 'GCP',
  idc: 'IDC',
  sdu: 'SDU',
};
