import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';

/**
 * AWS cloud-status mocks (ADR-019 Spec G). Handlers author the **swagger snake
 * wire** so the mock exercises the same camelCaseKeys boundary as the real BFF
 * (PLAN P1 parity). Endpoints absent from install-v1.yaml (check-installation,
 * installation-mode, terraform-script JSON, verify-tf-role POST) were removed.
 */

const notFound = () =>
  NextResponse.json(
    { error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' },
    { status: 404 },
  );

const notAws = () =>
  NextResponse.json(
    { error: 'INVALID_PROVIDER', message: 'AWS 프로젝트가 아닙니다.' },
    { status: 400 },
  );

export const mockAws = {
  // GET …/aws/installation-status → AwsInstallationStatusResponse (snake wire).
  getInstallationStatus: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) return notFound();
    if (project.cloudProvider !== 'AWS') return notAws();

    const completed = project.terraformState?.serviceTf === 'COMPLETED';

    return NextResponse.json({
      last_check: {
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        checked_at: '2026-06-23T10:00:00Z',
        fail_reason: null,
      },
      resources: [
        {
          resource_id: `arn:aws:rds:ap-northeast-2:${project.id}:db/prod-mysql`,
          resource_name: 'prod-mysql',
          installation_status: completed ? 'COMPLETED' : 'IN_PROGRESS',
          service_terraform: { status: completed ? 'COMPLETED' : 'IN_PROGRESS', guide: null },
          bdc_service_terraform: { status: completed ? 'COMPLETED' : 'IN_PROGRESS', guide: null },
          bdc_common_terraform: { status: completed ? 'COMPLETED' : 'IN_PROGRESS', guide: null },
        },
        {
          resource_id: `arn:aws:rds:ap-northeast-2:${project.id}:db/stg-postgres`,
          resource_name: 'stg-postgres',
          installation_status: 'IN_PROGRESS',
          service_terraform: { status: 'IN_PROGRESS', guide: 'https://guide/aws/service-tf' },
          // UNKNOWN seed (PLAN §4 requirement).
          bdc_service_terraform: { status: 'UNKNOWN', guide: null },
          bdc_common_terraform: { status: 'UNKNOWN', guide: null },
        },
      ],
      terraform_execution_role_verify: {
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        role_arn: `arn:aws:iam::${project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12)}:role/exec`,
      },
    });
  },

  // GET …/aws/verify-scan-role → AwsRoleVerificationResponse (snake wire).
  verifyScanRole: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) return notFound();
    if (project.cloudProvider !== 'AWS') return notAws();

    return NextResponse.json({
      status: 'VALID',
      role_arn: `arn:aws:iam::${project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12)}:role/scan`,
      fail_reason: null,
      fail_message: null,
      last_verified_at: '2026-06-23T10:00:00Z',
    });
  },

  // GET …/aws/verify-execution-role → AwsRoleVerificationResponse (snake wire).
  verifyExecutionRole: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) return notFound();
    if (project.cloudProvider !== 'AWS') return notAws();

    return NextResponse.json({
      status: 'VALID',
      role_arn: `arn:aws:iam::${project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12)}:role/exec`,
      fail_reason: null,
      fail_message: null,
      last_verified_at: '2026-06-23T10:00:00Z',
    });
  },

  // GET …/aws/terraform-script/download → application/octet-stream (binary zip).
  // The mock-adapter returns this Response verbatim (getRaw parity); the route
  // streams the body + headers.
  getTerraformScript: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) return notFound();
    if (project.cloudProvider !== 'AWS') return notAws();

    // Minimal stand-in zip payload (PK\x03\x04 local-file-header magic).
    const body = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="terraform-${project.id}.zip"`,
      },
    });
  },
};
