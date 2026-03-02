import { beforeEach, describe, expect, it } from 'vitest';
import {
  _fastForwardApproval,
  _resetApprovedIntegrationStore,
  mockConfirm,
} from '@/lib/api-client/mock/confirm';
import { setCurrentUser } from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';
import { ProcessStatus, type Project, type ProjectStatus, type Resource } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process/calculator';

const TEST_PROJECT_ID = 'test-athena-confirm-proj';
const ACCOUNT_ID = '123456789012';
const REGION = 'ap-northeast-2';

const parseResponse = async (response: Response) => response.json();

const createAthenaResource = (
  id: string,
  resourceId: string,
  region: string = REGION,
): Resource => ({
  id,
  type: 'ATHENA',
  resourceId,
  databaseType: 'ATHENA',
  connectionStatus: 'PENDING',
  isSelected: false,
  awsType: 'ATHENA',
  region,
  integrationCategory: 'TARGET',
});

const createTestProject = (overrides?: Partial<Project>): Project => ({
  id: TEST_PROJECT_ID,
  targetSourceId: 9991,
  projectCode: 'TEST-ATHENA-001',
  name: 'Athena Test Project',
  description: 'Athena Test',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  status: createInitialProjectStatus(),
  resources: [],
  terraformState: { serviceTf: 'PENDING', bdcTf: 'PENDING' },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  isRejected: false,
  awsAccountId: ACCOUNT_ID,
  ...overrides,
});

const createApprovalRequestBody = () => ({
  input_data: {
    resource_inputs: [],
    athena_input: {
      rules: [
        {
          scope: 'REGION' as const,
          resource_id: `athena:${ACCOUNT_ID}/${REGION}`,
          selected: true,
          include_all_tables: true,
        },
        {
          scope: 'TABLE' as const,
          resource_id: `athena:${ACCOUNT_ID}/${REGION}/analytics_db/orderhistory`,
          selected: false,
        },
      ],
    },
  },
});

const resetTestState = () => {
  const store = getStore();
  store.projects = store.projects.filter((project) => project.id !== TEST_PROJECT_ID);
  store.projectHistory = [];
  store.currentUserId = 'admin-1';
  setCurrentUser('admin-1');
  _resetApprovedIntegrationStore();
};

describe('mockConfirm Athena drill-down', () => {
  beforeEach(() => {
    resetTestState();
  });

  it('resources 응답에서 Athena는 ATHENA_REGION 리소스로 집계된다', async () => {
    const store = getStore();
    store.projects.push(createTestProject({
      resources: [
        createAthenaResource('ath-1', `athena:${ACCOUNT_ID}/${REGION}/analytics_db/clickstream`),
        createAthenaResource('ath-2', `athena:${ACCOUNT_ID}/${REGION}/analytics_db/orderhistory`),
        createAthenaResource('ath-3', `athena:${ACCOUNT_ID}/us-east-1/analytics_db/events`, 'us-east-1'),
      ],
    }));

    const response = await mockConfirm.getResources(TEST_PROJECT_ID);
    expect(response.status).toBe(200);
    const data = await parseResponse(response);

    const athenaRegions = data.resources.filter(
      (resource: { resourceType: string }) => resource.resourceType === 'ATHENA_REGION',
    );
    expect(athenaRegions).toHaveLength(2);
    expect(
      athenaRegions.find(
        (resource: { metadata?: { athena_region?: string } }) =>
          resource.metadata?.athena_region === REGION,
      ),
    ).toBeTruthy();
  });

  it('approval-request Athena drill-down은 선택된 테이블만 반환한다', async () => {
    const store = getStore();
    store.projects.push(createTestProject({
      resources: [
        createAthenaResource('ath-1', `athena:${ACCOUNT_ID}/${REGION}/analytics_db/clickstream`),
        createAthenaResource('ath-2', `athena:${ACCOUNT_ID}/${REGION}/analytics_db/orderhistory`),
        createAthenaResource('ath-3', `athena:${ACCOUNT_ID}/${REGION}/sales_db/salesdata`),
        createAthenaResource('ath-4', `athena:${ACCOUNT_ID}/us-east-1/ops_db/events`, 'us-east-1'),
      ],
    }));

    const createResponse = await mockConfirm.createApprovalRequest(
      TEST_PROJECT_ID,
      createApprovalRequestBody(),
    );
    expect(createResponse.status).toBe(201);
    const created = await parseResponse(createResponse);
    const requestId = created.approval_request.id as string;

    const dbResponse = await mockConfirm.getApprovalRequestAthenaDatabases(
      TEST_PROJECT_ID,
      requestId,
      REGION,
      0,
      10,
    );
    expect(dbResponse.status).toBe(200);
    const dbData = await parseResponse(dbResponse);
    expect(dbData.content.map((node: { database: string }) => node.database)).toEqual([
      'analytics_db',
      'sales_db',
    ]);

    const tableResponse = await mockConfirm.getApprovalRequestAthenaTables(
      TEST_PROJECT_ID,
      requestId,
      REGION,
      'analytics_db',
      0,
      10,
    );
    expect(tableResponse.status).toBe(200);
    const tableData = await parseResponse(tableResponse);
    expect(tableData.content.map((node: { table: string }) => node.table)).toEqual(['clickstream']);

    const excludedRegionResponse = await mockConfirm.getApprovalRequestAthenaTables(
      TEST_PROJECT_ID,
      requestId,
      'us-east-1',
      'ops_db',
      0,
      10,
    );
    const excludedRegionData = await parseResponse(excludedRegionResponse);
    expect(excludedRegionData.content).toHaveLength(0);
  });

  it('approved/confirmed Athena drill-down도 선택된 테이블만 반환한다', async () => {
    const store = getStore();
    const waitingApprovalStatus: ProjectStatus = {
      ...createInitialProjectStatus(),
      scan: { status: 'COMPLETED' },
      targets: { confirmed: false, selectedCount: 0, excludedCount: 0 },
      approval: { status: 'PENDING' },
    };
    store.projects.push(createTestProject({
      processStatus: ProcessStatus.WAITING_APPROVAL,
      status: waitingApprovalStatus,
      resources: [
        createAthenaResource('ath-1', `athena:${ACCOUNT_ID}/${REGION}/analytics_db/clickstream`),
        createAthenaResource('ath-2', `athena:${ACCOUNT_ID}/${REGION}/analytics_db/orderhistory`),
        createAthenaResource('ath-3', `athena:${ACCOUNT_ID}/${REGION}/sales_db/salesdata`),
        createAthenaResource('ath-4', `athena:${ACCOUNT_ID}/us-east-1/ops_db/events`, 'us-east-1'),
      ],
    }));

    const createResponse = await mockConfirm.createApprovalRequest(
      TEST_PROJECT_ID,
      createApprovalRequestBody(),
    );
    const created = await parseResponse(createResponse);
    const requestId = created.approval_request.id as string;
    expect(requestId).toBeTruthy();

    const approveResponse = await mockConfirm.approveApprovalRequest(TEST_PROJECT_ID, {});
    expect(approveResponse.status).toBe(200);

    const approvedTablesResponse = await mockConfirm.getApprovedIntegrationAthenaTables(
      TEST_PROJECT_ID,
      REGION,
      'analytics_db',
      0,
      10,
    );
    const approvedTables = await parseResponse(approvedTablesResponse);
    expect(approvedTables.content.map((node: { table: string }) => node.table)).toEqual([
      'clickstream',
    ]);

    _fastForwardApproval(TEST_PROJECT_ID);
    await mockConfirm.getProcessStatus(TEST_PROJECT_ID);

    const confirmedTablesResponse = await mockConfirm.getConfirmedIntegrationAthenaTables(
      TEST_PROJECT_ID,
      REGION,
      'analytics_db',
      0,
      10,
    );
    expect(confirmedTablesResponse.status).toBe(200);
    const confirmedTables = await parseResponse(confirmedTablesResponse);
    expect(confirmedTables.content.map((node: { table: string }) => node.table)).toEqual([
      'clickstream',
    ]);
  });
});
