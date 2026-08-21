/**
 * 리소스별 주간 DAG 표가 §10 응답 밖에서 빌려 오는 사실들 — 확정 정보(confirmed-integration)
 * 와 `resourceId` 로 조인한다.
 *
 * §10 이 리소스에 대해 보증하는 것은 `resourceId` 와 `gcpRegion` 뿐이다. 화면이 필요로 하는
 * 리전(비-GCP)·DatabaseType·IDC 접속 주소는 전부 확정 정보 쪽에만 있다. 그래서 이 조인은
 * **있으면 채우고 없으면 비우는** 성격이다 — 조인이 빗나가도 표는 지금과 같은 모습으로
 * 서고(대시), 없는 값을 지어내지 않는다.
 *
 * Athena 만 키가 둘이다: 확정 정보는 DB 단위 id(`athena:<acct>:<region>:<catalog>/<db>`)로,
 * step 4 이후의 결과는 전부 리전 단위 id(`athena:<acct>:<region>/<catalog>`)로 같은 리소스를
 * 부른다. 그 접기를 아는 함수는 이미 하나뿐이므로(`resultUnitId` — 연결 테스트·설치 상태가
 * 쓰는 그 키) 여기서도 그것만 쓴다. DB 단위 id 로 물어오는 경우도 대비해 그 키를 하나 더
 * 걸어 두지만, 어느 쪽으로 들어와도 답은 같은 행이다.
 */
import { resultUnitId } from '@/lib/resource-grouping';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';

export type ConfirmedIndex = ReadonlyMap<string, ConfirmedIntegrationResourceInfo>;

export interface AgentResourceFacts {
  /** 비-GCP 대상의 리전 — 확정 정보의 database_region. */
  region: string | null;
  /**
   * 확정 정보의 `database_type` 원문. 실 캡처는 소문자(`mysql`), 합성 목은 대문자로
   * 같은 값을 싣는다 — 표기를 고르는 것은 `getDatabaseShortLabel` 의 일이라 여기서는
   * 손대지 않는다(확정 정보 표와 같은 이름이 나와야 한다).
   */
  databaseType: string | null;
  /** IDC 접속 주소 한 줄 (`10.20.1.11:1521`). 클라우드 행에는 없다. */
  address: string | null;
  /** IP 가 여러 개인 IDC 행에서 첫 줄 뒤에 남은 개수. */
  moreAddresses: number;
}

export const EMPTY_FACTS: AgentResourceFacts = {
  region: null,
  databaseType: null,
  address: null,
  moreAddresses: 0,
};

export const indexConfirmedResources = (
  rows: readonly ConfirmedIntegrationResourceInfo[],
): ConfirmedIndex => {
  const index = new Map<string, ConfirmedIntegrationResourceInfo>();
  for (const row of rows) {
    // 먼저 들어온 행을 덮지 않는다 — 한 리전에 Athena DB 가 여럿이면 아무 행이나 대표로
    // 서는 것이고, 이 함수가 읽는 리전·타입은 그 리전 안에서 어차피 같은 값이다.
    const unitId = resultUnitId({
      resourceId: row.resource_id,
      athenaRegionResourceId: row.athena_region_resource_id,
    });
    if (unitId && !index.has(unitId)) index.set(unitId, row);
    if (unitId !== row.resource_id && row.resource_id && !index.has(row.resource_id)) {
      index.set(row.resource_id, row);
    }
  }
  return index;
};

/** IDC 접속 주소 — IP 모드면 ips, HOST 모드면 host, 둘 다 없으면 host 필드. */
const idcAddresses = (row: ConfirmedIntegrationResourceInfo): string[] => {
  const values =
    row.idc_host_format === 'IP'
      ? (row.idc_ips ?? [])
      : row.idc_host
        ? [row.idc_host]
        : row.host
          ? [row.host]
          : [];
  return values.filter((value) => value !== '');
};

export const agentResourceFacts = (
  resourceId: string,
  index: ConfirmedIndex | null,
): AgentResourceFacts => {
  const row = index?.get(resourceId);
  if (!row) return EMPTY_FACTS;
  const addresses = idcAddresses(row);
  const first = addresses[0] ?? null;
  return {
    region: row.database_region ?? null,
    databaseType: row.database_type ?? null,
    address: first === null ? null : row.port === null ? first : `${first}:${row.port}`,
    moreAddresses: Math.max(0, addresses.length - 1),
  };
};
