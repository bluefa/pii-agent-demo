import type { ProviderChipKey } from '@/lib/constants/provider-mapping';
import {
  sanitizeDigits,
  validateAwsAccountId,
  validateGuid,
} from '@/lib/validation/infra-credentials';

export interface CredentialFieldDef {
  name: string;
  label: string;
  placeholder?: string;
  /** Format/where-to-find guidance under the field — not inside the placeholder. */
  helper?: string;
  maxLength?: number;
  optional?: boolean;
  /** Spans both columns of the 2-up grid. */
  full?: boolean;
  sanitize?: (value: string) => string;
  validate?: (value: string) => string | null;
}

const awsAccountField = (
  name: string,
  label: string,
  helper: string,
  optional = false,
): CredentialFieldDef => ({
  name,
  label,
  placeholder: '123456789012',
  helper,
  maxLength: 12,
  optional,
  sanitize: (v) => sanitizeDigits(v, 12),
  validate: (v) => (optional && !v ? null : validateAwsAccountId(v)),
});

const azureGuidField = (name: string, label: string, helper: string): CredentialFieldDef => ({
  name,
  label,
  placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  helper,
  validate: validateGuid,
});

const descriptionField = (label: string): CredentialFieldDef => ({
  name: 'description',
  label,
  placeholder: '이 인프라를 알아볼 수 있는 짧은 설명',
  helper: '어떤 인프라인지 알아볼 수 있게 적어 주세요',
  full: true,
});

export const CREDENTIAL_FIELDS: Record<ProviderChipKey, CredentialFieldDef[]> = {
  aws: [
    awsAccountField(
      'payerAccount',
      'Payer Account',
      'AWS 조직의 결제 계정 ID(숫자 12자리) — 콘솔 우상단 계정 메뉴에서 확인',
    ),
    awsAccountField(
      'linkedAccount',
      'Linked Account',
      '선택 입력 — 연결된 하위 계정이 있다면 입력해 주세요',
      true,
    ),
    descriptionField('설명'),
  ],
  azure: [
    azureGuidField('tenantId', 'Tenant ID', 'Microsoft Entra ID의 테넌트 식별자'),
    azureGuidField('subscriptionId', 'Subscription ID', '연결할 구독의 식별자'),
    descriptionField('설명'),
  ],
  gcp: [
    {
      name: 'projectId',
      label: 'GCP Project ID',
      placeholder: 'my-project-id',
      helper: 'Project Number가 아닌 Project ID를 입력해 주세요',
      full: true,
    },
    descriptionField('설명'),
  ],
  idc: [descriptionField('인프라 설명')],
  other: [descriptionField('인프라 설명')],
};

export const credentialFieldError = (
  field: CredentialFieldDef,
  rawValue: string,
): string | null => {
  const value = rawValue.trim();
  if (!value) return field.optional ? null : `${field.label}을(를) 입력해 주세요`;
  return field.validate?.(value) ?? null;
};

/** Field name → message. Empty object means the step may advance. */
export const getCredentialErrors = (
  chipKey: ProviderChipKey,
  values: Record<string, string>,
): Record<string, string> =>
  CREDENTIAL_FIELDS[chipKey].reduce<Record<string, string>>((acc, field) => {
    const error = credentialFieldError(field, values[field.name] ?? '');
    return error ? { ...acc, [field.name]: error } : acc;
  }, {});
