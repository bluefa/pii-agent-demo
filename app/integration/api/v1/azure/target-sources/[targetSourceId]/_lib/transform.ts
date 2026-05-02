/**
 * Azure v1 라우트 공통 변환 유틸
 *
 * installation-status / check-installation 라우트에서 공유.
 * 레거시 DB/VM 응답을 Swagger v1 통합 스키마로 변환한다.
 */

import type {
  LegacyInstallationStatus,
  LegacyVmInstallationStatus,
} from '@/lib/bff/types/azure';

export type { LegacyInstallationStatus, LegacyVmInstallationStatus };

// ===== 변환 함수 =====

export const buildLastCheck = (last_checked_at?: string, error?: { code: string; message: string }) => {
  if (error) {
    return { status: 'FAILED' as const, checkedAt: last_checked_at, failReason: error.message };
  }
  return {
    status: 'IN_PROGRESS' as const,
    checkedAt: last_checked_at,
    failReason: null
  };
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
    (vmStatus?.vms ?? []).map(vm => [vm.vm_id, vm]),
  );

  const resources = dbStatus.resources.map(r => {
    const isVm = r.resource_type === 'AZURE_VM';
    const vm = isVm ? vmMap.get(r.resource_id) : undefined;

    const base = {
      resourceId: r.resource_id,
      resourceName: r.resource_name,
      resourceType: r.resource_type,
      privateEndpoint: r.private_endpoint
        ? {
            id: r.private_endpoint.id,
            name: r.private_endpoint.name,
            status: r.private_endpoint.status,
          }
        : {
            id: null,
            name: null,
            status: 'NOT_REQUESTED',
          },
      vmInstallation: null,
    };

    if (!vm) return base;

    // VM: PE 정보를 VM 쪽에서 가져오고, vmInstallation 추가
    return {
      ...base,
      privateEndpoint: vm.private_endpoint
        ? {
            id: vm.private_endpoint.id,
            name: vm.private_endpoint.name,
            status: vm.private_endpoint.status
          }
        : base.privateEndpoint,
      vmInstallation: {
        subnetExists: vm.subnet_exists,
        loadBalancer: {
          installed: vm.load_balancer.installed,
          name: vm.load_balancer.name || undefined,
        },
      },
    };
  });

  return {
    lastCheck: buildLastCheck(dbStatus.last_checked_at, dbStatus.error),
    resources,
  };
};
