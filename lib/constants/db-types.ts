export type DbType = 'mysql' | 'mssql' | 'postgresql' | 'athena' | 'redshift' | 'bigquery';

export const DB_TYPES: Array<{ value: DbType; label: string }> = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'mssql', label: 'MSSQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'athena', label: 'Athena' },
  { value: 'redshift', label: 'Redshift' },
  { value: 'bigquery', label: 'BigQuery' },
];

export const DB_TYPE_LABEL: Record<DbType, string> = DB_TYPES.reduce(
  (acc, { value, label }) => ({ ...acc, [value]: label }),
  {} as Record<DbType, string>,
);
