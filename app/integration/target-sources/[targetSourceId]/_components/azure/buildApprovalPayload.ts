import type { Resource, VmDatabaseConfig } from '@/lib/types';
import type { ApprovalResourceInput, ApprovalResourceInputData } from '@/app/lib/api';

interface BuildApprovalPayloadInput {
  displayResources: Resource[];
  selectedIdSet: Set<string>;
  draftVmConfigs: Record<string, VmDatabaseConfig>;
  exclusionReasonDefault?: string;
}

const buildVmInput = (resource: Resource, vmConfig: VmDatabaseConfig): ApprovalResourceInputData => ({
  resource_id: resource.id,
  resource_type: resource.type,
  database_type: vmConfig.databaseType,
  port: vmConfig.port,
  host: vmConfig.host ?? '',
  ...(vmConfig.oracleServiceId ? { oracle_service_id: vmConfig.oracleServiceId } : {}),
  ...(vmConfig.selectedNicId ? { network_interface_id: vmConfig.selectedNicId } : {}),
});

export const buildApprovalResourceInputs = ({
  displayResources,
  selectedIdSet,
  draftVmConfigs,
  exclusionReasonDefault,
}: BuildApprovalPayloadInput): ApprovalResourceInput[] =>
  displayResources.map<ApprovalResourceInput>((resource) => {
    if (!selectedIdSet.has(resource.id)) {
      return {
        resource_id: resource.id,
        selected: false,
        ...(exclusionReasonDefault ? { exclusion_reason: exclusionReasonDefault } : {}),
      };
    }

    const vmConfig = draftVmConfigs[resource.id] ?? resource.vmDatabaseConfig;
    const resourceInput: ApprovalResourceInputData = vmConfig
      ? buildVmInput(resource, vmConfig)
      : {
        resource_id: resource.id,
        resource_type: resource.type,
        credential_id: resource.selectedCredentialId ?? '',
      };

    return { resource_id: resource.id, selected: true, resource_input: resourceInput };
  });
