import type { Project, User, ServiceCode, DBCredential, ScanJob, ScanHistory } from '@/lib/types';
import { mockUsers, mockServiceCodes, mockProjects as initialProjects, mockCredentials as initialCredentials } from '@/lib/mock-data';

type Store = {
    users: User[];
    serviceCodes: ServiceCode[];
    projects: Project[];
    credentials: DBCredential[];
    currentUserId: string;
    // v2 Scan 관련
    scans: ScanJob[];
    scanHistory: ScanHistory[];
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
            // v2 Scan 관련
            scans: [],
            scanHistory: [],
        };
    }
    return globalThis.__piiAgentMockStore;
};
