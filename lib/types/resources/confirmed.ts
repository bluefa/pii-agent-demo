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
  /** Athena DB 행이 속한 리전 단위 리소스 id (설치 상태 조인 키). Athena 외에는 없다. */
  athenaRegionResourceId?: string | null;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED';
}
