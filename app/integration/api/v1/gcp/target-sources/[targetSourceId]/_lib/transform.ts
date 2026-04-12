interface LegacyStepStatus {
  status: 'COMPLETED' | 'FAIL' | 'IN_PROGRESS' | 'SKIP';
  guide?: string | null;
}

interface LegacyGcpResource {
  resourceId: string;
  resourceName?: string;
  resourceType: 'CLOUD_SQL' | 'BIGQUERY';
  resourceSubType?: 'PRIVATE_IP_MODE' | 'BDC_PRIVATE_HOST_MODE' | 'PSC_MODE' | null;
  installationStatus: 'COMPLETED' | 'FAIL' | 'IN_PROGRESS';
  serviceSideSubnetCreation: LegacyStepStatus;
  serviceSideTerraformApply: LegacyStepStatus;
  bdcSideTerraformApply: LegacyStepStatus;
}

export interface LegacyGcpInstallationStatus {
  provider: 'GCP';
  resources: LegacyGcpResource[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

const buildLastCheck = (lastCheckedAt?: string, error?: { code: string; message: string }) => {
  if (!lastCheckedAt && !error) {
    return { status: 'NEVER_CHECKED' as const };
  }
  if (error) {
    return { status: 'FAILED' as const, checkedAt: lastCheckedAt, failReason: error.message };
  }
  return { status: 'COMPLETED' as const, checkedAt: lastCheckedAt };
};

const buildSummary = (resources: LegacyGcpResource[]) => {
  const totalCount = resources.length;
  const completedCount = resources.filter(r => r.installationStatus === 'COMPLETED').length;
  return { totalCount, completedCount, allCompleted: totalCount > 0 && completedCount === totalCount };
};

export const transformInstallationStatus = (legacy: LegacyGcpInstallationStatus) => ({
  lastCheck: buildLastCheck(legacy.lastCheckedAt, legacy.error),
  summary: buildSummary(legacy.resources),
  resources: legacy.resources.map((r) => ({
    resourceId: r.resourceId,
    resourceName: r.resourceName,
    resourceType: r.resourceType,
    resourceSubType: r.resourceSubType ?? null,
    installationStatus: r.installationStatus,
    serviceSideSubnetCreation: r.serviceSideSubnetCreation,
    serviceSideTerraformApply: r.serviceSideTerraformApply,
    bdcSideTerraformApply: r.bdcSideTerraformApply,
  })),
});
