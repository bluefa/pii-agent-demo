import type {
  LegacyGcpInstallationStatus,
  LegacyGcpResource,
} from '@/lib/bff/types/gcp';

export type { LegacyGcpInstallationStatus };

const buildLastCheck = (last_checked_at?: string, error?: { code: string; message: string }) => {
  if (!last_checked_at && !error) {
    return { status: 'NEVER_CHECKED' as const };
  }
  if (error) {
    return { status: 'FAILED' as const, checkedAt: last_checked_at, failReason: error.message };
  }
  return { status: 'COMPLETED' as const, checkedAt: last_checked_at };
};

const buildSummary = (resources: LegacyGcpResource[]) => {
  const totalCount = resources.length;
  const completedCount = resources.filter(r => r.installation_status === 'COMPLETED').length;
  return { totalCount, completedCount, allCompleted: totalCount > 0 && completedCount === totalCount };
};

export const transformInstallationStatus = (legacy: LegacyGcpInstallationStatus) => ({
  lastCheck: buildLastCheck(legacy.last_checked_at, legacy.error),
  summary: buildSummary(legacy.resources),
  resources: legacy.resources.map((r) => ({
    resourceId: r.resource_id,
    resourceName: r.resource_name,
    resourceType: r.resource_type,
    resourceSubType: r.resource_sub_type ?? null,
    installationStatus: r.installation_status,
    serviceSideSubnetCreation: r.service_side_subnet_creation,
    serviceSideTerraformApply: r.service_side_terraform_apply,
    bdcSideTerraformApply: r.bdc_side_terraform_apply,
  })),
});
