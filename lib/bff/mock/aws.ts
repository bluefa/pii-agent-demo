import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import { consumeOpsRoleOverride } from '@/lib/bff/mock/ops';
import {
  awsWireSampleInstallationStatus,
  isAwsWireInstallSample,
} from '@/lib/bff/mock/aws-wire-sample';

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

    // Real-BFF capture, served verbatim (region-level Athena ids, null role_arn).
    if (isAwsWireInstallSample(Number(targetSourceId))) {
      return NextResponse.json(awsWireSampleInstallationStatus);
    }

    const completed = project.terraformState?.serviceTf === 'COMPLETED';

    // Derive per-resource step states from the project's selected resources so
    // resource_id joins against the confirmed integration (region/DB type in the
    // UI). While installing, seed a deterministic mix incl. SKIP / FAIL(guide) /
    // BDC_INSTALL_REQUIRED and one UNKNOWN (PLAN §4 requirement).
    const selected = project.resources.filter((r) => r.isSelected);
    const resources = selected.map((resource, index) => {
      if (completed) {
        return {
          resource_id: resource.resourceId,
          resource_name: null,
          installation_status: 'COMPLETED',
          service_terraform: { status: 'COMPLETED', guide: null },
          bdc_service_terraform: { status: 'COMPLETED', guide: null },
          bdc_common_terraform: { status: 'COMPLETED', guide: null },
        };
      }
      const service =
        index % 4 === 1 ? 'SKIP'
          : index % 4 === 3 ? 'FAIL'
            : index % 4 === 0 ? 'COMPLETED'
              : 'IN_PROGRESS';
      const serviceGuide =
        service === 'SKIP' ? '설치 대상이 아닌 리소스입니다 (Read Replica).'
          : service === 'FAIL' ? '서브넷 가용 IP 부족으로 ENI 생성에 실패했습니다. VPC 서브넷을 확인해 주세요.'
            : null;
      const bdcService =
        service === 'SKIP' ? 'SKIP'
          : service === 'COMPLETED' ? 'BDC_INSTALL_REQUIRED'
            // UNKNOWN seed (PLAN §4 requirement).
            : 'UNKNOWN';
      const bdcCommon = service === 'SKIP' ? 'SKIP' : index % 2 === 0 ? 'COMPLETED' : 'IN_PROGRESS';
      const overall =
        service === 'FAIL' ? 'FAIL'
          : service === 'SKIP' ? 'SKIP'
            : service === 'COMPLETED' && bdcService === 'BDC_INSTALL_REQUIRED' ? 'BDC_INSTALL_REQUIRED'
              : 'IN_PROGRESS';
      return {
        resource_id: resource.resourceId,
        resource_name: null,
        installation_status: overall,
        service_terraform: { status: service, guide: serviceGuide },
        bdc_service_terraform: {
          status: bdcService,
          guide: bdcService === 'BDC_INSTALL_REQUIRED' ? '서비스 측 적용 완료 후 자동 진행됩니다.' : null,
        },
        bdc_common_terraform: { status: bdcCommon, guide: null },
      };
    });

    return NextResponse.json({
      last_check: {
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        checked_at: '2026-06-23T10:00:00Z',
        fail_reason: null,
      },
      resources,
      terraform_execution_role_verify: {
        status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        role_arn: `arn:aws:iam::${project.awsAccountId ?? project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12)}:role/exec`,
      },
    });
  },

  // GET …/aws/verify-scan-role → AwsRoleVerificationResponse (snake wire).
  // An ARN saved via the assumed ops PUT overrides the seed; the first verify
  // after a save reports IN_PROGRESS (fresh ARN, not yet verified).
  verifyScanRole: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) return notFound();
    if (project.cloudProvider !== 'AWS') return notAws();

    const override = consumeOpsRoleOverride(Number(targetSourceId), 'scan');
    return NextResponse.json({
      status: override?.pending ? 'IN_PROGRESS' : 'VALID',
      role_arn: override?.roleArn
        ?? `arn:aws:iam::${project.awsAccountId ?? project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12)}:role/scan`,
      fail_reason: null,
      fail_message: null,
      last_verified_at: override?.pending ? null : '2026-06-23T10:00:00Z',
    });
  },

  // GET …/aws/verify-execution-role → AwsRoleVerificationResponse (snake wire).
  verifyExecutionRole: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) return notFound();
    if (project.cloudProvider !== 'AWS') return notAws();

    const override = consumeOpsRoleOverride(Number(targetSourceId), 'execution');
    return NextResponse.json({
      status: override?.pending ? 'IN_PROGRESS' : 'VALID',
      role_arn: override?.roleArn
        ?? `arn:aws:iam::${project.awsAccountId ?? project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12)}:role/exec`,
      fail_reason: null,
      fail_message: null,
      last_verified_at: override?.pending ? null : '2026-06-23T10:00:00Z',
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
