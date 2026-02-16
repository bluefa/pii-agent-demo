/**
 * Azure v1 라우트 공통 변환 유틸
 *
 * installation-status / check-installation 라우트에서 공유.
 * 레거시 DB/VM 응답을 Swagger v1 통합 스키마로 변환한다.
 */

// ===== Legacy 타입 (BFF 응답 형태) =====

export interface LegacyPrivateEndpoint {
  id: string;
  name: string;
  status: string;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

export interface LegacyResource {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  privateEndpoint: LegacyPrivateEndpoint;
}

export interface LegacyInstallationStatus {
  provider: string;
  installed: boolean;
  resources: LegacyResource[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

interface LegacyLoadBalancer {
  installed: boolean;
  name: string;
}

interface LegacyVmStatus {
  vmId: string;
  vmName: string;
  subnetExists: boolean;
  loadBalancer: LegacyLoadBalancer;
  privateEndpoint?: LegacyPrivateEndpoint;
}

export interface LegacyVmInstallationStatus {
  vms: LegacyVmStatus[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

// ===== 변환 함수 =====

export const buildLastCheck = (lastCheckedAt?: string, error?: { code: string; message: string }) => {
  if (error) {
    return { status: 'FAILED' as const, checkedAt: lastCheckedAt, failReason: error.message };
  }
  if (lastCheckedAt) {
    return { status: 'SUCCESS' as const, checkedAt: lastCheckedAt };
  }
  return { status: 'SUCCESS' as const };
};

/**
 * 레거시 DB + VM 응답을 v1 통합 리소스 배열로 변환.
 * VM 리소스에는 vmInstallation 필드를 병합한다.
 */
export const buildV1Response = (
  dbStatus: LegacyInstallationStatus,
  vmStatus: LegacyVmInstallationStatus | null,
) => {
  const vmMap = new Map(
    (vmStatus?.vms ?? []).map(vm => [vm.vmId, vm]),
  );

  const resources = dbStatus.resources.map(r => {
    const isVm = r.resourceType === 'AZURE_VM';
    const vm = isVm ? vmMap.get(r.resourceId) : undefined;

    const base = {
      resourceId: r.resourceId,
      resourceName: r.resourceName,
      resourceType: r.resourceType,
      isVm,
      privateEndpoint: {
        id: r.privateEndpoint.id,
        name: r.privateEndpoint.name,
        status: r.privateEndpoint.status,
      },
    };

    if (!vm) return base;

    // VM: PE 정보를 VM 쪽에서 가져오고, vmInstallation 추가
    return {
      ...base,
      privateEndpoint: vm.privateEndpoint
        ? { id: vm.privateEndpoint.id, name: vm.privateEndpoint.name, status: vm.privateEndpoint.status }
        : base.privateEndpoint,
      vmInstallation: {
        subnetExists: vm.subnetExists,
        loadBalancer: {
          installed: vm.loadBalancer.installed,
          name: vm.loadBalancer.name || undefined,
        },
      },
    };
  });

  return {
    hasVm: resources.some(r => r.isVm),
    lastCheck: buildLastCheck(dbStatus.lastCheckedAt, dbStatus.error),
    resources,
  };
};
