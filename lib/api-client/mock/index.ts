import type { ApiClient } from '@/lib/api-client/types';
import { mockProjects } from '@/lib/api-client/mock/projects';
import { mockUsers } from '@/lib/api-client/mock/users';
import { mockSdu } from '@/lib/api-client/mock/sdu';

export const mockClient: ApiClient = {
  projects: mockProjects,
  users: mockUsers,
  sdu: mockSdu,
};
