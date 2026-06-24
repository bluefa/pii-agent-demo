/**
 * IDC Provider — mock backend (in-memory).
 *
 * Returns the swagger wire shape so mock == contract (`docs/swagger/install-v1.yaml`):
 *   - previous-request / installation-status emit snake_case;
 *   - the NLB endpoints (in `lib/bff/mock/idc.ts`) emit camelCase (per swagger).
 * The NextResponse/auth wrapping lives in `lib/bff/mock/idc.ts`.
 *
 * `idcStore` is mock SERVER state keyed by targetSourceId — module-level is
 * correct here (it is the mock "database", not React UI state).
 */

import type {
  IdcInstallationStatusResponseWire,
  IdcResourceInputWire,
} from '@/lib/bff/types/idc';

export interface MockIdcError {
  code: string;
  message: string;
  status: number;
}
type MockIdcResult<T> = { data: T } | { error: MockIdcError };

const cloneSeed = (seed: IdcResourceInputWire[]): IdcResourceInputWire[] =>
  seed.map((r) => ({ ...r, ips: r.ips ? [...r.ips] : undefined }));

/**
 * "기존 연동 요청 정보 불러오기" preview — swagger `IdcResourceInput` rows
 * (no `name`/`resource_id`; `selected` carries the import-precheck state).
 */
export const IDC_PREV_REQUEST_SEED: IdcResourceInputWire[] = [
  { ips: ['10.20.30.40'], port: 3306, selected: true, input_format: 'IP', database_type: 'MYSQL' },
  { ips: ['10.20.31.10', '10.20.31.11'], port: 1521, selected: true, input_format: 'IP', database_type: 'ORACLE', service_id: 'ORCL' },
  { host: 'db.svc-a.io', port: 5432, selected: false, input_format: 'HOST', database_type: 'POSTGRESQL', exclusion_reason: 'StageDB' },
  { ips: ['10.20.32.7'], port: 3306, selected: true, input_format: 'IP', database_type: 'MYSQL' },
  { ips: ['10.20.32.8'], port: 27017, selected: true, input_format: 'IP', database_type: 'MONGODB' },
  { host: 'cache.svc-a.io', port: 6379, selected: false, input_format: 'HOST', database_type: 'REDIS', exclusion_reason: '캐시 전용 DB로 PII 데이터를 보관하지 않아 제외합니다.' },
  { ips: ['10.20.33.2'], port: 1433, selected: true, input_format: 'IP', database_type: 'MSSQL' },
];

/** Test/dev reset (kept for parity with the prior export; store below is stateless). */
export const resetIdcStore = (): void => {};

export const getIdcPreviousRequest = (
  _targetSourceId: number,
): MockIdcResult<{ resources: IdcResourceInputWire[] }> => ({
  data: { resources: cloneSeed(IDC_PREV_REQUEST_SEED) },
});

/**
 * Installation-status — new contract shape. resource_ids align with the seeded
 * IDC integration targets (lib/mock-data.ts IDC_DEMO_RESOURCES) so the Step 4
 * install cards aggregate over the same resources the confirmed table renders.
 * The second row is UNKNOWN (with a step-level UNKNOWN) so the →"작업중" mapping
 * is exercised; the rest COMPLETED.
 */
const IDC_INSTALL_RESOURCE_IDS = ['idc-res-001', 'idc-res-002', 'idc-res-003', 'idc-res-004', 'idc-res-005'];

export const getIdcInstallationStatus = (
  _targetSourceId: number,
): MockIdcResult<IdcInstallationStatusResponseWire> => ({
  data: {
    last_check: {
      status: 'IN_PROGRESS',
      checked_at: new Date().toISOString(),
    },
    resources: IDC_INSTALL_RESOURCE_IDS.map((resourceId, i) => ({
      resource_id: resourceId,
      installation_status: i === 1 ? 'UNKNOWN' : 'COMPLETED',
      bdc_side_cx_terraform_apply: { status: i === 1 ? 'IN_PROGRESS' : 'COMPLETED' },
      bdc_side_bdp_terraform_apply: { status: i === 1 ? 'UNKNOWN' : 'COMPLETED' },
      firewall_check: { status: i === 1 ? 'IN_PROGRESS' : 'COMPLETED' },
    })),
  },
});
