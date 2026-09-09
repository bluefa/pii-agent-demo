// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmedResourceTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmedResourceTable';
import { required } from '@/lib/test-dom';
import type { ConfirmedResource } from '@/lib/types/resources';

const resource = (overrides: Partial<ConfirmedResource> = {}): ConfirmedResource => ({
  resourceId: 'arn:aws:rds:ap-northeast-2:acct:db:mysql-prod-01',
  type: 'AWS_DB_INSTANCE',
  databaseType: 'mysql',
  region: 'ap-northeast-2',
  resourceName: 'mysql-prod-01',
  host: null,
  port: null,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: null,
  connectionStatus: 'CONNECTED',
  ...overrides,
});

/**
 * The confirmed rows are database-level, exactly as the wire sends them: `resource_type` is
 * `AWS_ATHENA_DATABASE` and `database_type` is `athena`. Both spellings normalize into the
 * grouped set, so the tree keys on either — the table reads the engine one.
 */
const athena = (region: string, database: string): ConfirmedResource =>
  resource({
    resourceId: `athena:acct:${region}:AwsDataCatalog/${database}`,
    type: 'AWS_ATHENA_DATABASE',
    databaseType: 'athena',
    region,
    resourceName: database,
    athenaRegionResourceId: `athena:acct:${region}/AwsDataCatalog`,
  });

const columnKeys = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('thead th[data-col-key]')].map(
    (th) => th.dataset.colKey ?? '',
  );

const childBody = (region: string): HTMLElement =>
  required(
    document.getElementById(
      required(
        screen
          .getByRole('button', { name: new RegExp(`^Athena ${region} 그룹 `) })
          .getAttribute('aria-controls'),
        'the parent chevron aria-controls',
      ),
    ),
    `the ${region} group body`,
  );

describe('ConfirmedResourceTable — Athena group tree', () => {
  // 확정 응답 행은 Step 2·3 과 같은 DB 단위다. Step 6·7 은 리전 하나를 이미 한 행으로 접어
  // 넘기지만(foldedMembers), 여기는 응답 행 그대로라 부모/자식 트리가 맞는 모양이다.
  it('draws one parent per region over its databases, collapsed by default', () => {
    render(
      <ConfirmedResourceTable
        resources={[
          athena('us-east-1', 'default'),
          athena('ap-northeast-1', 'sampledb'),
          athena('ap-northeast-1', 'integration'),
        ]}
      />,
    );

    expect(
      screen
        .getAllByRole('button', { name: /그룹 (펼치기|접기)$/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Athena us-east-1 그룹 펼치기', 'Athena ap-northeast-1 그룹 펼치기']);
    expect(childBody('ap-northeast-1').hasAttribute('hidden')).toBe(true);
    expect(childBody('ap-northeast-1').querySelectorAll('tr')).toHaveLength(2);
  });

  // `plain` 은 열이 넷이다 — 여섯을 하드코딩해 두면 부모 행이 표 밖으로 두 칸 삐져나온다.
  it('spans the parent identity across the plain head’s four columns', () => {
    render(<ConfirmedResourceTable resources={[athena('us-east-1', 'default')]} />);
    expect(columnKeys()).toEqual(['name', 'id', 'dbType', 'region']);
    const parent = required(screen.getByText('Athena').closest('tr'), 'the group parent row');
    const cells = [...parent.querySelectorAll('td')];
    expect(cells).toHaveLength(1);
    expect(cells[0]?.getAttribute('colspan')).toBe('4');
  });

  it('says Database in the Database Type column of each child, keeps the region, drops the id', () => {
    render(
      <ConfirmedResourceTable
        resources={[athena('ap-northeast-1', 'sampledb'), athena('ap-northeast-1', 'integration')]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Athena ap-northeast-1 그룹 펼치기' }));

    const keys = columnKeys();
    const children = [...childBody('ap-northeast-1').querySelectorAll('tr')];
    expect(children).toHaveLength(2);
    for (const child of children) {
      const cells = [...child.querySelectorAll('td')];
      expect(cells).toHaveLength(keys.length);
      expect(cells[keys.indexOf('dbType')]?.textContent).toBe('Database');
      expect(cells[keys.indexOf('region')]?.textContent).toBe('ap-northeast-1');
      expect(cells[keys.indexOf('id')]?.textContent).toBe('');
    }
    expect(
      children.map((child) => child.querySelectorAll('td')[keys.indexOf('name')]?.textContent),
    ).toEqual(['sampledb', 'integration']);
  });

  // 그룹 하나가 한 페이지 칸이다 — 평평하게 자르면 데이터베이스가 페이지 경계에서 갈리고
  // 부모 행이 두 페이지에 그려진다. 기본 페이지 크기는 10.
  it('pages a group as ONE unit, so eleven databases of one region stay together', () => {
    const databases = Array.from({ length: 11 }, (_, i) => athena('us-east-1', `db_${i}`));
    render(<ConfirmedResourceTable resources={[...databases, resource()]} />);

    // 12 rows, 2 units — one group + one standalone — so there is only ever page 1.
    expect(screen.getByRole('button', { name: '1 페이지' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '2 페이지' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Athena us-east-1 그룹 펼치기' }));
    expect(childBody('us-east-1').querySelectorAll('tr')).toHaveLength(11);
    expect(screen.getByText('mysql-prod-01')).toBeTruthy();
  });

  // 검색이 닫힌 그룹 안의 데이터베이스에만 걸리면, 접힌 채로는 타이핑한 문자열이 화면
  // 어디에도 없다. 필터가 여는 동안 셰브런은 조용해진다.
  it('opens every group while the search owns the open state', () => {
    render(
      <ConfirmedResourceTable
        resources={[athena('ap-northeast-1', 'sampledb'), athena('ap-northeast-1', 'integration')]}
      />,
    );
    expect(childBody('ap-northeast-1').hasAttribute('hidden')).toBe(true);

    fireEvent.change(screen.getByLabelText('리소스 검색'), {
      target: { value: 'sampledb' },
    });
    expect(screen.queryByRole('button', { name: /그룹 (펼치기|접기)$/ })).toBeNull();
    expect(document.querySelector('tbody[hidden]')).toBeNull();
    expect(screen.getByText('sampledb')).toBeTruthy();
    expect(screen.queryByText('integration')).toBeNull();
  });

  // 그룹핑은 Athena 키다 — 나머지는 한 행이 한 리소스다.
  it('leaves non-Athena rows flat', () => {
    render(<ConfirmedResourceTable resources={[resource()]} />);
    expect(screen.queryByRole('button', { name: /그룹 (펼치기|접기)$/ })).toBeNull();
    expect(screen.getByText('mysql-prod-01')).toBeTruthy();
  });
});
