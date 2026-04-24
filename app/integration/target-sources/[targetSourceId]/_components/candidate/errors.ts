import { AppError } from '@/lib/errors';

export const getCandidateErrorMessage = (error: unknown): string => {
  if (error instanceof AppError && error.isUserFacing) return error.message;
  if (error instanceof Error) return error.message;
  return '리소스 정보를 불러오지 못했습니다.';
};
