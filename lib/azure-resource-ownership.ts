import type {
  ApprovalRequestInputSnapshot,
  BffApprovedIntegration,
  BffConfirmedIntegration,
  ConfirmResourceMetadata,
  DatabaseType,
  EndpointConfigInputData,
  EndpointConfigSnapshot,
  IntegrationCategory,
  Resource,
  VmDatabaseConfig,
  VmDatabaseType,
} from '@/lib/types';
import { ProcessStatus } from '@/lib/types';

export interface AzureResourceCatalogItem {
  id: string;
  resourceId: string;
  name: string;
  resourceType: string;
  databaseType: DatabaseType;
  integrationCategory: IntegrationCategory;
  host: string | null;
  port: number | null;
  oracleServiceId: string | null;
  networkInterfaceId: string | null;
  ipConfigurationName: string | null;
  metadata: ConfirmResourceMetadata;
}

interface AzureApprovalHistoryEntry {
  request: {
    input_data?: ApprovalRequestInputSnapshot;
  };
}

type AzureSelectionSource =
  | 'catalog'
  | 'approval-history'
  | 'approved-integration'
  | 'confirmed-integration';

interface SelectedResourceState {
  databaseType?: DatabaseType;
  selectedCredentialId?: string;
  vmDatabaseConfig?: VmDatabaseConfig;
}

interface ResolvedSelectionState {
  source: AzureSelectionSource;
  selectedResources: Map<string, SelectedResourceState>;
}

export interface AzureResourceOwnershipInput {
  currentStep: ProcessStatus;
  catalog: AzureResourceCatalogItem[];
  latestApprovalRequest: AzureApprovalHistoryEntry | null;
  approvedIntegration: BffApprovedIntegration | null;
  confirmedIntegration: BffConfirmedIntegration;
}

export interface AzureResourceOwnershipResult {
  selectionSource: AzureSelectionSource;
  resources: Resource[];
}

const VM_DATABASE_TYPES: VmDatabaseType[] = [
  'MYSQL',
  'POSTGRESQL',
  'MSSQL',
  'MONGODB',
  'ORACLE',
];

const isVmDatabaseType = (databaseType: DatabaseType): databaseType is VmDatabaseType =>
  VM_DATABASE_TYPES.includes(databaseType as VmDatabaseType);

const isSelectedApprovalInput = (
  resourceInput: ApprovalRequestInputSnapshot['resource_inputs'][number],
): resourceInput is Extract<ApprovalRequestInputSnapshot['resource_inputs'][number], { selected: true }> =>
  resourceInput.selected;

const toVmDatabaseConfigFromEndpoint = (
  endpointConfig: EndpointConfigInputData | EndpointConfigSnapshot | undefined | null,
): VmDatabaseConfig | undefined => {
  if (!endpointConfig) return undefined;

  return {
    host: endpointConfig.host,
    databaseType: endpointConfig.db_type,
    port: endpointConfig.port,
    ...(endpointConfig.oracleServiceId ? { oracleServiceId: endpointConfig.oracleServiceId } : {}),
    ...(endpointConfig.selectedNicId ? { selectedNicId: endpointConfig.selectedNicId } : {}),
  };
};

const toVmDatabaseConfigFromCatalog = (
  resource: AzureResourceCatalogItem,
): VmDatabaseConfig | undefined => {
  if (resource.resourceType !== 'AZURE_VM') return undefined;
  if (!isVmDatabaseType(resource.databaseType) || resource.port === null) return undefined;

  return {
    databaseType: resource.databaseType,
    port: resource.port,
    ...(resource.host !== null ? { host: resource.host } : {}),
    ...(resource.oracleServiceId ? { oracleServiceId: resource.oracleServiceId } : {}),
    ...(resource.networkInterfaceId ? { selectedNicId: resource.networkInterfaceId } : {}),
  };
};

const toVmDatabaseConfigFromConfirmed = (
  resource: BffConfirmedIntegration['resource_infos'][number],
): VmDatabaseConfig | undefined => {
  if (resource.resource_type !== 'AZURE_VM') return undefined;
  if (!resource.database_type || !isVmDatabaseType(resource.database_type) || resource.port === null) {
    return undefined;
  }

  return {
    databaseType: resource.database_type,
    port: resource.port,
    ...(resource.host !== null ? { host: resource.host } : {}),
    ...(resource.oracle_service_id ? { oracleServiceId: resource.oracle_service_id } : {}),
    ...(resource.network_interface_id ? { selectedNicId: resource.network_interface_id } : {}),
  };
};

const buildSelectionFromApprovalHistory = (
  latestApprovalRequest: AzureApprovalHistoryEntry | null,
): Map<string, SelectedResourceState> => {
  const resourceInputs = latestApprovalRequest?.request.input_data?.resource_inputs;
  if (!resourceInputs || resourceInputs.length === 0) return new Map();

  const selectedInputs = resourceInputs
    .filter(isSelectedApprovalInput)
    .map((resourceInput) => [
      resourceInput.resource_id,
      {
        databaseType: resourceInput.resource_input?.endpoint_config?.db_type,
        selectedCredentialId: resourceInput.resource_input?.credential_id,
        vmDatabaseConfig: toVmDatabaseConfigFromEndpoint(resourceInput.resource_input?.endpoint_config),
      } satisfies SelectedResourceState,
    ] as const);

  return new Map(selectedInputs);
};

const buildSelectionFromApprovedIntegration = (
  approvedIntegration: BffApprovedIntegration | null,
): Map<string, SelectedResourceState> => {
  if (!approvedIntegration) return new Map();

  return new Map(
    approvedIntegration.resource_infos.map((resource) => [
      resource.resource_id,
      {
        databaseType: resource.endpoint_config?.db_type,
        selectedCredentialId: resource.credential_id ?? undefined,
        vmDatabaseConfig: toVmDatabaseConfigFromEndpoint(resource.endpoint_config),
      } satisfies SelectedResourceState,
    ]),
  );
};

const buildSelectionFromConfirmedIntegration = (
  confirmedIntegration: BffConfirmedIntegration,
): Map<string, SelectedResourceState> =>
  new Map(
    confirmedIntegration.resource_infos.map((resource) => [
      resource.resource_id,
      {
        databaseType: resource.database_type ?? undefined,
        selectedCredentialId: resource.credential_id ?? undefined,
        vmDatabaseConfig: toVmDatabaseConfigFromConfirmed(resource),
      } satisfies SelectedResourceState,
    ]),
  );

const resolveSelectionState = ({
  currentStep,
  latestApprovalRequest,
  approvedIntegration,
  confirmedIntegration,
}: Omit<AzureResourceOwnershipInput, 'catalog'>): ResolvedSelectionState => {
  const approvedSelection = buildSelectionFromApprovedIntegration(approvedIntegration);
  if (approvedSelection.size > 0) {
    return {
      source: 'approved-integration',
      selectedResources: approvedSelection,
    };
  }

  const approvalHistorySelection = buildSelectionFromApprovalHistory(latestApprovalRequest);
  if (currentStep === ProcessStatus.WAITING_APPROVAL && approvalHistorySelection.size > 0) {
    return {
      source: 'approval-history',
      selectedResources: approvalHistorySelection,
    };
  }

  const confirmedSelection = buildSelectionFromConfirmedIntegration(confirmedIntegration);
  if (confirmedSelection.size > 0) {
    return {
      source: 'confirmed-integration',
      selectedResources: confirmedSelection,
    };
  }

  return {
    source: 'catalog',
    selectedResources: new Map(),
  };
};

export const buildAzureOwnedResources = ({
  catalog,
  currentStep,
  latestApprovalRequest,
  approvedIntegration,
  confirmedIntegration,
}: AzureResourceOwnershipInput): AzureResourceOwnershipResult => {
  const { source, selectedResources } = resolveSelectionState({
    currentStep,
    latestApprovalRequest,
    approvedIntegration,
    confirmedIntegration,
  });

  return {
    selectionSource: source,
    resources: catalog.map((resource) => {
      const selectedState = selectedResources.get(resource.id);

      return {
        id: resource.id,
        type: resource.resourceType,
        resourceId: resource.resourceId,
        connectionStatus: selectedState ? 'CONNECTED' : 'PENDING',
        isSelected: selectedState !== undefined,
        databaseType: selectedState?.databaseType ?? resource.databaseType,
        integrationCategory: resource.integrationCategory,
        selectedCredentialId: selectedState?.selectedCredentialId,
        vmDatabaseConfig: selectedState?.vmDatabaseConfig ?? toVmDatabaseConfigFromCatalog(resource),
      };
    }),
  };
};
