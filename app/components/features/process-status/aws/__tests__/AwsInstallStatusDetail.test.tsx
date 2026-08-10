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
  it('renders the grouped rail (내가 할 일 / BDC 진행) and auto-selects the failed step', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'COMPLETED'), resource('r-2', 'FAIL', {
          serviceTerraform: { status: 'FAIL', guide: '서브넷 IP 부족' },
        })])}
        confirmed={[confirmedResource('r-1'), confirmedResource('r-2')]}
        manualInstall={false}
        targetSourceId={1008}
      />,
    );

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    // The grouped rail has no summary step — the rail lists the steps directly.
    expect(within(nav).queryByText('설치 현황 요약')).toBeNull();
    expect(screen.getByText('설치 진행 상황')).toBeTruthy();
    expect(within(nav).getByText('Terraform 권한 부여 확인')).toBeTruthy();
    expect(within(nav).getByText('서비스 측 Terraform 자동 적용')).toBeTruthy();
    expect(within(nav).getByText('BDC 서비스 영역')).toBeTruthy();
    expect(within(nav).getByText('BDC 공통 영역')).toBeTruthy();
    // Grouped rail — the group headers carry ownership; per-item side lines are gone.
    // The role-verify todo is COMPLETED, so the open-todo count is 0.
    expect(within(nav).getByText('내가 할 일 (0)')).toBeTruthy();
    expect(within(nav).getByText('BDC 진행')).toBeTruthy();
    expect(within(nav).queryByText('서비스측')).toBeNull();
    expect(within(nav).queryByText('BDC측')).toBeNull();
    // 레일 푸터(진행바+요약)는 오너 결정으로 삭제됐다.
    expect(within(nav).queryByText('2개 중 1개 완료')).toBeNull();

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
        targetSourceId={1008}
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
        targetSourceId={1008}
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
        targetSourceId={1008}
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
        targetSourceId={1008}
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
        targetSourceId={1008}
      />,
    );

    // default selection = service step (IN_PROGRESS present) → SKIP row visible.
    expect(screen.getAllByText('해당 없음').length).toBeGreaterThanOrEqual(1);
    // 안내 is the steps-2·3 reason chip, which clamps its summary — the full guide is in the tip.
    expect(screen.getByText(/설치 대상이 아닌/)).toBeTruthy();

    // The grouped rail drops n/m counts — only the status words remain.
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
        targetSourceId={1008}
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
        targetSourceId={1008}
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
        targetSourceId={1008}
      />,
    );

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    expect(within(nav).queryByText('Terraform 권한 부여 확인')).toBeNull();
    expect(within(nav).getByText('Terraform 직접 적용')).toBeTruthy();

    // 무게는 텍스트 링크까지다(오너 지시) — 단계 헤더에 h40 다운로드 버튼을 얹지 않고
    // 참고 항목으로 보낸다. 다만 안내는 단계 안에 남아야 한다.
    expect(screen.queryByRole('button', { name: 'Terraform Script 다운로드' })).toBeNull();
    expect(screen.getByText(/에서 스크립트를 내려받을 수 있습니다/)).toBeTruthy();

    const [toScript] = screen
      .getAllByRole('button', { name: 'Terraform Script' })
      .filter((b) => !nav.contains(b));
    fireEvent.click(toScript);
    expect(screen.getByRole('button', { name: 'Terraform Script 다운로드' })).toBeTruthy();
  });

  it('자동 설치의 단계 헤더에도 다운로드 CTA 가 없다 — 적용 주체가 BDC다', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')])}
        confirmed={[]}
        manualInstall={false}
        targetSourceId={1008}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Terraform Script 다운로드' })).toBeNull();
  });

  it('자동 설치의 서비스 단계는 참고 항목을 역참조한다 — 링크로 참고 패널이 열린다', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')])}
        confirmed={[]}
        manualInstall={false}
        targetSourceId={1008}
      />,
    );

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    fireEvent.click(within(nav).getByText('서비스 측 Terraform 자동 적용'));
    expect(screen.getByText(/에서 자세한 설치 사항을 확인할 수 있습니다/)).toBeTruthy();

    const [back] = screen
      .getAllByRole('button', { name: 'Terraform Script' })
      .filter((b) => !nav.contains(b));
    fireEvent.click(back);
    expect(screen.getByRole('button', { name: 'Terraform Script 다운로드' })).toBeTruthy();
  });

  it('설치 스크립트 · Terraform Script 는 단계가 아니다 — 상태도 기본 선택도 없고, 눌러야 열린다', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'COMPLETED')])}
        confirmed={[]}
        manualInstall={false}
        targetSourceId={1008}
      />,
    );

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    expect(within(nav).getByText('설치 스크립트')).toBeTruthy();

    // 상태 글자를 갖지 않는다 — 제목 한 줄이 전부다.
    const item = within(nav).getByText('Terraform Script');
    expect(item.closest('button')?.textContent).toBe('Terraform Script');

    // 기본 선택은 진행 중인 단계지 참고 항목이 아니다.
    expect(screen.queryByRole('button', { name: 'Terraform Script 다운로드' })).toBeNull();

    fireEvent.click(item);
    expect(screen.getByRole('button', { name: 'Terraform Script 다운로드' })).toBeTruthy();

    // 설명 앞머리의 단계 이름은 점프 링크다 — 누르면 그 단계가 열린다.
    const [jump] = screen
      .getAllByRole('button', { name: '서비스 측 Terraform 자동 적용' })
      .filter((b) => !nav.contains(b));
    fireEvent.click(jump);
    expect(screen.queryByRole('button', { name: 'Terraform Script 다운로드' })).toBeNull();
    expect(screen.getByText(/리소스별 Private Endpoint/)).toBeTruthy();
  });

  it('paginates the resource table past 10 rows and has no 새로고침 control', () => {
    const many = Array.from({ length: 12 }, (_, i) => resource(`r-${i}`, 'IN_PROGRESS'));
    render(
      <AwsInstallStatusDetail
        status={buildStatus(many)}
        confirmed={[]}
        manualInstall={false}
        targetSourceId={1008}
      />,
    );

    // 10 per page → r-11 is on page 2.
    expect(screen.getByText('r-0')).toBeTruthy();
    expect(screen.queryByText('r-11')).toBeNull();
    expect(screen.queryByRole('button', { name: '새로고침' })).toBeNull();
  });
});
