import type { Project, User, ServiceCode, DBCredential, ScanJob, ScanHistory, ProjectHistory, AwsInstallationStatus, AwsServiceSettings } from '@/lib/types';
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
    // Project History (승인/반려/리소스 변경 이력)
    projectHistory: ProjectHistory[];
    // AWS 설치 상태 (projectId → status)
    awsInstallations: Map<string, AwsInstallationStatus>;
    // AWS 서비스 설정 (serviceCode → settings)
    awsServiceSettings: Map<string, AwsServiceSettings>;
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
            // Project History
            projectHistory: [],
            // AWS 설치 상태
            awsInstallations: new Map(),
            // AWS 서비스 설정
            awsServiceSettings: new Map(),
        };
    }
    return globalThis.__piiAgentMockStore;
};
