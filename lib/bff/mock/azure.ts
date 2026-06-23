import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as azureFns from '@/lib/mock-azure';
import { AZURE_ERROR_CODES } from '@/lib/constants/azure';

/**
 * Azure cloud-status mocks (ADR-019 Spec G). installation-status authors the
 * **swagger snake wire** `AzureInstallationStatusResponse` with `vm_installation`
 * embedded per resource (the real BFF returns the unified shape — the legacy
 * separate VM merge is gone). scan-app stays the sanctioned snake passthrough
 * (Issue #222). private-link-health-check (G8) is new; its wire is already
 * camelCase per swagger. Endpoints absent from install-v1.yaml (check-installation,
 * vm/*) were removed.
 */

const authorize = async (projectId: string) => {
  const user = await mockData.getCurrentUser();
  if (!user) {
    return { error: NextResponse.json(
      { error: AZURE_ERROR_CODES.UNAUTHORIZED.code, message: AZURE_ERROR_CODES.UNAUTHORIZED.message },
      { status: AZURE_ERROR_CODES.UNAUTHORIZED.status }
    ) };
  }

  const project = mockData.getProjectByTargetSourceId(Number(projectId));
  if (!project) {
    return { error: NextResponse.json(
      { error: AZURE_ERROR_CODES.NOT_FOUND.code, message: AZURE_ERROR_CODES.NOT_FOUND.message },
      { status: AZURE_ERROR_CODES.NOT_FOUND.status }
    ) };
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return { error: NextResponse.json(
      { error: AZURE_ERROR_CODES.FORBIDDEN.code, message: AZURE_ERROR_CODES.FORBIDDEN.message },
      { status: AZURE_ERROR_CODES.FORBIDDEN.status }
    ) };
  }

  return { project };
};

const handleResult = (result: { error?: { code: string; message: string; status: number }; data?: unknown }) => {
  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }
  return NextResponse.json(result.data);
};

export const mockAzure = {
  // GET …/azure/installation-status → AzureInstallationStatusResponse (snake wire).
  getInstallationStatus: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    const dbResult = azureFns.getAzureInstallationStatus(Number(projectId));
    if (dbResult.error) return handleResult(dbResult);
    const vmResult = azureFns.getAzureVmInstallationStatus(Number(projectId));
    const vmById = new Map((vmResult.data?.vms ?? []).map((vm) => [vm.vmId, vm]));

    const resources = (dbResult.data?.resources ?? []).map((r) => {
      const vm = vmById.get(r.resourceId);
      return {
        resource_id: r.resourceId,
        resource_name: r.resourceName,
        resource_type: r.resourceType,
        private_endpoint: r.privateEndpoint
          ? { id: r.privateEndpoint.id, name: r.privateEndpoint.name, status: r.privateEndpoint.status }
          : null,
        vm_installation: vm
          ? {
              subnet_exists: vm.subnetExists,
              // load_balancer passes through opaque (ADR-019 D2.3).
              load_balancer: { name: vm.loadBalancer.name, installed: vm.loadBalancer.installed },
            }
          : null,
      };
    });

    return NextResponse.json({
      last_check: {
        status: dbResult.data?.installed ? 'COMPLETED' : 'IN_PROGRESS',
        checked_at: '2026-06-23T10:00:00Z',
        fail_reason: null,
      },
      resources,
    });
  },

  getSubnetGuide: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return handleResult(azureFns.getAzureSubnetGuide(Number(projectId)));
  },

  // GET …/azure/scan-app → AzureServicePrincipalVerificationResponse (snake passthrough).
  getScanApp: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    const result = azureFns.getAzureServiceSettings(auth.project!.serviceCode);
    if (result.error) return handleResult(result);

    const scanApp = result.data!.scanApp;
    const data = scanApp.registered
      ? { app_id: scanApp.appId, status: scanApp.status ?? 'VALID', fail_reason: null, fail_message: null, last_verified_at: scanApp.lastVerifiedAt ?? new Date().toISOString() }
      : { app_id: null, status: 'UNVERIFIED', fail_reason: null, fail_message: null, last_verified_at: null };

    return NextResponse.json(data);
  },

  // GET /infra/…/azure-private-link-health-check → AzureHealthCheckResult (G8).
  // Wire is already camelCase per swagger.
  getPrivateLinkHealthCheck: async (projectId: string) => {
    const auth = await authorize(projectId);
    if (auth.error) return auth.error;

    return NextResponse.json({
      healthCheckStatus: 'HEALTHY',
      azurePrivateLinkHealthResultList: [
        {
          provisioningState: 'Succeeded',
          resourceId: `/subscriptions/${auth.project!.id}/privateEndpoints/pe-1`,
          privateLinkId: 'pls-1',
          resourceType: 'AZURE_PRIVATE_ENDPOINT',
          healthCheckStatus: 'HEALTHY',
        },
      ],
    });
  },
};
