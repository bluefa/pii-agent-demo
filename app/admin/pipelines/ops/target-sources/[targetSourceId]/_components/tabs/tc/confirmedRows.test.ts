import { describe, expect, it } from 'vitest';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { toConfirmedUnits } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

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

const rows = [
  row('arn:aws:rds:ap-northeast-2:1:cluster:orders', 'orders-prod', 'mysql', 'ap-northeast-2'),
  row('arn:aws:dynamodb:us-east-1:1:table/carts', 'carts-prod', 'dynamodb', 'us-east-1'),
  row('arn:aws:rds:us-east-1:1:cluster:payments', null, 'mysql', 'us-east-1'),
];

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
