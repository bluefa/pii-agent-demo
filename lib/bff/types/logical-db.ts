/**
 * Logical DB (Step 5 modal) — BFF wire DTOs (snake_case).
 *
 * Source of truth: `docs/swagger/install-v1.yaml` (schemas
 * SkipLogicalDatabaseItem / UpdateSkipLogicalDatabaseRequest /
 * SkipLogicalDatabaseResponse / TestedLogicalDatabaseItem /
 * TestedLogicalDatabasesResponse). These mirror the wire shape 1:1.
 *
 * Casing (ADR-019 D1/D2): GET responses are camelCased once at the CSR
 * boundary (`fetchInfraCamelJson` + a hand-written normalizer in
 * `lib/logical-db-response.ts`). The PUT request body
 * (`UpdateSkipLogicalDatabaseRequest`) is authored snake to match swagger.
 *
 * Two list fields are deliberately distinct and MUST NOT be unified:
 *   Tested   → `logical_database_list`
 *   Excluded → `skip_logical_database_list`
 * `skip_reason` lives only on the Excluded item; `TEMP`, not `TMP`.
 */

/** Row kind, shared by both families (swagger enum). */
export type LogicalDbTypeWire = 'DATABASE' | 'SCHEMA';

/** Skip-policy reason — Excluded item only. ⚠ `TEMP`, not `TMP`. */
export type SkipReasonWire = 'STG' | 'DEV' | 'TEMP';

/**
 * Item of `TestedLogicalDatabasesResponse.logical_database_list`.
 * swagger marks NOTHING required on this schema — every field is optional.
 */
export interface TestedLogicalDatabaseItemWire {
  database_name?: string;
  schema_name?: string;
  type?: LogicalDbTypeWire;
}

/** 200 of getTestedLogicalDatabases / …ByResourceId. List NOT required. */
export interface TestedLogicalDatabasesResponseWire {
  logical_database_list?: TestedLogicalDatabaseItemWire[];
}

/**
 * Item of the skip policy. swagger requires `database_name`, `skip_reason`,
 * `type`; `schema_name` is present only on SCHEMA rows.
 */
export interface SkipLogicalDatabaseItemWire {
  database_name: string;
  schema_name?: string;
  skip_reason: SkipReasonWire;
  type: LogicalDbTypeWire;
}

/** Request body of updateExcludedLogicalDatabases / …ByResourceId. Full replace. */
export interface UpdateSkipLogicalDatabaseRequestWire {
  skip_logical_database_list: SkipLogicalDatabaseItemWire[];
}

/** 200 of getExcludedLogicalDatabases / PUT / …ByResourceId. List NOT required. */
export interface SkipLogicalDatabaseResponseWire {
  skip_logical_database_list?: SkipLogicalDatabaseItemWire[];
}
