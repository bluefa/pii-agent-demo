// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type {
  ProjectIdentity,
  TargetSourceIdentifier,
} from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';

/**
 * The layout is a sentinel, but it has to hand the identity back — the four facts the AWS
 * header states are built HERE, and nothing downstream can be asked what they were.
 */
const seen: { identity?: ProjectIdentity } = {};
vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout',
  () => ({
    CloudTargetSourceLayout: ({ identity }: { identity: ProjectIdentity }) => {
      seen.identity = identity;
      return <div data-testid="cloud-target-source-layout-sentinel" />;
    },
  }),
);

vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/common',
  async (importOriginal) => {
    const mod = await importOriginal<
      typeof import('@/app/target-sources/[targetSourceId]/_components/common')
    >();
    return {
      ...mod,
      ProjectPageMeta: () => null,
    };
  },
);

import { AwsProjectPage } from '@/app/target-sources/[targetSourceId]/_components/aws/AwsProjectPage';

const awsBaseFixture: CloudTargetSource = {
  isTerraformExecutionGranted: false,
  id: 'aws-proj-1',
  targetSourceId: 1008,
  projectCode: 'AWS-001',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
  processStatus: ProcessStatus.INSTALLING,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'AWS PII Agent - DB 연동',
  description: 'AWS RDS, EC2 리소스에 PII Agent 설치',
  isRejected: false,
  cloudProvider: 'AWS',
  awsAccountId: '123456789012',
};

const SCAN_ARN = 'arn:aws:iam::123456789012:role/BDCPIIInfraScanRole';
const TF_ARN = 'arn:aws:iam::123456789012:role/bdc-infra-terraform-worker-service-role';

const identityOf = (patch: Partial<CloudTargetSource>): ProjectIdentity => {
  const { unmount } = render(
    <AwsProjectPage project={{ ...awsBaseFixture, ...patch }} onProjectUpdate={() => {}} />,
  );
  const identity = seen.identity;
  unmount();
  if (!identity) throw new Error('identity was never handed to the layout');
  return identity;
};

const factNamed = (identity: ProjectIdentity, label: string): TargetSourceIdentifier => {
  const fact = identity.identifiers.find((it) => it.label === label);
  if (!fact) throw new Error(`no cell named ${label}`);
  return fact;
};

describe('AwsProjectPage routing', () => {
  it.each([
    ProcessStatus.WAITING_TARGET_CONFIRMATION,
    ProcessStatus.WAITING_APPROVAL,
    ProcessStatus.APPLYING_APPROVED,
    ProcessStatus.INSTALLING,
    ProcessStatus.WAITING_CONNECTION_TEST,
    ProcessStatus.CONNECTION_VERIFIED,
    ProcessStatus.INSTALLATION_COMPLETE,
  ])(
    'mounts CloudTargetSourceLayout for processStatus=%s',
    (status) => {
      render(
        <AwsProjectPage
          project={{ ...awsBaseFixture, processStatus: status }}
          onProjectUpdate={() => {}}
        />,
      );
      expect(screen.getByTestId('cloud-target-source-layout-sentinel')).toBeTruthy();
    },
  );
});

describe('AwsProjectPage — the four facts the header states', () => {
  it('names 계정 · 스캔 역할 · 테라폼 역할, and the mode beside them', () => {
    // 오너 2026-08-28. The labels are the ops vocabulary — identical to
    // `ROLE_META.scan.short` / `ROLE_META.execution.short` — without importing across the
    // layer, so both screens name the same role the same way.
    const identity = identityOf({ scanPrincipal: SCAN_ARN });
    expect(identity.identifiers.map((it) => it.label)).toEqual([
      '계정',
      '스캔 역할',
      '테라폼 역할',
    ]);
    expect(identity.installMode).toBe('manual');
    expect(factNamed(identity, '계정').value).toBe('123456789012');
  });

  it('prints a role by NAME and copies the whole ARN', () => {
    // The cell is 240px at most; the reader who needs the partition and the account has
    // the title and the copy button. `display` is the print form, `value` the evidence.
    const scan = factNamed(identityOf({ scanPrincipal: SCAN_ARN }), '스캔 역할');
    expect(scan.display).toBe('BDCPIIInfraScanRole');
    expect(scan.value).toBe(SCAN_ARN);
    expect(scan.mono).toBe(true);
  });

  it('says 미등록 rather than dropping the 스캔 역할 cell', () => {
    const scan = factNamed(identityOf({ scanPrincipal: undefined }), '스캔 역할');
    expect(scan.value).toBeNull();
    expect(scan.display).toBeUndefined();
    expect(scan.emptyText).toBe('미등록');
  });
});

/**
 * ⛔ The 테라폼 역할 cell renders in BOTH install modes. A cell that vanished under
 * 수동 설치 would make "there is no execution role" and "we have not read one yet" look
 * the same — and the whole point of the manual mode is that there is nothing to register.
 */
describe('AwsProjectPage — 테라폼 역할 in both modes', () => {
  it('auto: prints the registered role by name', () => {
    const tf = factNamed(
      identityOf({ isTerraformExecutionGranted: true, awsTerraformExecutionRoleArn: TF_ARN }),
      '테라폼 역할',
    );
    expect(tf.display).toBe('bdc-infra-terraform-worker-service-role');
    expect(tf.value).toBe(TF_ARN);
    expect(tf.emptyText).toBe('미등록');
  });

  it('auto with nothing registered: 미등록, and the cell stays', () => {
    const tf = factNamed(
      identityOf({ isTerraformExecutionGranted: true, awsTerraformExecutionRoleArn: undefined }),
      '테라폼 역할',
    );
    expect(tf.value).toBeNull();
    expect(tf.emptyText).toBe('미등록');
  });

  it('manual: 역할 불필요, with the reason in a title', () => {
    const tf = factNamed(identityOf({ isTerraformExecutionGranted: false }), '테라폼 역할');
    expect(tf.value).toBeNull();
    expect(tf.emptyText).toBe('역할 불필요');
    // Not 미등록: nothing is missing. A manual install runs the script directly, so there
    // is no Terraform execution to delegate and no role to register.
    expect(tf.emptyHint).toContain('수동 설치');
    expect(tf.emptyHint).toContain('Terraform');
    // ⛔ No copy button on an absence — `mono` drives that affordance.
    expect(tf.mono).toBeUndefined();
  });

  it('resolves the mode even when the wire said nothing (#640)', () => {
    // An account we were told nothing about is one nobody granted, i.e. manual install;
    // blanking the row on an absent key hid the mode.
    expect(identityOf({ isTerraformExecutionGranted: false }).installMode).toBe('manual');
    expect(identityOf({ isTerraformExecutionGranted: true }).installMode).toBe('auto');
  });
});
