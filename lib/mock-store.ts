import type { Project, User, ServiceCode } from '@/lib/types';
import { mockUsers, mockServiceCodes, mockProjects as initialProjects } from '@/lib/mock-data';

type Store = {
    users: User[];
    serviceCodes: ServiceCode[];
    projects: Project[];
    currentUserId: string;
};

declare global {
    // eslint-disable-next-line no-var
    var __piiAgentMockStore: Store | undefined;
}

export const getStore = (): Store => {
    if (!globalThis.__piiAgentMockStore) {
        globalThis.__piiAgentMockStore = {
            users: mockUsers,
            serviceCodes: mockServiceCodes,
            projects: [...initialProjects],
            currentUserId: 'admin-1',
        };
    }
    return globalThis.__piiAgentMockStore;
};
