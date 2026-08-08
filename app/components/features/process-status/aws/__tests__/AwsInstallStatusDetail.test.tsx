// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AwsInstallStatusDetail } from '@/app/components/features/process-status/aws/AwsInstallStatusDetail';
import type { ConfirmedResource } from '@/lib/types/resources';
import type {
  AwsInstallationStatus,
  AwsInstallResourceStatus,
  AwsInstallStepValue,
} from '@/lib/types';

const resource = (
  id: string,
  service: AwsInstallStepValue,
  overrides: Partial<AwsInstallResourceStatus> = {},
): AwsInstallResourceStatus => ({
  resourceId: id,
  resourceName: null,
  installationStatus: service,
  serviceTerraform: { status: service, guide: null },
  bdcServiceTerraform: { status: 'BDC_INSTALL_REQUIRED', guide: null },
  bdcCommonTerraform: { status: 'COMPLETED', guide: null },
  ...overrides,
});

const confirmedResource = (id: string): ConfirmedResource =>
  ({
    resourceId: id,
    type: 'RDS',
    databaseType: 'MYSQL',
    region: 'ap-northeast-2',
    resourceName: `name-of-${id}`,
    host: null,
    port: null,
    oracleServiceId: null,
    networkInterfaceId: null,
    ipConfigurationName: null,
  }) as ConfirmedResource;

const buildStatus = (
  resources: AwsInstallResourceStatus[],
  overrides: Partial<AwsInstallationStatus> = {},
): AwsInstallationStatus => ({
  lastCheck: { status: 'SUCCESS', checkedAt: '2026-07-29T14:02:00Z' },
  roleVerify: { status: 'COMPLETED', roleArn: 'arn:aws:iam::123456789012:role/exec' },
  resources,
  ...overrides,
});

describe('AwsInstallStatusDetail', () => {
  it('renders the grouped rail (내가 할 일 / BDC 자동 진행) and auto-selects the failed step', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'COMPLETED'), resource('r-2', 'FAIL', {
          serviceTerraform: { status: 'FAIL', guide: '서브넷 IP 부족' },
        })])}
        confirmed={[confirmedResource('r-1'), confirmedResource('r-2')]}
        manualInstall={false}
      />,
    );

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    expect(within(nav).getByText('설치 현황 요약')).toBeTruthy();
    expect(within(nav).getByText('Terraform 권한 부여 확인')).toBeTruthy();
    expect(within(nav).getByText('Terraform 자동 적용')).toBeTruthy();
    expect(within(nav).getByText('BDC 서비스 영역')).toBeTruthy();
    expect(within(nav).getByText('BDC 공통 영역')).toBeTruthy();
    // 그룹 레일 — 주체 구분은 헤더가 담당하고, 항목별 side 줄은 걷어냈다.
    // 권한 부여(todo)가 COMPLETED 라 남은 할 일은 0.
    expect(within(nav).getByText('내가 할 일 (0)')).toBeTruthy();
    expect(within(nav).getByText('BDC 자동 진행')).toBeTruthy();
    expect(within(nav).queryByText('서비스측')).toBeNull();
    expect(within(nav).queryByText('BDC측')).toBeNull();

    // No open todo → the failed step is the default view, and its table's 안내
    // chip is the single place the failure reason is stated.
    expect(screen.getAllByText('서브넷 IP 부족')).toHaveLength(1);
  });

  it('joins region / DB type / name from the confirmed integration', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')])}
        confirmed={[confirmedResource('r-1')]}
        manualInstall={false}
      />,
    );

    expect(screen.getByText('r-1')).toBeTruthy();
    expect(screen.getByText('name-of-r-1')).toBeTruthy();
    // Step 4 drops the Region / Database Type columns, so the joined attributes
    // surface through the toolbar filter rather than as cells.
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    const filters = screen.getByRole('group', { name: '필터 옵션' });
    expect(within(filters).getByText('ap-northeast-2')).toBeTruthy();
    expect(within(filters).getByText('MySQL')).toBeTruthy();
  });

  // The cluster tag rides the SAME join as region / DB type / name: the install status knows
  // only resource_id, and the type comes from the confirmed integration via InstallResourceMeta.
  it('tags an install row whose confirmed row is an RDS cluster', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-cluster', 'IN_PROGRESS')])}
        confirmed={[{ ...confirmedResource('r-cluster'), type: 'AWS_DB_CLUSTER' }]}
        manualInstall={false}
      />,
    );

    expect(screen.getByText('RDS Cluster')).toBeTruthy();
    expect(screen.getByText('name-of-r-cluster')).toBeTruthy();
  });

  it('leaves a single-instance install row untagged', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')])}
        confirmed={[confirmedResource('r-1')]}
        manualInstall={false}
      />,
    );

    expect(screen.queryByText('RDS Cluster')).toBeNull();
  });

  // A join MISS is normal here (region-level Athena ids never match a DB-level confirmed row).
  // The row must still render — without a name, region or tag, but not blank and not thrown.
  it('renders a row with no confirmed match, and does not tag it', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-unjoined', 'IN_PROGRESS')])}
        confirmed={[]}
        manualInstall={false}
      />,
    );

    expect(screen.getByText('r-unjoined')).toBeTruthy();
    expect(screen.queryByText('RDS Cluster')).toBeNull();
  });

  it('renders SKIP as 해당 없음 (both in rows and in the summary rollup)', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([
          resource('r-skip', 'SKIP', {
            installationStatus: 'SKIP',
            serviceTerraform: { status: 'SKIP', guide: '설치 대상이 아닌 리소스입니다.' },
            bdcServiceTerraform: { status: 'SKIP', guide: null },
            bdcCommonTerraform: { status: 'SKIP', guide: null },
          }),
          resource('r-run', 'IN_PROGRESS'),
        ])}
        confirmed={[]}
        manualInstall={false}
      />,
    );

    // default selection = service step (IN_PROGRESS present) → SKIP row visible.
    expect(screen.getAllByText('해당 없음').length).toBeGreaterThanOrEqual(1);
    // 안내 is the steps-2·3 reason chip, which clamps its summary — the full guide is in the tip.
    expect(screen.getByText(/설치 대상이 아닌/)).toBeTruthy();

    // 그룹 레일은 n/m 카운트를 쓰지 않는다 — 상태 단어만 남는다(오너 요청).
    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    expect(within(nav).queryByText('1/2')).toBeNull();
    expect(within(nav).getAllByText('진행중').length).toBeGreaterThanOrEqual(1);
  });

  it('fills Athena region rows from the confirmed DB rows of that region', () => {
    // installation-status reports Athena per region+catalog; confirmed-integration
    // is per database and links back via athena_region_resource_id.
    const regionId = 'athena:804656952396:us-east-1/AwsDataCatalog';
    const athenaDb: ConfirmedResource = {
      resourceId: 'athena:804656952396:us-east-1:AwsDataCatalog/default',
      type: 'AWS_ATHENA_DATABASE',
      databaseType: 'athena',
      region: 'us-east-1',
      resourceName: 'default',
      host: null,
      port: null,
      oracleServiceId: null,
      networkInterfaceId: null,
      ipConfigurationName: null,
      credentialId: null,
      athenaRegionResourceId: regionId,
      connectionStatus: 'CONNECTED',
    };

    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource(regionId, 'IN_PROGRESS', { resourceName: 'us-east-1' })])}
        confirmed={[athenaDb]}
        manualInstall={false}
      />,
    );

    // The region row takes its name from the wire row; the confirmed DB it joins to
    // supplies the attributes, which step 4 exposes through the filter (no columns).
    expect(screen.getByText('us-east-1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    const filters = screen.getByRole('group', { name: '필터 옵션' });
    expect(within(filters).getByText('Athena')).toBeTruthy();
    expect(within(filters).getByText('us-east-1')).toBeTruthy();
  });

  it('shows the role-verify panel (Role ARN, no resource table) when selected', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')])}
        confirmed={[]}
        manualInstall={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Terraform 권한 부여 확인/ }));
    expect(screen.getByText('arn:aws:iam::123456789012:role/exec')).toBeTruthy();
    expect(screen.getByText('검증 결과')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Region' })).toBeNull();
  });

  it('manual install hides the role-verify step and relabels the service step', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')])}
        confirmed={[]}
        manualInstall
      />,
    );

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    expect(within(nav).queryByText('Terraform 권한 부여 확인')).toBeNull();
    expect(within(nav).getByText('Terraform 직접 적용')).toBeTruthy();
  });

  it('paginates the resource table past 10 rows and has no 새로고침 control', () => {
    const many = Array.from({ length: 12 }, (_, i) => resource(`r-${i}`, 'IN_PROGRESS'));
    render(
      <AwsInstallStatusDetail
        status={buildStatus(many)}
        confirmed={[]}
        manualInstall={false}
      />,
    );

    // 10 per page → r-11 is on page 2.
    expect(screen.getByText('r-0')).toBeTruthy();
    expect(screen.queryByText('r-11')).toBeNull();
    expect(screen.queryByRole('button', { name: '새로고침' })).toBeNull();
  });
});
