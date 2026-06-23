/**
 * IDC Provider — BFF wire DTOs.
 *
 * Source of truth: `docs/swagger/install-v1.yaml`. These types mirror the wire
 * shape 1:1; the wire→domain conversion lives ONLY in `app/lib/api/idc.ts`, so a
 * response-shape change touches this file + that mapper and nothing else.
 *
 * Casing (ADR-019 D6 IDC carve-out): previous-request / installation-status are
 * raw snake passthrough; the NLB endpoints are raw camel passthrough (the
 * swagger authors those schemas camelCase on the wire). The mapper owns the
 * conversion — do not camelCase at the BFF layer for IDC.
 */

export type IdcInputFormatWire = 'IP' | 'HOST';

/** Domain-side label lookup only — swagger `database_type` is a plain string. */
export type IdcDatabaseTypeWire =
  | 'MYSQL'
  | 'POSTGRESQL'
  | 'ORACLE'
  | 'MSSQL'
  | 'MARIADB'
  | 'MONGODB'
  | 'REDIS';

// ---------------------------------------------------------------------------
// ADR-019 /install/v1 wire DTOs (verbatim from docs/swagger/install-v1.yaml).
// The IDC mapper (app/lib/api/idc.ts) owns the wire→domain conversion.
// ---------------------------------------------------------------------------

/** Shared 5-value install enum — all IDC install status/step fields use it. */
export type IdcInstallStatusWire =
  | 'COMPLETED'
  | 'FAIL'
  | 'IN_PROGRESS'
  | 'SKIP'
  | 'UNKNOWN';

/** swagger `IdcResourceInput` (previous-request item). `database_type` is a plain string. */
export interface IdcResourceInputWire {
  ips?: string[];
  host?: string;
  port?: number;
  selected?: boolean;
  input_format?: IdcInputFormatWire;
  database_type?: string;
  service_id?: string;
  credential_id?: string;
  exclusion_reason?: string;
}

/** 200 of getIdcPreviousRequest. */
export interface IdcPreviousRequestResponseWire {
  resources?: IdcResourceInputWire[];
}

/** swagger `CloudInstallationStepStatusDto`. */
export interface IdcStepStatusWire {
  status?: IdcInstallStatusWire;
  guide?: string;
}

/** swagger `IdcLastCheckDto`. */
export interface IdcLastCheckWire {
  status?: IdcInstallStatusWire;
  checked_at?: string;
  fail_reason?: string;
}

/** swagger `IdcResourceInstallationStatusDto`. */
export interface IdcResourceInstallationStatusWire {
  resource_id?: string;
  installation_status?: IdcInstallStatusWire;
  bdc_side_cx_terraform_apply?: IdcStepStatusWire;
  bdc_side_bdp_terraform_apply?: IdcStepStatusWire;
  firewall_check?: IdcStepStatusWire;
}

/** 200 of getIdcInstallationStatus. */
export interface IdcInstallationStatusResponseWire {
  last_check?: IdcLastCheckWire;
  resources?: IdcResourceInstallationStatusWire[];
}

/** 200 item of getOccupiedResources — camelCase ON THE WIRE (per swagger). */
export interface NlbOccupiedResourceResponseWire {
  serviceCode?: string;
  serviceName?: string;
  targetSourceId?: number;
  isLatest?: boolean;
  ipSet?: string[];
  port?: number;
  databaseType?: string;
  databaseName?: string;
}

/** 200 item of getNlbTable — camelCase ON THE WIRE (per swagger). */
export interface NlbTableResponseWire {
  nlbIndex?: number;
  nlbIpList?: string[];
  occupiedListenerCount?: number;
}
