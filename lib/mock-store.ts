import type { Project, User, ServiceCode, DBCredential, ScanJob, ScanHistory, ProjectHistory, LegacyAwsInstallationStatus, LegacyAwsServiceSettings } from '@/lib/types';
import type { TestConnectionJob } from '@/lib/mock-test-connection';
import { buildSeedTestConnectionJobs } from '@/lib/mock-test-connection';
import { buildSeedProjectHistory } from '@/lib/mock-history';
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
    // Test Connection 비동기 작업
    testConnectionJobs: TestConnectionJob[];
    // AWS 설치 상태 (targetSourceId → status)
    awsInstallations: Map<number, LegacyAwsInstallationStatus>;
    // AWS 서비스 설정 (serviceCode → settings)
    awsServiceSettings: Map<string, LegacyAwsServiceSettings>;
};

declare global {
    // eslint-disable-next-line no-var
    var __piiAgentMockStore: Store | undefined;
}

/**
 * 시드 프로젝트의 스캔 이력 — 리소스를 갖고 태어난 타겟소스는 "이미 스캔한" 타겟소스다.
 *
 * `/resources` 는 성공한 스캔이 없으면 404 다(실 BFF 와 같은 규칙,
 * `docs/redesign/step1-scan-funnel.md` §10). 이력이 비어 있으면 리소스를 들고 있는
 * 큐레이션 픽스처 전부가 404 로 떨어져 — Athena 그룹, RDS 클러스터 선택, 연동 불가 행,
 * 중국 리전 — 1단계 데모가 스캔부터 돌려야 닿는 화면이 되고, 그 스캔이 픽스처에 무작위
 * 리소스를 얹어 화면을 흔든다. 그래서 목이 부재가 아니라 **사실**을 만든다:
 * 리소스가 있으면 그것을 발견한 스캔도 있었다.
 *
 * 스캔한 적 없는 상태는 리소스 없이 태어난 타겟소스가 그대로 보여준다(IDC 1028 과 같은 짝).
 * 시각은 프로젝트의 updatedAt — 쿨다운(5분) 밖이라 `스캔 시작`이 429 로 막히지 않는다.
 */
const buildSeedScanHistory = (projects: Project[]): ScanHistory[] =>
  projects
    .filter((project) => project.cloudProvider !== 'IDC' && project.resources.length > 0)
    .map((project) => ({
      id: `seed-scan-${project.targetSourceId}`,
      targetSourceId: project.targetSourceId,
      scanId: `seed-scan-job-${project.targetSourceId}`,
      version: 1,
      provider: project.cloudProvider,
      status: 'SUCCESS' as const,
      startedAt: project.createdAt,
      completedAt: project.updatedAt,
      duration: 8,
      // null 이면 최신 잡이 "counts 없는 SUCCESS" 가 되고, UI 는 그걸 집계 중으로 읽어
      // 진행 프레임에 영영 머문다(isScanFinalizing). 끝난 스캔은 셈을 갖고 있어야 한다.
      result: { totalFound: project.resources.length, byResourceType: [] },
      resourceCountBefore: 0,
      resourceCountAfter: project.resources.length,
      addedResourceIds: project.resources.map((resource) => resource.resourceId),
    }));

export const getStore = (): Store => {
    if (!globalThis.__piiAgentMockStore) {
        const projects = [...initialProjects];
        globalThis.__piiAgentMockStore = {
            users: mockUsers,
            serviceCodes: mockServiceCodes,
            projects,
            credentials: [...initialCredentials],
            currentUserId: 'admin-1',
            // v2 Scan 관련
            scans: [],
            // 리소스를 들고 태어난 픽스처에는 그것을 발견한 스캔도 있어야 한다 — 없으면
            // /resources 가 404 이고(§10) 1단계 데모가 통째로 비어 보인다.
            scanHistory: buildSeedScanHistory(projects),
            // Project History — seeded for the ops demo target only (see mock-history).
            projectHistory: buildSeedProjectHistory(),
            // Test Connection — per-step seed: Step 5/6/7 targets start with a
            // completed-SUCCESS job so latest_version / latest-results /
            // completion-status are coherent (otherwise those pages 404).
            testConnectionJobs: buildSeedTestConnectionJobs(projects),
            // AWS 설치 상태 (초기 데이터 로드)
            awsInstallations: new Map(mockAwsInstallations),
            // AWS 서비스 설정 (초기 데이터 로드)
            awsServiceSettings: new Map(mockAwsServiceSettings),
        };
    }
    return globalThis.__piiAgentMockStore;
};

export const resetStore = (): void => {
    globalThis.__piiAgentMockStore = undefined;
};
