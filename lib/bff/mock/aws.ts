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

/**
 * 검증 실패 시나리오를 목에서 불러내는 방법 — 저장한 Role **이름**이 고른다.
 *
 * 목이 늘 VALID 만 돌려주면 판정 넷 중 하나만 볼 수 있어, 화면이 실제로 여섯 원인을
 * 구분하는지 확인할 길이 없다. 아래 표는 아무 대상에서나 원하는 코드를 불러내는 쪽이고
 * (운영 화면 [수정] → 이름에 키워드 → 저장; 저장 직후 재검증까지 같이 탄다),
 * 대상별 기본값은 DEMO_FAIL_BY_TARGET 이 정한다.
 *
 * 예) Scan Role 이름을 `bdc-scan-not-found` 로 저장 → ROLE_NOT_FOUND 로 검증된다.
 * 목록은 docs/redesign/ops-role-verification.md 참조.
 */
const DEMO_FAIL_BY_ROLE_NAME: ReadonlyArray<readonly [RegExp, string]> = [
  ['not-configured', 'ROLE_NOT_CONFIGURED'],
  ['bad-arn', 'INVALID_ROLE_ARN'],
  ['not-found', 'ROLE_NOT_FOUND'],
  ['scan-missing', 'SCAN_ROLE_NOT_CONFIGURED'],
  ['scan-denied', 'SCAN_ROLE_NOT_ASSUMABLE'],
  ['unavailable', 'ROLE_VERIFICATION_UNAVAILABLE'],
  // 매핑에 없는 코드도 화면이 삼키지 않는지 보려면 이것으로 저장한다.
  ['unknown-code', 'ROLE_SESSION_POLICY_DENIED'],
].map(([needle, reason]) => [new RegExp(needle, 'i'), reason] as const);

/**
 * 대상별 기본 시나리오 — 링크만으로 네 판정을 다 볼 수 있게 고정해 둔다. 나머지 AWS
 * 대상(1006·1007·1018 …)은 VALID 그대로라 행복 경로도 남는다. 이름 규칙(위)은 이
 * 표를 덮어쓰므로, 한 대상에서 여러 코드를 돌려 보는 것도 된다.
 */
const DEMO_FAIL_BY_TARGET: Readonly<Record<number, string>> = {
  1008: 'ROLE_NOT_CONFIGURED',
  1010: 'INVALID_ROLE_ARN',
  1011: 'ROLE_VERIFICATION_UNAVAILABLE',
  // 매핑에 없는 코드 — 화면이 status 로 판정하고 코드를 그대로 노출하는지 확인용.
  1012: 'ROLE_SESSION_POLICY_DENIED',
};

/** 판정 불가만 UNVERIFIED — 나머지는 확정적 구성 오류라 INVALID (계약 §상태와의 관계). */
const demoFailure = (
  roleArn: string | undefined,
  targetSourceId: number,
): { status: string; fail_reason: string } | null => {
  const byName = roleArn
    ? DEMO_FAIL_BY_ROLE_NAME.find(([pattern]) => pattern.test(roleArn))?.[1]
    : undefined;
  const reason = byName ?? DEMO_FAIL_BY_TARGET[targetSourceId];
  if (!reason) return null;
  return {
    status: reason === 'ROLE_VERIFICATION_UNAVAILABLE' ? 'UNVERIFIED' : 'INVALID',
    fail_reason: reason,
  };
};

/**
 * EC2 instances the scan "found" — the search-add flow's only source. Fixed rather than
 * derived from the project's resources: those are the DB services the scan proposes as
 * candidates, while this flow exists precisely for hosts the candidate list does NOT carry.
 */
const EC2_SCAN_RESULTS: readonly { instanceId: string; ip: string; scanVersion: number }[] = [
  { instanceId: 'i-0a1b2c3d4e5f67890', ip: '10.10.1.24', scanVersion: 12 },
  { instanceId: 'i-0a1b2c3d4e5f67891', ip: '10.10.1.87', scanVersion: 12 },
  { instanceId: 'i-0a4f8e2d1c9b70345', ip: '10.10.2.15', scanVersion: 12 },
  { instanceId: 'i-0b73d5a91e8c246f0', ip: '10.10.2.201', scanVersion: 11 },
  { instanceId: 'i-0c19f7be34d5a8021', ip: '10.20.0.33', scanVersion: 12 },
  { instanceId: 'i-0d82c46a5f109e7b3', ip: '10.20.0.140', scanVersion: 12 },
  { instanceId: 'i-0e5a90c17b4d32628', ip: '10.20.3.9', scanVersion: 10 },
  { instanceId: 'i-0f3b8d26c750a91e4', ip: '10.30.1.61', scanVersion: 12 },
  { instanceId: 'i-1a7c4e0938b2d65f1', ip: '10.30.1.118', scanVersion: 12 },
  { instanceId: 'i-1b6d2f85a04c39e7d', ip: '10.30.4.77', scanVersion: 11 },
];

const EC2_SEARCH_MAX_LIMIT = 100;

/** AWS's own naming: ip-10-20-0-33.ap-northeast-2.compute.internal. */
const privateDnsName = (ip: string): string =>
  `ip-${ip.replace(/\./g, '-')}.ap-northeast-2.compute.internal`;

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
    const roleArn = override?.roleArn
      ?? `arn:aws:iam::${project.awsAccountId ?? project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12)}:role/scan`;
    const failure = demoFailure(override?.roleArn, Number(targetSourceId));
    return NextResponse.json({
      status: failure?.status ?? (override?.pending ? 'IN_PROGRESS' : 'VALID'),
      // 미등록은 ARN 자체가 없다 — 그 외 실패는 등록값을 그대로 유지한다.
      role_arn: failure?.fail_reason === 'ROLE_NOT_CONFIGURED' ? null : roleArn,
      fail_reason: failure?.fail_reason ?? null,
      // deprecated — 신규 코드에는 싣지 않는다 (화면이 fail_reason 으로만 말하는지 본다).
      fail_message: null,
      last_verified_at: override?.pending && !failure ? null : '2026-06-23T10:00:00Z',
    });
  },

  // GET …/aws/verify-execution-role → AwsRoleVerificationResponse (snake wire).
  verifyExecutionRole: async (targetSourceId: string) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) return notFound();
    if (project.cloudProvider !== 'AWS') return notAws();

    const override = consumeOpsRoleOverride(Number(targetSourceId), 'execution');
    const roleArn = override?.roleArn
      ?? `arn:aws:iam::${project.awsAccountId ?? project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12)}:role/exec`;
    const failure = demoFailure(override?.roleArn, Number(targetSourceId));
    return NextResponse.json({
      status: failure?.status ?? (override?.pending ? 'IN_PROGRESS' : 'VALID'),
      // SCAN_ROLE_* 는 원인이 Scan Role 이므로 계약이 Terraform Role ARN 을 유지하라고
      // 못박았다 — 목도 그렇게 답해야 화면의 "이 ARN 은 원인이 아니다"가 검증된다.
      role_arn: failure?.fail_reason === 'ROLE_NOT_CONFIGURED' ? null : roleArn,
      fail_reason: failure?.fail_reason ?? null,
      fail_message: null,
      last_verified_at: override?.pending && !failure ? null : '2026-06-23T10:00:00Z',
    });
  },

  // GET …/ec2-resources/search?query=&limit= → CloudResourceResponse-shaped (snake wire).
  // Prefix match on the instance id; a blank query matches nothing (this is a search,
  // not a listing). `limit` is clamped to the contract's 1..100.
  searchEc2Resources: async (targetSourceId: string, query: string, limit: number) => {
    const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
    if (!project) return notFound();
    if (project.cloudProvider !== 'AWS') return notAws();

    const prefix = query.trim().toLowerCase();
    const size = Math.min(Math.max(Math.trunc(limit) || 1, 1), EC2_SEARCH_MAX_LIMIT);
    const matched = prefix
      ? EC2_SCAN_RESULTS.filter((instance) => instance.instanceId.toLowerCase().startsWith(prefix))
      : [];

    return NextResponse.json({
      resources: matched.slice(0, size).map((instance) => ({
        resource_id: instance.instanceId,
        resource_name: privateDnsName(instance.ip),
        resource_type: 'AWS_EC2_INSTANCE',
        metadata: {
          resource_type: 'AWS_EC2_INSTANCE',
          private_dns_name: privateDnsName(instance.ip),
          private_ip_address: instance.ip,
          scan_version: instance.scanVersion,
        },
      })),
      total_count: matched.length,
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
