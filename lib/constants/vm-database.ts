import type { VmDatabaseType } from '@/lib/types';

export interface VmDatabaseTypeDef {
  /** Internal value; `toWireDatabaseType` lowercases it at the request boundary. */
  value: VmDatabaseType;
  label: string;
  /** Absent for engines that expose no fixed listener port (DynamoDB, Athena). */
  defaultPort?: number;
  /** Oracle-family engines need a SID alongside host/port. */
  requiresServiceId?: boolean;
}

export const VM_DATABASE_TYPES: readonly VmDatabaseTypeDef[] = [
  { value: 'MYSQL', label: 'MySQL', defaultPort: 3306 },
  { value: 'POSTGRESQL', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'MARIADB', label: 'MariaDB', defaultPort: 3306 },
  { value: 'MSSQL', label: 'SQL Server', defaultPort: 1433 },
  { value: 'DYNAMODB', label: 'DynamoDB' },
  { value: 'MONGODB', label: 'MongoDB', defaultPort: 27017 },
  { value: 'ORACLE', label: 'Oracle', defaultPort: 1521, requiresServiceId: true },
  { value: 'CASSANDRA', label: 'Cassandra', defaultPort: 9042 },
  { value: 'ELASTICSEARCH', label: 'Elasticsearch', defaultPort: 9200 },
  { value: 'REDSHIFT', label: 'Redshift', defaultPort: 5439 },
  { value: 'ATHENA', label: 'Athena' },
  { value: 'HANADB', label: 'HanaDB', defaultPort: 30015 },
  { value: 'DB2', label: 'DB2', defaultPort: 50000 },
  { value: 'COCKROACHDB', label: 'CockroachDB', defaultPort: 26257 },
  { value: 'TIBERO', label: 'Tibero', defaultPort: 8629, requiresServiceId: true },
] as const;

const BY_VALUE = new Map(VM_DATABASE_TYPES.map((type) => [type.value, type]));

export const vmDatabaseTypeByValue = (value: string): VmDatabaseTypeDef | undefined =>
  BY_VALUE.get(value);

/**
 * Default listener port per type. Derived from the catalog above so the two never drift;
 * portless engines are simply absent, so every read must tolerate `undefined`.
 */
export const DEFAULT_PORTS: Record<string, number> = Object.fromEntries(
  VM_DATABASE_TYPES.flatMap((type) =>
    type.defaultPort === undefined ? [] : [[type.value, type.defaultPort] as const],
  ),
);

/**
 * 포트 번호 유효성 검증 (1-65535)
 *
 * @returns 에러 메시지 또는 null (유효한 경우)
 */
export const validatePort = (value: string): string | null => {
  if (!value) return '포트를 입력해주세요';
  const portNum = parseInt(value, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) return '1-65535 범위';
  return null;
};
