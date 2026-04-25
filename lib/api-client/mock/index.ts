import type { ApiClient } from '@/lib/api-client/types';
import { mockProjects } from '@/lib/api-client/mock/projects';
import { mockTargetSources } from '@/lib/api-client/mock/target-sources';
import { mockUsers } from '@/lib/api-client/mock/users';
import { mockAws } from '@/lib/api-client/mock/aws';
import { mockAzure } from '@/lib/api-client/mock/azure';
import { mockGcp } from '@/lib/api-client/mock/gcp';
import { mockServices } from '@/lib/api-client/mock/services';
import { mockDashboard } from '@/lib/api-client/mock/dashboard';
import { mockDev } from '@/lib/api-client/mock/dev';
import { mockScan } from '@/lib/api-client/mock/scan';
import { mockConfirm } from '@/lib/api-client/mock/confirm';
import { mockQueueBoard } from '@/lib/api-client/mock/queue-board';
import { mockGuides } from '@/lib/api-client/mock/guides';

export const mockClient: ApiClient = {
  dashboard: mockDashboard,
  targetSources: mockTargetSources,
  projects: mockProjects,
  users: mockUsers,
  aws: mockAws,
  azure: mockAzure,
  gcp: mockGcp,
  services: mockServices,
  dev: mockDev,
  scan: mockScan,
  taskAdmin: mockQueueBoard,
  confirm: mockConfirm,
  guides: mockGuides,
};
