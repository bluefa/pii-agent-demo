import type { Project, User, ServiceCode, DBCredential } from '@/lib/types';
import { mockUsers, mockServiceCodes, mockProjects as initialProjects, mockCredentials as initialCredentials } from '@/lib/mock-data';

type Store = {
    users: User[];
    serviceCodes: ServiceCode[];
    projects: Project[];
    credentials: DBCredential[];
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
            credentials: [...initialCredentials],
            currentUserId: 'admin-1',
        };
    }
    return globalThis.__piiAgentMockStore;
};
