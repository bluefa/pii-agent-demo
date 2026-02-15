/**
 * 자격증명 관련 유틸리티
 */

import { DatabaseType } from '@/lib/types';
import type { SecretKey } from '@/lib/types';

/**
 * 데이터베이스 타입별로 자격증명을 필터링합니다.
 *
 * @param credentials - 전체 자격증명 목록
 * @param databaseType - 필터링할 데이터베이스 타입
 * @returns 해당 타입의 자격증명 목록
 *
 * @example
 * const rdsCredentials = filterCredentialsByType(credentials, 'RDS');
 */
export const filterCredentialsByType = (
  credentials: SecretKey[] | undefined,
  databaseType: DatabaseType
): SecretKey[] => {
  return (credentials || []).filter((c) => c.labels?.databaseType === databaseType);
};

/**
 * 자격증명 name으로 자격증명을 찾습니다.
 *
 * @param credentials - 전체 자격증명 목록
 * @param name - 찾을 자격증명 name
 * @returns 찾은 자격증명 또는 undefined
 */
export const findCredentialByName = (
  credentials: SecretKey[] | undefined,
  name: string | null | undefined
): SecretKey | undefined => {
  if (!name) return undefined;
  return (credentials || []).find((c) => c.name === name);
};
