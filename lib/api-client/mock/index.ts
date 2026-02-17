import type { ApiClient } from '@/lib/api-client/types';
import { mockProjects } from '@/lib/api-client/mock/projects';
import { mockTargetSources } from '@/lib/api-client/mock/target-sources';
import { mockUsers } from '@/lib/api-client/mock/users';
import { mockSdu } from '@/lib/api-client/mock/sdu';
import { mockAws } from '@/lib/api-client/mock/aws';
import { mockAzure } from '@/lib/api-client/mock/azure';
import { mockGcp } from '@/lib/api-client/mock/gcp';
import { mockIdc } from '@/lib/api-client/mock/idc';
import { mockServices } from '@/lib/api-client/mock/services';
import { mockDev } from '@/lib/api-client/mock/dev';
import { mockScan } from '@/lib/api-client/mock/scan';
import { mockConfirm } from '@/lib/api-client/mock/confirm';

export const mockClient: ApiClient = {
  targetSources: mockTargetSources,
  projects: mockProjects,
  users: mockUsers,
  sdu: mockSdu,
  aws: mockAws,
  azure: mockAzure,
  gcp: mockGcp,
  idc: mockIdc,
  services: mockServices,
  dev: mockDev,
  scan: mockScan,
  confirm: mockConfirm,
};
