import { describe, expect, it } from 'vitest';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { filterConfirmedRows } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

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

  it('does not mutate the input array', () => {
    filterConfirmedRows(rows, { ...none, query: 'orders' }, label);
    expect(rows).toHaveLength(3);
  });
});
