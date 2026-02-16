import type { Project, User, ServiceCode, DBCredential, ScanJob, ScanHistory, ProjectHistory, LegacyAwsInstallationStatus, LegacyAwsServiceSettings } from '@/lib/types';
import { mockUsers, mockServiceCodes, mockProjects as initialProjects, mockCredentials as initialCredentials, mockAwsInstallations, mockAwsServiceSettings } from '@/lib/mock-data';

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
    awsInstallations: Map<string, LegacyAwsInstallationStatus>;
    // AWS 서비스 설정 (serviceCode → settings)
    awsServiceSettings: Map<string, LegacyAwsServiceSettings>;
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
            // AWS 설치 상태 (초기 데이터 로드)
            awsInstallations: new Map(mockAwsInstallations),
            // AWS 서비스 설정 (초기 데이터 로드)
            awsServiceSettings: new Map(mockAwsServiceSettings),
        };
    }
    return globalThis.__piiAgentMockStore;
};
