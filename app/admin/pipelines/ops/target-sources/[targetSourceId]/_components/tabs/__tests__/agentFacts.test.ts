import { describe, it, expect } from 'vitest';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import {
  AWS_WIRE_CONFIRMED_ACCOUNT_ID,
  awsWireSampleConfirmedIntegration,
} from '@/lib/bff/mock/aws-wire-sample';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';
import {
  EMPTY_FACTS,
  agentResourceFacts,
  indexConfirmedResources,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/agentFacts';

const row = (
  over: Partial<ConfirmedIntegrationResourceInfo>,
): ConfirmedIntegrationResourceInfo => ({
  resource_id: 'r-1',
  resource_type: 'RDS',
  database_type: null,
  database_region: null,
  resource_name: null,
  port: null,
  host: null,
  oracle_service_id: null,
  network_interface_id: null,
  ip_configuration: null,
  credential_id: null,
  ...over,
});

describe('indexConfirmedResources', () => {
  it('Athena 는 리전 단위 id 로도 찾힌다 — 두 축이 같은 리소스를 다른 이름으로 부른다', () => {
    const athena = row({
      resource_id: 'athena:8046:us-east-1:AwsDataCatalog/logs',
      resource_type: 'AWS_ATHENA_DATABASE',
      database_type: 'ATHENA' as ConfirmedIntegrationResourceInfo['database_type'],
      database_region: 'us-east-1',
      athena_region_resource_id: 'athena:8046:us-east-1/AwsDataCatalog',
    });
    const index = indexConfirmedResources([athena]);
    expect(agentResourceFacts('athena:8046:us-east-1:AwsDataCatalog/logs', index).region).toBe(
      'us-east-1',
    );
    expect(agentResourceFacts('athena:8046:us-east-1/AwsDataCatalog', index).region).toBe(
      'us-east-1',
    );
  });

  it('실 캡처 — Athena 리전 두 개가 각자의 리전으로 풀린다', () => {
    // 합성 픽스처가 아니라 실제 BFF 응답 캡처로 건다. 이 캡처는 Athena DB 4건이
    // 리전 2개(us-east-1 · ap-northeast-1)에 흩어져 있어, 리전 단위 id 두 개가 서로
    // 다른 행을 찾아야만 표의 Region 열이 두 행을 가른다.
    const index = indexConfirmedResources(
      awsWireSampleConfirmedIntegration.resource_infos as ConfirmedIntegrationResourceInfo[],
    );
    const usEast = agentResourceFacts(`athena:${AWS_WIRE_CONFIRMED_ACCOUNT_ID}:us-east-1/AwsDataCatalog`, index);
    const apNe1 = agentResourceFacts(`athena:${AWS_WIRE_CONFIRMED_ACCOUNT_ID}:ap-northeast-1/AwsDataCatalog`, index);
    expect(usEast).toMatchObject({ region: 'us-east-1', databaseType: 'athena' });
    expect(apNe1).toMatchObject({ region: 'ap-northeast-1', databaseType: 'athena' });
  });

  it('리전 단위 키가 DB 단위 행을 덮지 않는다', () => {
    const first = row({ resource_id: 'athena:8046:us-east-1/AwsDataCatalog', database_region: 'us-east-1' });
    const second = row({
      resource_id: 'other',
      database_region: 'ap-northeast-2',
      athena_region_resource_id: 'athena:8046:us-east-1/AwsDataCatalog',
    });
    const index = indexConfirmedResources([first, second]);
    expect(agentResourceFacts('athena:8046:us-east-1/AwsDataCatalog', index).region).toBe('us-east-1');
  });
});

describe('agentResourceFacts', () => {
  it('조인이 빗나가면 아무 값도 지어내지 않는다', () => {
    const index = indexConfirmedResources([row({ resource_id: 'known', database_region: 'kr' })]);
    expect(agentResourceFacts('unknown', index)).toEqual(EMPTY_FACTS);
    expect(agentResourceFacts('known', null)).toEqual(EMPTY_FACTS);
  });

  it('IDC IP 모드 — 첫 주소에 포트를 붙이고 나머지는 개수로 센다', () => {
    const index = indexConfirmedResources([
      row({
        resource_id: 'idc-r-8f21',
        resource_type: 'IDC',
        database_type: 'ORACLE' as ConfirmedIntegrationResourceInfo['database_type'],
        port: 1521,
        idc_host_format: 'IP',
        idc_ips: ['10.20.1.11', '10.20.1.12', '10.20.1.13'],
      }),
    ]);
    expect(agentResourceFacts('idc-r-8f21', index)).toEqual({
      region: null,
      databaseType: 'ORACLE',
      address: '10.20.1.11:1521',
      moreAddresses: 2,
    });
  });

  it('IDC HOST 모드 — host 를 쓰고, idc_host 가 없으면 host 필드로 떨어진다', () => {
    const index = indexConfirmedResources([
      row({ resource_id: 'a', idc_host_format: 'HOST', idc_host: 'db.internal', port: 3306 }),
      row({ resource_id: 'b', host: 'legacy.internal', port: 5432 }),
    ]);
    expect(agentResourceFacts('a', index).address).toBe('db.internal:3306');
    expect(agentResourceFacts('b', index).address).toBe('legacy.internal:5432');
  });

  it('포트가 없으면 주소만 — 콜론만 남은 주소를 만들지 않는다', () => {
    const index = indexConfirmedResources([
      row({ resource_id: 'a', idc_host_format: 'IP', idc_ips: ['10.0.0.1'], port: null }),
    ]);
    expect(agentResourceFacts('a', index).address).toBe('10.0.0.1');
  });

  it('DatabaseType 은 원문 그대로 — 표기는 표가 getDatabaseShortLabel 로 고른다', () => {
    // 실 캡처는 소문자, 합성 목은 대문자로 같은 값을 싣는다. 여기서 한쪽으로 모으면
    // 확정 정보 표와 다른 이름이 나온다 — 두 표가 같은 함수를 거쳐야 같은 글자가 된다.
    const index = indexConfirmedResources([
      row({ resource_id: 'a', database_type: 'athena' as ConfirmedIntegrationResourceInfo['database_type'] }),
    ]);
    expect(agentResourceFacts('a', index).databaseType).toBe('athena');
    expect(getDatabaseShortLabel('athena')).toBe(getDatabaseShortLabel('ATHENA'));
  });

  it('클라우드 행은 주소가 없고 리전·타입만 온다', () => {
    const index = indexConfirmedResources([
      row({
        resource_id: 'arn:aws:rds:ap-northeast-2:8046:cluster:database-1',
        database_type: 'MYSQL' as ConfirmedIntegrationResourceInfo['database_type'],
        database_region: 'ap-northeast-2',
        host: '',
      }),
    ]);
    expect(agentResourceFacts('arn:aws:rds:ap-northeast-2:8046:cluster:database-1', index)).toEqual({
      region: 'ap-northeast-2',
      databaseType: 'MYSQL',
      address: null,
      moreAddresses: 0,
    });
  });
});
