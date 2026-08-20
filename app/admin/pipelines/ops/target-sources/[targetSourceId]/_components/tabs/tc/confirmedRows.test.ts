import { describe, expect, it } from 'vitest';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import {
  filterConfirmedRows,
  toConfirmedUnits,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const row = (
  resourceId: string,
  resourceName: string | null,
  databaseType: string,
  region: string | null,
): ConfirmedIntegrationResourceItem =>
  ({
    resource_id: resourceId,
    resource_name: resourceName,
    database_type: databaseType,
    database_region: region,
  }) as ConfirmedIntegrationResourceItem;

// The label the table prints — filtering compares against this, not the wire value (mysql).
const label = (item: ConfirmedIntegrationResourceItem): string =>
  item.database_type === 'mysql' ? 'MySQL' : 'DynamoDB';

const rows = [
  row('arn:aws:rds:ap-northeast-2:1:cluster:orders', 'orders-prod', 'mysql', 'ap-northeast-2'),
  row('arn:aws:dynamodb:us-east-1:1:table/carts', 'carts-prod', 'dynamodb', 'us-east-1'),
  row('arn:aws:rds:us-east-1:1:cluster:payments', null, 'mysql', 'us-east-1'),
];

const none = { query: '', dbType: '', region: '' };
const ids = (list: readonly ConfirmedIntegrationResourceItem[]) =>
  list.map((item) => item.resource_name ?? item.resource_id);

describe('filterConfirmedRows', () => {
  it('returns every row when no condition is set', () => {
    expect(filterConfirmedRows(rows, none, label)).toHaveLength(rows.length);
  });

  it('matches the search against Resource Name AND Resource ID', () => {
    expect(ids(filterConfirmedRows(rows, { ...none, query: 'carts-prod' }, label))).toEqual([
      'carts-prod',
    ]);
    expect(ids(filterConfirmedRows(rows, { ...none, query: 'cluster:payments' }, label))).toEqual([
      'arn:aws:rds:us-east-1:1:cluster:payments',
    ]);
  });

  it('ignores case and surrounding whitespace in the search', () => {
    expect(ids(filterConfirmedRows(rows, { ...none, query: '  ORDERS-PROD  ' }, label))).toEqual([
      'orders-prod',
    ]);
  });

  it('filters on the label the table prints, not the wire value', () => {
    expect(ids(filterConfirmedRows(rows, { ...none, dbType: 'MySQL' }, label))).toEqual([
      'orders-prod',
      'arn:aws:rds:us-east-1:1:cluster:payments',
    ]);
    // The wire value matches nothing — the option must be the cell's own string.
    expect(filterConfirmedRows(rows, { ...none, dbType: 'mysql' }, label)).toEqual([]);
  });

  it('narrows by every set condition at once', () => {
    expect(
      ids(filterConfirmedRows(rows, { query: 'cluster', dbType: 'MySQL', region: 'us-east-1' }, label)),
    ).toEqual(['arn:aws:rds:us-east-1:1:cluster:payments']);
  });

  /**
   * An IDC row carries no name, and the table does not print its id — its address is the
   * only identity on the screen, so a box matching name+id alone could not find any row
   * the operator was actually looking at.
   */
  it('matches an IDC row on the address the table shows', () => {
    const idcRows = [
      {
        resource_id: 'idc-ivt-9a01',
        resource_name: null,
        database_type: 'mysql',
        database_region: null,
        idc_host_format: 'HOST',
        idc_host: 'db-mysql.ivt.prod.internal',
      },
      {
        resource_id: 'idc-ivt-9a02',
        resource_name: null,
        database_type: 'mysql',
        database_region: null,
        idc_host_format: 'IP',
        idc_ips: ['10.20.4.11'],
      },
    ] as unknown as ConfirmedIntegrationResourceItem[];

    expect(ids(filterConfirmedRows(idcRows, { ...none, query: 'db-mysql' }, label))).toEqual([
      'idc-ivt-9a01',
    ]);
    expect(ids(filterConfirmedRows(idcRows, { ...none, query: '10.20.4.11' }, label))).toEqual([
      'idc-ivt-9a02',
    ]);
  });

  it('does not mutate the input array', () => {
    filterConfirmedRows(rows, { ...none, query: 'orders' }, label);
    expect(rows).toHaveLength(3);
  });
});

/**
 * 표 한 행 = 결과가 보고되는 단위. Athena 만 리전으로 접히고, 나머지는 자기 자신이다.
 * 이 접기가 없으면 확정 행(DB 단위 id)이 결과(리전 단위 id)에 영영 닿지 못한다.
 */
const athenaDb = (region: string, db: string): ConfirmedIntegrationResourceItem =>
  ({
    resource_id: `athena:1:${region}:AwsDataCatalog/${db}`,
    resource_name: db,
    database_type: 'athena',
    database_region: region,
    athena_region_resource_id: `athena:1:${region}/AwsDataCatalog`,
  }) as ConfirmedIntegrationResourceItem;

describe('toConfirmedUnits', () => {
  it('folds one region의 데이터베이스 전부를 리전 결과 키 한 단위로', () => {
    const units = toConfirmedUnits([
      athenaDb('ap-northeast-1', 'sampledb'),
      athenaDb('ap-northeast-1', 'integration'),
    ]);
    expect(units).toHaveLength(1);
    expect(units[0].unitId).toBe('athena:1:ap-northeast-1/AwsDataCatalog');
    expect(units[0].folded).toBe(true);
    expect(units[0].members.map((m) => m.resource_name)).toEqual(['sampledb', 'integration']);
  });

  it('리전이 다르면 다른 단위이고, Athena 가 아닌 행은 자기 id 를 그대로 쓴다', () => {
    const units = toConfirmedUnits([
      rows[0],
      athenaDb('us-east-1', 'default'),
      athenaDb('ap-northeast-1', 'sampledb'),
    ]);
    expect(units.map((unit) => unit.unitId)).toEqual([
      rows[0].resource_id,
      'athena:1:us-east-1/AwsDataCatalog',
      'athena:1:ap-northeast-1/AwsDataCatalog',
    ]);
    expect(units[0].folded).toBe(false);
    expect(units[0].members).toEqual([rows[0]]);
  });
});
