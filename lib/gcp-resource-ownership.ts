import type {
  ApprovalRequestInputSnapshot,
  BffApprovedIntegration,
  BffConfirmedIntegration,
  DatabaseType,
  Resource,
} from '@/lib/types';
import { ProcessStatus } from '@/lib/types';
import type { ConfirmResourceItem } from '@/app/lib/api';

interface GcpApprovalHistoryEntry {
  request: {
    input_data?: ApprovalRequestInputSnapshot;
  };
}

type GcpSelectionSource =
  | 'catalog'
  | 'project'
  | 'approval-history'
  | 'approved-integration'
  | 'confirmed-integration';

interface SelectedResourceState {
  databaseType?: DatabaseType;
  selectedCredentialId?: string;
}

interface ResolvedSelectionState {
  source: GcpSelectionSource;
  selectedResources: Map<string, SelectedResourceState>;
}

export interface GcpResourceOwnershipInput {
  currentStep: ProcessStatus;
  projectResources: Resource[];
  catalog: ConfirmResourceItem[];
  latestApprovalRequest: GcpApprovalHistoryEntry | null;
  approvedIntegration: BffApprovedIntegration | null;
  confirmedIntegration: BffConfirmedIntegration;
}

export interface GcpResourceOwnershipResult {
  selectionSource: GcpSelectionSource;
  resources: Resource[];
}

const isSelectedApprovalInput = (
  resourceInput: ApprovalRequestInputSnapshot['resource_inputs'][number],
): resourceInput is Extract<ApprovalRequestInputSnapshot['resource_inputs'][number], { selected: true }> =>
  resourceInput.selected;

const buildSelectionFromApprovalHistory = (
  latestApprovalRequest: GcpApprovalHistoryEntry | null,
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
      } satisfies SelectedResourceState,
    ]),
  );
};

const buildSelectionFromProjectResources = (
  projectResources: Resource[],
): Map<string, SelectedResourceState> =>
  new Map(
    projectResources
      .filter((resource) => resource.isSelected)
      .map((resource) => [
        resource.id,
        {
          databaseType: resource.databaseType,
          selectedCredentialId: resource.selectedCredentialId,
        } satisfies SelectedResourceState,
      ]),
  );

const buildSelectionFromConfirmedIntegration = (
  confirmedIntegration: BffConfirmedIntegration,
): Map<string, SelectedResourceState> =>
  new Map(
    confirmedIntegration.resource_infos.map((resource) => [
      resource.resource_id,
      {
        databaseType: resource.database_type ?? undefined,
        selectedCredentialId: resource.credential_id ?? undefined,
      } satisfies SelectedResourceState,
    ]),
  );

const resolveSelectionState = ({
  currentStep,
  projectResources,
  latestApprovalRequest,
  approvedIntegration,
  confirmedIntegration,
}: Omit<GcpResourceOwnershipInput, 'catalog'>): ResolvedSelectionState => {
  const approvedSelection = buildSelectionFromApprovedIntegration(approvedIntegration);
  if (approvedSelection.size > 0) {
    return {
      source: 'approved-integration',
      selectedResources: approvedSelection,
    };
  }

  const projectSelection = buildSelectionFromProjectResources(projectResources);
  if (
    (currentStep === ProcessStatus.WAITING_APPROVAL || currentStep === ProcessStatus.APPLYING_APPROVED)
    && projectSelection.size > 0
  ) {
    return {
      source: 'project',
      selectedResources: projectSelection,
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

  if (projectSelection.size > 0) {
    return {
      source: 'project',
      selectedResources: projectSelection,
    };
  }

  return {
    source: 'catalog',
    selectedResources: new Map(),
  };
};

export const buildGcpOwnedResources = ({
  projectResources,
  catalog,
  currentStep,
  latestApprovalRequest,
  approvedIntegration,
  confirmedIntegration,
}: GcpResourceOwnershipInput): GcpResourceOwnershipResult => {
  const { source, selectedResources } = resolveSelectionState({
    currentStep,
    projectResources,
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
      };
    }),
  };
};
