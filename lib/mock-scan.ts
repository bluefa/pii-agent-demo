import { getStore } from '@/lib/mock-store';
import {
  CloudProvider,
  Project,
  Resource,
  ScanJob,
  ScanHistory,
  ScanResult,
  ScanStatus,
  ResourceType,
  DatabaseType,
  AwsResourceType,
  AzureResourceType,
  GcpResourceType,
} from '@/lib/types';
import {
  MAX_RESOURCES,
  SCAN_COOLDOWN_MS,
  SCAN_MIN_DURATION_MS,
  SCAN_MAX_DURATION_MS,
  SCAN_POLICY,
  getResourceTypesForProvider,
  AWS_REGIONS,
  AZURE_REGIONS,
  GCP_REGIONS,
} from '@/lib/constants/scan';

// ===== Helper Functions =====

const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
};

const pickRandom = <T>(arr: readonly T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

// ===== Validation =====

export interface ScanValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
  existingScanId?: string;
}

export const validateScanRequest = (
  project: Project | undefined,
  force: boolean = false
): ScanValidationResult => {
  if (!project) {
    return { valid: false, errorCode: 'NOT_FOUND', errorMessage: '프로젝트를 찾을 수 없습니다.', httpStatus: 404 };
  }

  // Provider 스캔 지원 확인
  const policy = SCAN_POLICY[project.cloudProvider];
  if (!policy.enabled) {
    return {
      valid: false,
      errorCode: 'SCAN_NOT_SUPPORTED',
      errorMessage: policy.reason || `${project.cloudProvider}는 스캔을 지원하지 않습니다.`,
      httpStatus: 400,
    };
  }

  // 리소스 최대 개수 확인
  if (project.resources.length >= MAX_RESOURCES) {
    return {
      valid: false,
      errorCode: 'MAX_RESOURCES_REACHED',
      errorMessage: `리소스가 최대 개수(${MAX_RESOURCES}개)에 도달했습니다.`,
      httpStatus: 400,
    };
  }

  const store = getStore();

  // 진행 중인 스캔 확인
  const inProgressScan = store.scans.find(
    (s) => s.projectId === project.id && (s.status === 'PENDING' || s.status === 'IN_PROGRESS')
  );
  if (inProgressScan) {
    // 시간 기반으로 실제 상태 확인
    const updated = calculateScanStatus(inProgressScan);
    if (updated.status === 'PENDING' || updated.status === 'IN_PROGRESS') {
      return {
        valid: false,
        errorCode: 'SCAN_IN_PROGRESS',
        errorMessage: '이미 스캔이 진행 중입니다.',
        httpStatus: 409,
        existingScanId: inProgressScan.id,
      };
    }
  }

  // 쿨다운 확인 (force가 아닐 때만)
  if (!force) {
    const lastCompletedScan = store.scanHistory
      .filter((h) => h.projectId === project.id && h.status === 'COMPLETED')
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];

    if (lastCompletedScan) {
      const timeSinceLastScan = Date.now() - new Date(lastCompletedScan.completedAt).getTime();
      if (timeSinceLastScan < SCAN_COOLDOWN_MS) {
        return {
          valid: false,
          errorCode: 'SCAN_TOO_RECENT',
          errorMessage: '최근 스캔 완료 후 5분이 지나지 않았습니다.',
          httpStatus: 429,
        };
      }
    }
  }

  return { valid: true };
};

// ===== Scan Job Management =====

export const createScanJob = (project: Project): ScanJob => {
  const now = new Date();
  const duration = SCAN_MIN_DURATION_MS + Math.random() * (SCAN_MAX_DURATION_MS - SCAN_MIN_DURATION_MS);
  const estimatedEnd = new Date(now.getTime() + duration);

  const scanJob: ScanJob = {
    id: generateId('scan'),
    projectId: project.id,
    provider: project.cloudProvider,
    status: 'PENDING',
    startedAt: now.toISOString(),
    estimatedEndAt: estimatedEnd.toISOString(),
    progress: 0,
  };

  const store = getStore();
  store.scans.push(scanJob);

  return scanJob;
};

export const getScanJob = (scanId: string): ScanJob | undefined => {
  const store = getStore();
  const scan = store.scans.find((s) => s.id === scanId);
  return scan ? calculateScanStatus(scan) : undefined;
};

export const getScanJobsForProject = (projectId: string): ScanJob[] => {
  const store = getStore();
  return store.scans
    .filter((s) => s.projectId === projectId)
    .map(calculateScanStatus);
};

export const getLatestScanForProject = (projectId: string): ScanJob | undefined => {
  const scans = getScanJobsForProject(projectId);
  return scans.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
};

// ===== Time-based Status Calculation =====

export const calculateScanStatus = (scan: ScanJob): ScanJob => {
  // 이미 완료된 스캔
  if (scan.status === 'COMPLETED' || scan.status === 'FAILED') {
    return scan;
  }

  const now = Date.now();
  const startTime = new Date(scan.startedAt).getTime();
  const estimatedEnd = new Date(scan.estimatedEndAt).getTime();

  // 완료 시간 도달
  if (now >= estimatedEnd) {
    return completeScan(scan);
  }

  // 진행 중 - progress 계산
  const elapsed = now - startTime;
  const total = estimatedEnd - startTime;
  const progress = Math.min(Math.floor((elapsed / total) * 100), 99);

  const updatedScan: ScanJob = {
    ...scan,
    status: 'IN_PROGRESS',
    progress,
  };

  // Store 업데이트
  const store = getStore();
  const index = store.scans.findIndex((s) => s.id === scan.id);
  if (index >= 0) {
    store.scans[index] = updatedScan;
  }

  return updatedScan;
};

// ===== Scan Completion =====

const completeScan = (scan: ScanJob): ScanJob => {
  const store = getStore();
  const project = store.projects.find((p) => p.id === scan.projectId);

  if (!project) {
    const failedScan: ScanJob = {
      ...scan,
      status: 'FAILED',
      completedAt: new Date().toISOString(),
      progress: 100,
      error: '프로젝트를 찾을 수 없습니다.',
    };
    updateScanInStore(failedScan);
    addScanHistory(failedScan, 0, 0, []);
    return failedScan;
  }

  const existingResources = project.resources;
  const { newResources, result, addedIds } = generateResourceChanges(project.cloudProvider, existingResources);

  // 프로젝트 리소스 업데이트
  const projectIndex = store.projects.findIndex((p) => p.id === project.id);
  if (projectIndex >= 0) {
    store.projects[projectIndex] = {
      ...project,
      resources: newResources,
      updatedAt: new Date().toISOString(),
    };
  }

  const completedScan: ScanJob = {
    ...scan,
    status: 'COMPLETED',
    completedAt: new Date().toISOString(),
    progress: 100,
    result,
  };

  updateScanInStore(completedScan);
  addScanHistory(completedScan, existingResources.length, newResources.length, addedIds);

  return completedScan;
};

const updateScanInStore = (scan: ScanJob): void => {
  const store = getStore();
  const index = store.scans.findIndex((s) => s.id === scan.id);
  if (index >= 0) {
    store.scans[index] = scan;
  }
};

const addScanHistory = (
  scan: ScanJob,
  resourceCountBefore: number,
  resourceCountAfter: number,
  addedResourceIds: string[]
): void => {
  const store = getStore();
  const history: ScanHistory = {
    id: generateId('history'),
    projectId: scan.projectId,
    scanId: scan.id,
    provider: scan.provider,
    status: scan.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
    startedAt: scan.startedAt,
    completedAt: scan.completedAt || new Date().toISOString(),
    duration: Math.floor(
      (new Date(scan.completedAt || new Date()).getTime() - new Date(scan.startedAt).getTime()) / 1000
    ),
    result: scan.result || null,
    error: scan.error,
    resourceCountBefore,
    resourceCountAfter,
    addedResourceIds,
  };
  store.scanHistory.push(history);
};

// ===== Resource Generation =====

interface ResourceChanges {
  newResources: Resource[];
  result: ScanResult;
  addedIds: string[];
}

const generateResourceChanges = (
  provider: CloudProvider,
  existingResources: Resource[]
): ResourceChanges => {
  const currentCount = existingResources.length;
  const availableSlots = MAX_RESOURCES - currentCount;

  // 기존 리소스는 항상 유지
  const newResources = [...existingResources];
  const addedIds: string[] = [];
  let newFound = 0;

  // 여유 슬롯이 있고 30% 확률로 신규 리소스 추가
  if (availableSlots > 0 && Math.random() < 0.3) {
    const addCount = Math.min(Math.floor(Math.random() * 2) + 1, availableSlots);

    for (let i = 0; i < addCount; i++) {
      const resource = generateRandomResource(provider);
      newResources.push(resource);
      addedIds.push(resource.id);
      newFound++;
    }
  }

  const result = buildScanResult(newResources, newFound);

  return { newResources, result, addedIds };
};

const buildScanResult = (resources: Resource[], newFound: number): ScanResult => {
  const typeCount = new Map<string, number>();
  resources.forEach((r) => {
    const type = r.awsType || r.type;
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  });

  return {
    totalFound: resources.length,
    newFound,
    updated: 0,
    removed: 0,
    byResourceType: Array.from(typeCount.entries()).map(([resourceType, count]) => ({
      resourceType: resourceType as ResourceType,
      count,
    })),
  };
};

// ===== Provider-specific Resource Generation =====

const generateRandomResource = (provider: CloudProvider): Resource => {
  switch (provider) {
    case 'AWS':
      return generateAwsResource();
    case 'Azure':
      return generateAzureResource();
    case 'GCP':
      return generateGcpResource();
    default:
      throw new Error(`Unsupported provider for resource generation: ${provider}`);
  }
};

const generateAwsResource = (): Resource => {
  const awsTypes: AwsResourceType[] = ['RDS', 'RDS_CLUSTER', 'DYNAMODB', 'ATHENA', 'REDSHIFT'];
  const awsType = pickRandom(awsTypes);
  const region = pickRandom(AWS_REGIONS);
  const accountId = '123456789012';
  const rand = Math.random().toString(36).substring(2, 6);

  let resourceId: string;
  let databaseType: DatabaseType;

  switch (awsType) {
    case 'RDS':
      resourceId = `arn:aws:rds:${region}:${accountId}:db:pii-demo-db-${rand}`;
      databaseType = pickRandom(['MYSQL', 'POSTGRESQL'] as DatabaseType[]);
      break;
    case 'RDS_CLUSTER':
      resourceId = `arn:aws:rds:${region}:${accountId}:cluster:pii-demo-cluster-${rand}`;
      databaseType = pickRandom(['MYSQL', 'POSTGRESQL'] as DatabaseType[]);
      break;
    case 'DYNAMODB':
      resourceId = `arn:aws:dynamodb:${region}:${accountId}:table/pii_demo_table_${rand}`;
      databaseType = 'DYNAMODB';
      break;
    case 'ATHENA':
      resourceId = `arn:aws:athena:${region}:${accountId}:workgroup/pii-demo-wg-${rand}`;
      databaseType = 'ATHENA';
      break;
    case 'REDSHIFT':
      resourceId = `arn:aws:redshift:${region}:${accountId}:cluster:pii-demo-rs-${rand}`;
      databaseType = 'REDSHIFT';
      break;
    default:
      resourceId = `arn:aws:rds:${region}:${accountId}:db:pii-demo-db-${rand}`;
      databaseType = 'MYSQL';
  }

  return {
    id: generateId('res'),
    type: awsType,
    resourceId,
    databaseType,
    connectionStatus: 'PENDING',
    isSelected: false,
    awsType,
    region,
    lifecycleStatus: 'DISCOVERED',
    isNew: true,
    note: 'NEW',
  };
};

const generateAzureResource = (): Resource => {
  const azureTypes: AzureResourceType[] = ['AZURE_MSSQL', 'AZURE_POSTGRESQL', 'AZURE_MYSQL', 'AZURE_COSMOS_NOSQL'];
  const azureType = pickRandom(azureTypes);
  const region = pickRandom(AZURE_REGIONS);
  const subscriptionId = 'sub-12345678-1234-1234-1234-123456789012';
  const resourceGroup = 'pii-demo-rg';
  const rand = Math.random().toString(36).substring(2, 6);

  let resourceId: string;
  let databaseType: DatabaseType;

  switch (azureType) {
    case 'AZURE_MSSQL':
      resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Sql/servers/pii-demo-sql-${rand}`;
      databaseType = 'MYSQL'; // Mapping for simplicity
      break;
    case 'AZURE_POSTGRESQL':
      resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforPostgreSQL/servers/pii-demo-pg-${rand}`;
      databaseType = 'POSTGRESQL';
      break;
    case 'AZURE_MYSQL':
      resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforMySQL/servers/pii-demo-mysql-${rand}`;
      databaseType = 'MYSQL';
      break;
    case 'AZURE_COSMOS_NOSQL':
      resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DocumentDB/databaseAccounts/pii-demo-cosmos-${rand}`;
      databaseType = 'DYNAMODB'; // NoSQL mapping
      break;
    default:
      resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Sql/servers/pii-demo-sql-${rand}`;
      databaseType = 'MYSQL';
  }

  return {
    id: generateId('res'),
    type: azureType,
    resourceId,
    databaseType,
    connectionStatus: 'PENDING',
    isSelected: false,
    lifecycleStatus: 'DISCOVERED',
    isNew: true,
    note: 'NEW',
  };
};

const generateGcpResource = (): Resource => {
  const gcpTypes: GcpResourceType[] = ['CLOUD_SQL', 'BIGQUERY', 'SPANNER'];
  const gcpType = pickRandom(gcpTypes);
  const region = pickRandom(GCP_REGIONS);
  const projectId = 'pii-demo-project';
  const rand = Math.random().toString(36).substring(2, 6);

  let resourceId: string;
  let databaseType: DatabaseType;

  switch (gcpType) {
    case 'CLOUD_SQL':
      resourceId = `projects/${projectId}/instances/pii-demo-sql-${rand}`;
      databaseType = pickRandom(['MYSQL', 'POSTGRESQL'] as DatabaseType[]);
      break;
    case 'BIGQUERY':
      resourceId = `projects/${projectId}/datasets/pii_demo_dataset_${rand}`;
      databaseType = 'ATHENA'; // BigQuery mapping
      break;
    case 'SPANNER':
      resourceId = `projects/${projectId}/instances/pii-demo-spanner-${rand}`;
      databaseType = 'POSTGRESQL'; // Spanner mapping
      break;
    default:
      resourceId = `projects/${projectId}/instances/pii-demo-sql-${rand}`;
      databaseType = 'MYSQL';
  }

  return {
    id: generateId('res'),
    type: gcpType,
    resourceId,
    databaseType,
    connectionStatus: 'PENDING',
    isSelected: false,
    lifecycleStatus: 'DISCOVERED',
    isNew: true,
    note: 'NEW',
  };
};

// ===== Scan History =====

export const getScanHistory = (
  projectId: string,
  limit: number = 10,
  offset: number = 0
): { history: ScanHistory[]; total: number } => {
  const store = getStore();
  const projectHistory = store.scanHistory
    .filter((h) => h.projectId === projectId)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  return {
    history: projectHistory.slice(offset, offset + limit),
    total: projectHistory.length,
  };
};

// ===== Utility Functions =====

export const canScan = (project: Project): { canScan: boolean; reason?: string } => {
  const policy = SCAN_POLICY[project.cloudProvider];
  if (!policy.enabled) {
    return { canScan: false, reason: policy.reason };
  }

  if (project.resources.length >= MAX_RESOURCES) {
    return { canScan: false, reason: `리소스가 최대 개수(${MAX_RESOURCES}개)에 도달했습니다.` };
  }

  const store = getStore();

  // 진행 중인 스캔 확인
  const inProgressScan = store.scans.find(
    (s) => s.projectId === project.id && (s.status === 'PENDING' || s.status === 'IN_PROGRESS')
  );
  if (inProgressScan) {
    const updated = calculateScanStatus(inProgressScan);
    if (updated.status === 'PENDING' || updated.status === 'IN_PROGRESS') {
      return { canScan: false, reason: '스캔이 진행 중입니다.' };
    }
  }

  // 쿨다운 확인
  const lastCompletedScan = store.scanHistory
    .filter((h) => h.projectId === project.id && h.status === 'COMPLETED')
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];

  if (lastCompletedScan) {
    const timeSinceLastScan = Date.now() - new Date(lastCompletedScan.completedAt).getTime();
    if (timeSinceLastScan < SCAN_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((SCAN_COOLDOWN_MS - timeSinceLastScan) / 1000);
      return { canScan: false, reason: `${remainingSeconds}초 후 스캔 가능` };
    }
  }

  return { canScan: true };
};
