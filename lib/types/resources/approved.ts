import type { DatabaseType, EndpointConfigSnapshot } from '@/lib/types';

export interface ApprovedResource {
  resourceId: string;
  type: string;
  databaseType: DatabaseType | null;
  endpointConfig: EndpointConfigSnapshot | null;
  credentialId: string | null;
}
