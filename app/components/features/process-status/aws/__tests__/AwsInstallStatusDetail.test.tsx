// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// 권한 패널은 마운트되는 순간 실시간 검증을 부른다 — 그 오퍼레이션이 이 스위트의
// 유일한 네트워크 의존이라 모듈째 세운다(TF 스크립트 다운로드도 같은 모듈).
vi.mock('@/app/lib/api/aws', () => ({
  getAwsRoleVerification: vi.fn(),
  getAwsTerraformScript: vi.fn(),
}));

import { AwsInstallStatusDetail } from '@/app/components/features/process-status/aws/AwsInstallStatusDetail';
import { getAwsRoleVerification } from '@/app/lib/api/aws';
import { required } from '@/lib/test-dom';
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
  beforeEach(() => {
    // 검증을 통과한 기본값 — 사유 블록이 그려지지 않으므로 다른 케이스의 단언을 흐리지 않는다.
    vi.mocked(getAwsRoleVerification).mockReset();
    vi.mocked(getAwsRoleVerification).mockResolvedValue({ status: 'VALID' });
  });

  it('renders the grouped rail (내가 할 일 / BDC 진행) and auto-selects the failed step', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'COMPLETED'), resource('r-2', 'FAIL', {
          serviceTerraform: { status: 'FAIL', guide: '서브넷 IP 부족' },
        })])}
        confirmed={[confirmedResource('r-1'), confirmedResource('r-2')]}
        manualInstall={false}
        targetSourceId={1008}
        awsAccountId={null}
      />,
    );

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    // The grouped rail has no summary step — the rail lists the steps directly.
    expect(within(nav).queryByText('설치 현황 요약')).toBeNull();
    // 트레이 제목은 없다 — 카드 헤더('Agent 설치')가 이미 한 말이라 두 제목이 겹쳤다.
    // 조회 시각도 여기 없다: 짝을 잃은 한 줄로 프레임 위에 뜨는 대신 카드 헤더로
    // 올라갔고(LastCheckStamp), 그 자리는 이 컴포넌트가 아니라 호출자가 그린다.
    expect(screen.queryByText('설치 진행 상황')).toBeNull();
    expect(screen.queryByText(/^마지막 확인/)).toBeNull();
    expect(within(nav).getByText('Terraform 권한 부여 확인')).toBeTruthy();
    expect(within(nav).getByText('서비스 측 Terraform 자동 적용')).toBeTruthy();
    expect(within(nav).getByText('BDC 서비스 영역')).toBeTruthy();
    expect(within(nav).getByText('BDC 공통 영역')).toBeTruthy();
    // Grouped rail — the group headers carry ownership; per-item side lines are gone.
    // The role-verify todo is COMPLETED, so the open-todo count is 0.
    expect(within(nav).getByText('내가 할 일 (0)')).toBeTruthy();
    // 할 일 0 은 그룹 라벨이 한 마디로 닫는다 — 항목 자리에 문단을 뿌리지 않는다.
    expect(within(nav).getByText('모두 완료')).toBeTruthy();
    expect(within(nav).queryByText(/지금 하실 일이 없어요/)).toBeNull();
    expect(within(nav).getByText('BDC 진행')).toBeTruthy();
    expect(within(nav).queryByText('서비스측')).toBeNull();
    expect(within(nav).queryByText('BDC측')).toBeNull();
    // 레일 푸터(진행바+요약)는 오너 결정으로 삭제됐다.
    expect(within(nav).queryByText('2개 중 1개 완료')).toBeNull();

    // No open todo → the failed step is the default view. Its table's 안내 chip used to
    // be the single place the failure reason was stated; that column is gone (owner
    // instruction, 2026-08-24, every provider) and nothing replaced it — the grouped
    // rail here never mounts InstallStatusDetail's alternate summary/action-item view
    // (every step declares `group`) — so the reason text no longer renders at all.
    expect(screen.queryByText('서브넷 IP 부족')).toBeNull();
  });

  it('할 일이 남아 있으면 "모두 완료"를 달지 않는다', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')], {
          roleVerify: { status: 'IN_PROGRESS', roleArn: null },
        })}
        confirmed={[]}
        manualInstall={false}
        targetSourceId={1008}
        awsAccountId={null}
      />,
    );

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    expect(within(nav).getByText('내가 할 일 (1)')).toBeTruthy();
    expect(within(nav).queryByText('모두 완료')).toBeNull();
  });

  it('joins region / DB type / name from the confirmed integration', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')])}
        confirmed={[confirmedResource('r-1')]}
        manualInstall={false}
        targetSourceId={1008}
        awsAccountId={null}
      />,
    );

    expect(screen.getByText('r-1')).toBeTruthy();
    expect(screen.getByText('name-of-r-1')).toBeTruthy();
    // The cloud install shape carries Database Type / Region again (owner instruction,
    // 2026-08-24), so the joined attributes are cells AND filter options — the filter
    // offers exactly the values the columns print.
    const row = required(screen.getByText('name-of-r-1').closest('tr'), 'the install row');
    const cells = within(row).getAllByRole('cell');
    expect(cells[2].textContent).toBe('MySQL');
    expect(cells[3].textContent).toBe('ap-northeast-2');
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
        awsAccountId={null}
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
        awsAccountId={null}
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
        awsAccountId={null}
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
        awsAccountId={null}
      />,
    );

    // default selection = service step (IN_PROGRESS present) → SKIP row visible.
    expect(screen.getAllByText('해당 없음').length).toBeGreaterThanOrEqual(1);
    // 안내 column removed 2026-08-24 (owner instruction, every provider) — guide text
    // stays on the wire (serviceTerraform.guide) but no longer renders anywhere on this
    // screen. The grouped rail (every step here declares `group`) also never mounts
    // InstallStatusDetail's alternate summary/action-item view, so this is a genuine
    // absence, not a gap this test happens to miss.
    expect(screen.queryByText(/설치 대상이 아닌/)).toBeNull();

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
        awsAccountId={null}
      />,
    );

    // The wire names this row `us-east-1` — the region, which the Region column now says
    // one cell over. The row stands for that region's CATALOG, so the name is read out of
    // the id (`athena:<acct>:<region>/<catalog>`) instead and the region is said once.
    const row = required(screen.getByText('AwsDataCatalog').closest('tr'), 'the Athena row');
    const cells = within(row).getAllByRole('cell');
    // name · id · Database Type · Region · 상태. The name cell holds the catalog and the tag
    // that says whose catalog it is; the region appears once, in its own column.
    expect(cells[0].textContent).not.toContain('us-east-1');
    expect(within(cells[0]).getByText('Athena')).toBeTruthy();
    expect(cells[3].textContent).toBe('us-east-1');
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    const filters = screen.getByRole('group', { name: '필터 옵션' });
    expect(within(filters).getByText('Athena')).toBeTruthy();
    expect(within(filters).getByText('us-east-1')).toBeTruthy();
  });

  it('shows the role-verify panel (검증 대상 + 지금 확인, no resource table) when selected', async () => {
    vi.mocked(getAwsRoleVerification).mockResolvedValue({
      status: 'INVALID',
      fail_reason: 'SCAN_ROLE_NOT_ASSUMABLE',
      role_arn: 'arn:aws:iam::123456789012:role/exec',
      last_verified_at: '2026-07-29T14:00:00Z',
    });

    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')])}
        confirmed={[]}
        manualInstall={false}
        targetSourceId={1008}
        awsAccountId="123456789012"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Terraform 권한 부여 확인/ }));
    // 무엇을 검증했는지가 먼저다 — 계정과 Role 이 있어야 사용자가 자기 콘솔에서
    // 무엇을 열어야 할지 안다.
    expect(screen.getByText('123456789012')).toBeTruthy();
    expect(screen.getByText('arn:aws:iam::123456789012:role/exec')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Region' })).toBeNull();

    // 사유는 설치 상태가 아니라 실시간 검증이 갖고 있다 — 여섯 코드 중 하나를 문장으로.
    expect(await screen.findByText(/Scan Role 을 넘겨받지 못했습니다/)).toBeTruthy();
    expect(screen.getByText('등록된 Terraform Role ARN 은 원인이 아닙니다.')).toBeTruthy();
    // 검증이 끝나야 버튼이 다시 눌린다 — 그 전에는 '확인 중...' 으로 잠겨 있다.
    expect(screen.getByRole('button', { name: '지금 확인' })).toBeTruthy();
  });

  it('manual install hides the role-verify step and relabels the service step', () => {
    render(
      <AwsInstallStatusDetail
        status={buildStatus([resource('r-1', 'IN_PROGRESS')])}
        confirmed={[]}
        manualInstall
        targetSourceId={1008}
        awsAccountId={null}
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
        awsAccountId={null}
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
        awsAccountId={null}
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
        awsAccountId={null}
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
        awsAccountId={null}
      />,
    );

    // 10 per page → r-11 is on page 2.
    expect(screen.getByText('r-0')).toBeTruthy();
    expect(screen.queryByText('r-11')).toBeNull();
    expect(screen.queryByRole('button', { name: '새로고침' })).toBeNull();
  });
});
