import type { DatabaseType } from '@/lib/types';

export interface ConfirmedResource {
  resourceId: string;
  type: string;
  databaseType: DatabaseType | null;
  region: string | null;
  resourceName: string | null;
  host: string | null;
  port: number | null;
  oracleServiceId: string | null;
  networkInterfaceId: string | null;
  ipConfigurationName: string | null;
  credentialId: string | null;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED';
}
