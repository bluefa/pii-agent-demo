import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as gcpFns from '@/lib/mock-gcp';
import { GCP_ERROR_CODES } from '@/lib/constants/gcp';

/**
 * GCP cloud-status mocks (ADR-019 Spec G). Handlers author the **swagger snake
 * wire** (PLAN P1 parity). installation-status drops summary / resource_type /
 * resource_sub_type and widens enums to the 5-value set incl. UNKNOWN; the
 * service-account handlers emit GcpServiceAccountInfoResponse (snake), not the
 * old { email, projectId, status:'ACTIVE' } stub.
 */

const authorize = async (projectId: string) => {
  const user = await mockData.getCurrentUser();
  if (!user) {
    return { error: NextResponse.json(
      { error: GCP_ERROR_CODES.UNAUTHORIZED.code, message: GCP_ERROR_CODES.UNAUTHORIZED.message },
      { status: GCP_ERROR_CODES.UNAUTHORIZED.status }
    ) };
  }

  const project = mockData.getProjectByTargetSourceId(Number(projectId));
  if (!project) {
    return { error: NextResponse.json(
      { error: GCP_ERROR_CODES.NOT_FOUND.code, message: GCP_ERROR_CODES.NOT_FOUND.message },
      { status: GCP_ERROR_CODES.NOT_FOUND.status }
    ) };
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return { error: NextResponse.json(
      { error: GCP_ERROR_CODES.FORBIDDEN.code, message: GCP_ERROR_CODES.FORBIDDEN.message },
      { status: GCP_ERROR_CODES.FORBIDDEN.status }
    ) };
  }

  return { user, project };
};

const snakeStep = (step: { status: string; guide?: string | null }) => ({
  status: step.status,
  guide: step.guide ?? null,
});

export const mockGcp = {
  // GET …/gcp/installation-status → GcpInstallationStatusResponse (snake wire).
  getInstallationStatus: async (projectId: string) => {
    const auth = await authorize(projectId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    const result = gcpFns.getGcpInstallationStatus(Number(projectId));
    if (result.error) {
      return NextResponse.json(
        { error: result.error.code, message: result.error.message },
        { status: result.error.status },
      );
    }

    const legacyResources = result.data?.resources ?? [];
    const resources = legacyResources.map((r, index) => ({
      resource_id: r.resourceId,
      resource_name: r.resourceName,
      // Seed one UNKNOWN (PLAN §4 requirement); rest carry the derived status.
      installation_status: index === 0 ? 'UNKNOWN' : r.installationStatus,
      service_side_subnet_creation: snakeStep(r.serviceSideSubnetCreation),
      service_side_terraform_apply: snakeStep(r.serviceSideTerraformApply),
      bdc_side_terraform_apply: snakeStep(r.bdcSideTerraformApply),
    }));

    return NextResponse.json({
      last_check: { status: 'COMPLETED', checked_at: '2026-06-23T10:00:00Z', fail_reason: null },
      resources,
    });
  },

  // GET …/gcp/scan-service-account → GcpServiceAccountInfoResponse (snake wire).
  getScanServiceAccount: async (targetSourceId: string) => {
    const auth = await authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    return NextResponse.json({
      gcp_project_id: `project-${targetSourceId}`,
      status: 'VALID',
      fail_reason: null,
      fail_message: null,
      last_verified_at: '2026-06-23T10:00:00Z',
    });
  },

  // GET …/gcp/terraform-service-account → GcpServiceAccountInfoResponse (snake wire).
  getTerraformServiceAccount: async (targetSourceId: string) => {
    const auth = await authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;

    return NextResponse.json({
      gcp_project_id: `project-${targetSourceId}`,
      status: 'VALID',
      fail_reason: null,
      fail_message: null,
      last_verified_at: '2026-06-23T10:00:00Z',
    });
  },
};
