/**
 * IDC Provider — constants & display↔wire maps.
 *
 * Values track `design/idc-flow-requirements.md` (결정 #) and the v15 HTML.
 * The DB-type list is HTML-first (7 types, §6 G5); wire enum + default port
 * follow 결정 #54.
 */

import type { IdcDatabaseTypeWire } from '@/app/lib/api/idc';

/** Max IP rows in the target form (결정 #52; yaml maxItems 3 → 6, §6 G2). */
export const IDC_MAX_IPS = 6;

/** Domain max length (결정 #56). */
export const IDC_DOMAIN_MAXLEN = 100;

/** Free-text exclusion reason max length (결정 #28). */
export const IDC_REASON_MAXLEN = 200;

/** Preset exclusion reasons (결정 #28). */
export const IDC_EXCL_PRESETS = ['임시DB', 'StageDB', 'DevDB'] as const;

/** Rows per page in the "load previous request" modal preview. */
export const IDC_LOAD_PER = 5;

/**
 * DB Type catalog — display label ↔ wire enum ↔ default port (결정 #54).
 * Order matches the v15 select. `requiresServiceId` gates the Oracle SID field.
 */
export interface IdcDbTypeDef {
  label: string;
  wire: IdcDatabaseTypeWire;
  defaultPort: number;
  requiresServiceId: boolean;
}

export const IDC_DB_TYPES: readonly IdcDbTypeDef[] = [
  { label: 'MySQL', wire: 'MYSQL', defaultPort: 3306, requiresServiceId: false },
  { label: 'PostgreSQL', wire: 'POSTGRESQL', defaultPort: 5432, requiresServiceId: false },
  { label: 'Oracle', wire: 'ORACLE', defaultPort: 1521, requiresServiceId: true },
  { label: 'MSSQL', wire: 'MSSQL', defaultPort: 1433, requiresServiceId: false },
  { label: 'MariaDB', wire: 'MARIADB', defaultPort: 3306, requiresServiceId: false },
  { label: 'MongoDB', wire: 'MONGODB', defaultPort: 27017, requiresServiceId: false },
  { label: 'Redis', wire: 'REDIS', defaultPort: 6379, requiresServiceId: false },
] as const;

const DB_TYPE_BY_LABEL = new Map(IDC_DB_TYPES.map((d) => [d.label, d]));
const DB_TYPE_BY_WIRE = new Map(IDC_DB_TYPES.map((d) => [d.wire, d]));

export const idcDbTypeByLabel = (label: string): IdcDbTypeDef | undefined =>
  DB_TYPE_BY_LABEL.get(label);

export const idcDbTypeByWire = (wire: IdcDatabaseTypeWire): IdcDbTypeDef | undefined =>
  DB_TYPE_BY_WIRE.get(wire);

/** Display label for a wire enum (falls back to the wire value). */
export const idcDbTypeLabel = (wire: IdcDatabaseTypeWire): string =>
  DB_TYPE_BY_WIRE.get(wire)?.label ?? wire;

/** Source IP column tooltip (header ⓘ, 결정 #19·40). `\n` splits paragraphs. */
export const IDC_SOURCE_IP_TOOLTIP =
  '방화벽 등록 필요\n' +
  'BDC Agent가 DB에 접근할 때 사용하는 출발지 IP예요. 서비스 측 방화벽에서 ' +
  'Source IP → 연동 대상(IP:Port) 허용 규칙을 등록해야 연결 테스트를 통과할 수 있어요.';

// --- validation (v15 validateIdcTargetForm) ---

/** IPv4 shape; octet range (≤255) is checked separately in `isValidIdcIp`. */
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** FQDN — at least one dot, alnum + hyphen labels. */
export const IDC_DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/** Trailing-whitespace guard (결정 #35 — paste hazard). */
export const IDC_TRAILING_WS_RE = /\s$/;

export const isValidIdcIp = (value: string): boolean => {
  const m = IPV4_RE.exec(value.trim());
  return !!m && m.slice(1).every((octet) => Number(octet) <= 255);
};
