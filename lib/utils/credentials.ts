/**
 * 자격증명 관련 유틸리티
 */

import type { SecretKey } from '@/lib/types';

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
