export type DbType =
  | 'mysql'
  | 'postgresql'
  | 'oracle'
  | 'mssql'
  | 'mariadb'
  | 'mongodb'
  | 'redis';

// Logical DB types the inf-registration modal exposes (v7 mockup phase-1 DB Type
// select). Distinct from `DatabaseType` (cloud-resource taxonomy: ATHENA, REDSHIFT,
// BIGQUERY, etc.) which lives in lib/types.ts.
export const DB_TYPES: Array<{ value: DbType; label: string }> = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'mssql', label: 'MSSQL' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'mongodb', label: 'MongoDB' },
  { value: 'redis', label: 'Redis' },
];

export const DB_TYPE_LABEL: Record<DbType, string> = DB_TYPES.reduce(
  (acc, { value, label }) => ({ ...acc, [value]: label }),
  {} as Record<DbType, string>,
);
