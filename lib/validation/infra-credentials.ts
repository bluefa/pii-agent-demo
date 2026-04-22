const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AWS_ACCOUNT_ID_PATTERN = /^\d{12}$/;

export const validateAwsAccountId = (value: string): string | null => {
  if (!value) return null;
  return AWS_ACCOUNT_ID_PATTERN.test(value) ? null : '12자리 숫자를 입력하세요';
};

export const validateGuid = (value: string): string | null => {
  if (!value) return null;
  return GUID_PATTERN.test(value)
    ? null
    : 'GUID 형식이 올바르지 않습니다 (예: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)';
};

export const sanitizeDigits = (value: string, maxLength: number): string =>
  value.replace(/\D/g, '').slice(0, maxLength);
