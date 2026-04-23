import { IDC_VALIDATION } from '@/lib/constants/idc';
import type { IdcDatabaseType, IdcInputFormat } from '@/lib/types/idc';

export type FormErrors = Record<string, string>;

export interface FormState {
  name: string;
  inputFormat: IdcInputFormat;
  ips: string[];
  host: string;
  databaseType: IdcDatabaseType;
  port: number;
  serviceId: string;
  credentialId: string;
  errors: FormErrors;
}

export const validateName = (name: string): string | null =>
  name.trim() ? null : '리소스 이름을 입력하세요';

export const validateHost = (host: string): string | null => {
  if (!host.trim()) return 'HOST를 입력하세요';
  if (host.length > IDC_VALIDATION.MAX_HOST_LENGTH) {
    return `HOST는 ${IDC_VALIDATION.MAX_HOST_LENGTH}자 이내로 입력하세요`;
  }
  return null;
};

export const validatePort = (port: number): string | null =>
  port < 1 || port > 65535 ? '포트는 1-65535 범위여야 합니다' : null;

export const validateServiceId = (serviceId: string): string | null =>
  serviceId.trim() ? null : 'Oracle DB는 Service ID가 필수입니다';

export const validateIps = (ips: string[]): FormErrors => {
  if (ips.every((ip) => !ip.trim())) {
    return { ips: 'IP를 최소 1개 입력하세요' };
  }
  const errors: FormErrors = {};
  // Iterate the original array so `ip_${index}` error keys line up with the
  // JSX `ips.map((_, index) => ...)` read — extracting to filtered-index
  // here was the pre-existing bug flagged during review of this refactor.
  ips.forEach((ip, index) => {
    const trimmed = ip.trim();
    if (trimmed && !IDC_VALIDATION.IP_REGEX.test(trimmed)) {
      errors[`ip_${index}`] = '유효한 IPv4 형식이 아닙니다';
    }
  });
  return errors;
};

export const validateAll = (state: FormState): FormErrors => {
  const errors: FormErrors = {};

  const nameErr = validateName(state.name);
  if (nameErr) errors.name = nameErr;

  if (state.inputFormat === 'IP') {
    Object.assign(errors, validateIps(state.ips));
  } else {
    const hostErr = validateHost(state.host);
    if (hostErr) errors.host = hostErr;
  }

  const portErr = validatePort(state.port);
  if (portErr) errors.port = portErr;

  if (state.databaseType === 'ORACLE') {
    const sidErr = validateServiceId(state.serviceId);
    if (sidErr) errors.serviceId = sidErr;
  }

  return errors;
};
