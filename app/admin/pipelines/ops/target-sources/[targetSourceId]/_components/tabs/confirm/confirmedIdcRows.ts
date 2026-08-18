import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

const strings = (values: ReadonlyArray<string | null | undefined> | null | undefined): string[] =>
  (values ?? []).filter((value): value is string => value != null && value !== '');

/**
 * 확정 응답의 IDC 리소스 → 연동 요청 표가 읽는 행.
 *
 * 두 계약은 IDC 사실을 같은 이름으로 싣는다 — `ResourceConfigDto` 와
 * `TargetSourceResourceMetadataDto` 둘 다 idc_host_format·idc_ips·idc_host·
 * idc_source_ips·port·oracle_service_id·nlb_index 다. 그래서 확정 정보를 요청과 **같은
 * 표**로 보여 줄 수 있고, 그러라고 이 매퍼가 있다.
 *
 * 확정된 행은 전부 연동 대상이다 — 제외는 확정 이전 단계에서 갈린다. RDS 클러스터
 * 필드는 IDC 에 없으므로 비운다.
 */
export function confirmedToIdcRows(
  rows: readonly ConfirmedIntegrationResourceInfo[],
): RequestResourceRow[] {
  return rows.map((row) => {
    const format = row.idc_host_format ?? null;
    return {
      resourceId: row.resource_id || null,
      resourceName: row.resource_name ?? null,
      selected: true,
      exclusionReason: null,
      integrationCategory: null,
      recommendFailReason: null,
      databaseType: row.database_type ?? null,
      region: row.database_region ?? null,
      idcKind: format,
      // 주소는 요청 표와 같은 규칙이다: IP 모드면 ips, HOST 모드면 host. idc_* 가 하나도
      // 없는 행(계약상 전부 optional)은 `host` 로 떨어진다 — 그 경우 확정 응답이 접속
      // 주소에 대해 말하는 유일한 필드다.
      connectTargets:
        format === 'IP'
          ? strings(row.idc_ips)
          : format === 'HOST'
            ? strings([row.idc_host])
            : strings([row.host]),
      port: row.port ?? null,
      oracleSid: row.oracle_service_id ?? null,
      sourceIps: strings(row.idc_source_ips),
      nlbIndex: row.nlb_index ?? null,
      resourceType: row.resource_type ?? null,
      rdsInstanceCandidates: [],
      selectedRdsInstanceResourceId: null,
    };
  });
}
