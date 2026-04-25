import { AppError } from '@/lib/errors';

export const getApprovedErrorMessage = (error: unknown): string => {
  if (error instanceof AppError && error.isUserFacing) return error.message;
  if (error instanceof Error) return error.message;
  return '반영 중인 리소스 목록을 불러오지 못했습니다.';
};
