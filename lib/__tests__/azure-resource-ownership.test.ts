import { describe, expect, it } from 'vitest';
import { buildAzureOwnedResources, type AzureResourceCatalogItem } from '@/lib/azure-resource-ownership';
import { ProcessStatus, type ApprovalRequestInputSnapshot, type BffApprovedIntegration, type BffConfirmedIntegration } from '@/lib/types';

const createCatalogResource = (
  id: string,
  overrides?: Partial<AzureResourceCatalogItem>,
): AzureResourceCatalogItem => ({
  id,
  resourceId: `resource-${id}`,
  name: `resource-${id}`,
  resourceType: 'AZURE_MSSQL',
  databaseType: 'MSSQL',
  integrationCategory: 'TARGET',
  host: null,
  port: null,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  metadata: {
    provider: 'Azure',
    resourceType: 'AZURE_MSSQL',
    region: 'koreacentral',
  },
  ...overrides,
});

const createApprovalInput = (
  resourceInputs?: ApprovalRequestInputSnapshot['resource_inputs'],
): { request: { input_data?: ApprovalRequestInputSnapshot } } => ({
  request: {
    ...(resourceInputs
      ? {
        input_data: {
          resource_inputs: resourceInputs,
        },
      }
      : {}),
  },
});

describe('buildAzureOwnedResources', () => {
  it('uses approval-history while waiting approval and restores VM settings from the request snapshot', () => {
    const result = buildAzureOwnedResources({
      currentStep: ProcessStatus.WAITING_APPROVAL,
      projectResources: [],
      catalog: [
        createCatalogResource('vm-1', {
          resourceType: 'AZURE_VM',
          databaseType: 'MYSQL',
          port: 3306,
          host: '10.0.0.4',
          networkInterfaceId: 'nic-catalog',
          metadata: {
            provider: 'Azure',
            resourceType: 'AZURE_VM',
            region: 'koreacentral',
          },
        }),
        createCatalogResource('sql-1'),
      ],
      latestApprovalRequest: createApprovalInput([
        {
          resource_id: 'vm-1',
          selected: true,
          resource_input: {
            endpoint_config: {
              db_type: 'ORACLE',
              host: '10.0.0.99',
              port: 1521,
              oracleServiceId: 'ORCL',
              selectedNicId: 'nic-approval',
            },
          },
        },
        {
          resource_id: 'sql-1',
          selected: true,
          resource_input: {
            credential_id: 'cred-history',
          },
        },
      ]),
      approvedIntegration: null,
      confirmedIntegration: { resource_infos: [] },
    });

    expect(result.selectionSource).toBe('approval-history');
    expect(result.resources).toEqual([
      expect.objectContaining({
        id: 'vm-1',
        isSelected: true,
        databaseType: 'ORACLE',
        vmDatabaseConfig: {
          databaseType: 'ORACLE',
          host: '10.0.0.99',
          port: 1521,
          oracleServiceId: 'ORCL',
          selectedNicId: 'nic-approval',
        },
      }),
      expect.objectContaining({
        id: 'sql-1',
        isSelected: true,
        selectedCredentialId: 'cred-history',
      }),
    ]);
  });

  it('falls back to catalog when approval-history no longer includes input_data', () => {
    const result = buildAzureOwnedResources({
      currentStep: ProcessStatus.WAITING_APPROVAL,
      projectResources: [],
      catalog: [createCatalogResource('sql-1')],
      latestApprovalRequest: createApprovalInput(),
      approvedIntegration: null,
      confirmedIntegration: { resource_infos: [] },
    });

    expect(result.selectionSource).toBe('catalog');
    expect(result.resources[0]).toEqual(
      expect.objectContaining({
        id: 'sql-1',
        isSelected: false,
      }),
    );
  });

  it('prefers approved-integration over other snapshots while approval is being applied', () => {
    const approvedIntegration: BffApprovedIntegration = {
      id: 'approved-1',
      request_id: 'request-1',
      approved_at: '2026-03-23T01:00:00Z',
      resource_infos: [
        {
          resource_id: 'vm-1',
          resource_type: 'AZURE_VM',
          endpoint_config: {
            resource_id: 'vm-1',
            db_type: 'POSTGRESQL',
            host: '10.0.0.5',
            port: 5432,
            selectedNicId: 'nic-approved',
          },
          credential_id: null,
        },
      ],
      excluded_resource_ids: [],
    };

    const confirmedIntegration: BffConfirmedIntegration = {
      resource_infos: [
        {
          resource_id: 'vm-1',
          resource_type: 'AZURE_VM',
          database_type: 'MYSQL',
          host: '10.0.0.1',
          port: 3306,
          oracle_service_id: null,
          network_interface_id: 'nic-confirmed',
          ip_configuration_name: null,
          credential_id: null,
        },
      ],
    };

    const result = buildAzureOwnedResources({
      currentStep: ProcessStatus.APPLYING_APPROVED,
      projectResources: [],
      catalog: [
        createCatalogResource('vm-1', {
          resourceType: 'AZURE_VM',
          databaseType: 'MYSQL',
          port: 3306,
          host: '10.0.0.4',
          networkInterfaceId: 'nic-catalog',
          metadata: {
            provider: 'Azure',
            resourceType: 'AZURE_VM',
            region: 'koreacentral',
          },
        }),
      ],
      latestApprovalRequest: createApprovalInput([
        {
          resource_id: 'vm-1',
          selected: true,
          resource_input: {
            endpoint_config: {
              db_type: 'ORACLE',
              host: '10.0.0.99',
              port: 1521,
              oracleServiceId: 'ORCL',
            },
          },
        },
      ]),
      approvedIntegration,
      confirmedIntegration,
    });

    expect(result.selectionSource).toBe('approved-integration');
    expect(result.resources[0]).toEqual(
      expect.objectContaining({
        id: 'vm-1',
        isSelected: true,
        databaseType: 'POSTGRESQL',
        vmDatabaseConfig: {
          databaseType: 'POSTGRESQL',
          host: '10.0.0.5',
          port: 5432,
          selectedNicId: 'nic-approved',
        },
      }),
    );
  });

  it('does not keep restoring selection from approval-history after approval is in progress', () => {
    const result = buildAzureOwnedResources({
      currentStep: ProcessStatus.APPLYING_APPROVED,
      projectResources: [],
      catalog: [
        createCatalogResource('vm-1', {
          resourceType: 'AZURE_VM',
          databaseType: 'MYSQL',
          port: 3306,
          host: '10.0.0.4',
          networkInterfaceId: 'nic-catalog',
          metadata: {
            provider: 'Azure',
            resourceType: 'AZURE_VM',
            region: 'koreacentral',
          },
        }),
      ],
      latestApprovalRequest: createApprovalInput([
        {
          resource_id: 'vm-1',
          selected: true,
          resource_input: {
            endpoint_config: {
              db_type: 'ORACLE',
              host: '10.0.0.99',
              port: 1521,
              oracleServiceId: 'ORCL',
              selectedNicId: 'nic-approval',
            },
          },
        },
      ]),
      approvedIntegration: null,
      confirmedIntegration: { resource_infos: [] },
    });

    expect(result.selectionSource).toBe('catalog');
    expect(result.resources[0]).toEqual(
      expect.objectContaining({
        id: 'vm-1',
        isSelected: false,
        databaseType: 'MYSQL',
        vmDatabaseConfig: {
          databaseType: 'MYSQL',
          host: '10.0.0.4',
          port: 3306,
          selectedNicId: 'nic-catalog',
        },
      }),
    );
  });

  it('falls back to confirmed-integration after installation is complete', () => {
    const confirmedIntegration: BffConfirmedIntegration = {
      resource_infos: [
        {
          resource_id: 'sql-1',
          resource_type: 'AZURE_MSSQL',
          database_type: 'MSSQL',
          host: 'db.internal',
          port: 1433,
          oracle_service_id: null,
          network_interface_id: null,
          ip_configuration_name: null,
          credential_id: 'cred-confirmed',
        },
      ],
    };

    const result = buildAzureOwnedResources({
      currentStep: ProcessStatus.INSTALLATION_COMPLETE,
      projectResources: [],
      catalog: [createCatalogResource('sql-1')],
      latestApprovalRequest: createApprovalInput([
        {
          resource_id: 'sql-1',
          selected: true,
          resource_input: {
            credential_id: 'cred-history',
          },
        },
      ]),
      approvedIntegration: null,
      confirmedIntegration,
    });

    expect(result.selectionSource).toBe('confirmed-integration');
    expect(result.resources[0]).toEqual(
      expect.objectContaining({
        id: 'sql-1',
        isSelected: true,
        selectedCredentialId: 'cred-confirmed',
      }),
    );
  });

  it('falls back to project resources while approval is pending when approval-history only has summary data', () => {
    const result = buildAzureOwnedResources({
      currentStep: ProcessStatus.WAITING_APPROVAL,
      projectResources: [
        {
          id: 'sql-1',
          type: 'AZURE_MSSQL',
          resourceId: 'resource-sql-1',
          connectionStatus: 'PENDING',
          isSelected: true,
          databaseType: 'MSSQL',
          integrationCategory: 'TARGET',
          selectedCredentialId: 'cred-project',
        },
      ],
      catalog: [createCatalogResource('sql-1')],
      latestApprovalRequest: createApprovalInput(),
      approvedIntegration: null,
      confirmedIntegration: { resource_infos: [] },
    });

    expect(result.selectionSource).toBe('project');
    expect(result.resources[0]).toEqual(
      expect.objectContaining({
        id: 'sql-1',
        isSelected: true,
        selectedCredentialId: 'cred-project',
      }),
    );
  });
});
