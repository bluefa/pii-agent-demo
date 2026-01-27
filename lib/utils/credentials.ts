/**
 * 자격증명 관련 유틸리티
 */

import { DBCredential, DatabaseType } from '@/lib/types';

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
  credentials: DBCredential[] | undefined,
  databaseType: DatabaseType
): DBCredential[] => {
  return (credentials || []).filter((c) => c.databaseType === databaseType);
};

/**
 * 자격증명 ID로 자격증명을 찾습니다.
 *
 * @param credentials - 전체 자격증명 목록
 * @param credentialId - 찾을 자격증명 ID
 * @returns 찾은 자격증명 또는 undefined
 */
export const findCredentialById = (
  credentials: DBCredential[] | undefined,
  credentialId: string | null | undefined
): DBCredential | undefined => {
  if (!credentialId) return undefined;
  return (credentials || []).find((c) => c.id === credentialId);
};
