import type { VmDatabaseType } from '@/lib/types';

export const VM_DATABASE_TYPES: { value: VmDatabaseType; label: string; icon: string }[] = [
  { value: 'MYSQL', label: 'MySQL', icon: '🐬' },
  { value: 'POSTGRESQL', label: 'PostgreSQL', icon: '🐘' },
  { value: 'MSSQL', label: 'SQL Server', icon: '🔷' },
  { value: 'MONGODB', label: 'MongoDB', icon: '🍃' },
  { value: 'ORACLE', label: 'Oracle', icon: '🔴' },
];

export const DEFAULT_PORTS: Record<VmDatabaseType, number> = {
  MYSQL: 3306,
  POSTGRESQL: 5432,
  MSSQL: 1433,
  MONGODB: 27017,
  ORACLE: 1521,
};

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
