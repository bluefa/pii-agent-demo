import type { CloudProvider } from '@/lib/types';
import type { DbType } from '@/lib/constants/db-types';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';

export interface StagedInfra {
  tempId: string;
  chipKey: ProviderChipKey;
  providerLabel: string;
  cloudProvider: CloudProvider;
  awsRegionType?: 'global' | 'china';
  credentials: Record<string, string>;
  dbTypes: DbType[];
  communicationModule: 'AWS Agent' | 'Azure Agent' | 'GCP Agent';
  error?: string;
}
