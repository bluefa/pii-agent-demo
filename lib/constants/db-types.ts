import type { ProviderChipKey } from '@/lib/constants/provider-mapping';

/**
 * Supported DatabaseType per CSP — backend enum (owner-confirmed). Wire values are
 * lowercase; the label is display-only. Distinct from `DatabaseType` in lib/types.ts
 * (the cloud-resource taxonomy a scan returns).
 */
export type DbType =
  | 'mysql'
  | 'postgresql'
  | 'mariadb'
  | 'mssql'
  | 'dynamodb'
  | 'mongodb'
  | 'oracle'
  | 'cassandra'
  | 'elasticsearch'
  | 'redshift'
  | 'athena'
  | 'hanadb'
  | 'db2'
  | 'cockroachdb'
  | 'cosmosdb_nosql'
  | 'synapse'
  | 'bigquery';

export interface DbTypeDef {
  value: DbType;
  label: string;
}

/**
 * Wire value appended to `database_types` when the user says none of the listed
 * databases match. It is a contract value, not free text — the request enum
 * carries `others`, so there is nothing to type in.
 */
export const OTHERS_DB_TYPE = 'others';

const MYSQL: DbTypeDef = { value: 'mysql', label: 'MySQL' };
const POSTGRESQL: DbTypeDef = { value: 'postgresql', label: 'PostgreSQL' };
const MARIADB: DbTypeDef = { value: 'mariadb', label: 'MariaDB' };
const MSSQL: DbTypeDef = { value: 'mssql', label: 'MSSQL' };
const DYNAMODB: DbTypeDef = { value: 'dynamodb', label: 'DynamoDB' };
const MONGODB: DbTypeDef = { value: 'mongodb', label: 'MongoDB' };
const ORACLE: DbTypeDef = { value: 'oracle', label: 'Oracle' };
const CASSANDRA: DbTypeDef = { value: 'cassandra', label: 'Cassandra' };
const ELASTICSEARCH: DbTypeDef = { value: 'elasticsearch', label: 'Elasticsearch' };
const REDSHIFT: DbTypeDef = { value: 'redshift', label: 'Redshift' };
const ATHENA: DbTypeDef = { value: 'athena', label: 'Athena' };
const HANADB: DbTypeDef = { value: 'hanadb', label: 'HanaDB' };
const DB2: DbTypeDef = { value: 'db2', label: 'DB2' };
const COCKROACHDB: DbTypeDef = { value: 'cockroachdb', label: 'CockroachDB' };
const COSMOSDB_NOSQL: DbTypeDef = { value: 'cosmosdb_nosql', label: 'CosmosDB (NoSQL)' };
const SYNAPSE: DbTypeDef = { value: 'synapse', label: 'Synapse' };
const BIGQUERY: DbTypeDef = { value: 'bigquery', label: 'BigQuery' };

const AWS_DB_TYPES: readonly DbTypeDef[] = [
  MYSQL,
  POSTGRESQL,
  MARIADB,
  MSSQL,
  DYNAMODB,
  MONGODB,
  ORACLE,
  CASSANDRA,
  ELASTICSEARCH,
  REDSHIFT,
  ATHENA,
  HANADB,
  DB2,
  COCKROACHDB,
];

const AZURE_DB_TYPES: readonly DbTypeDef[] = [
  MYSQL,
  POSTGRESQL,
  MARIADB,
  MSSQL,
  MONGODB,
  ORACLE,
  CASSANDRA,
  ELASTICSEARCH,
  COSMOSDB_NOSQL,
  HANADB,
  DB2,
  SYNAPSE,
];

const GCP_DB_TYPES: readonly DbTypeDef[] = [MYSQL, POSTGRESQL, MARIADB, MSSQL, ORACLE, BIGQUERY];

// IDC = the AWS list without the AWS-managed analytics/NoSQL services.
const IDC_ONLY_DB_TYPES: readonly DbTypeDef[] = AWS_DB_TYPES.filter(
  (db) => db !== DYNAMODB && db !== REDSHIFT && db !== ATHENA,
);

// 기타 환경 has no confirmation list of its own — show every database the four
// CSP lists name, in the order they first appear.
const OTHER_DB_TYPES: readonly DbTypeDef[] = [
  ...AWS_DB_TYPES,
  ...AZURE_DB_TYPES,
  ...GCP_DB_TYPES,
  ...IDC_ONLY_DB_TYPES,
].filter((db, idx, all) => all.indexOf(db) === idx);

export const DB_TYPES_BY_PROVIDER: Record<ProviderChipKey, readonly DbTypeDef[]> = {
  aws: AWS_DB_TYPES,
  azure: AZURE_DB_TYPES,
  gcp: GCP_DB_TYPES,
  idc: IDC_ONLY_DB_TYPES,
  other: OTHER_DB_TYPES,
};

export const DB_TYPE_LABEL: Record<DbType, string> = OTHER_DB_TYPES.reduce(
  (acc, { value, label }) => ({ ...acc, [value]: label }),
  {} as Record<DbType, string>,
);
