import type { ProviderChipKey } from '@/lib/constants/provider-mapping';
import { COPY } from '@/lib/copy';
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

/** The wizard dictionary, so the field builders below can take it as a parameter. */
type WizardCopy = (typeof COPY)['ko']['wizard'];

// `lib/validation/infra-credentials.ts` stays locale-free: it decides whether a value
// is wrong, and the dictionary supplies the wording for the verdict.
const awsAccountField = (
  t: WizardCopy,
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
  validate: (v) => {
    if (optional && !v) return null;
    return validateAwsAccountId(v) === null ? null : t.aws12Digits;
  },
});

const azureGuidField = (
  t: WizardCopy,
  name: string,
  label: string,
  helper: string,
): CredentialFieldDef => ({
  name,
  label,
  placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  helper,
  validate: (v) => (validateGuid(v) === null ? null : t.badGuid),
});

// The placeholder is one whole-sentence key rather than a subject fragment: Korean
// puts the subject before the verb and English after it, so no fragment survives both.
const descriptionField = (
  t: WizardCopy,
  label: string,
  placeholder: string,
): CredentialFieldDef => ({
  name: 'description',
  label,
  placeholder,
  helper: t.descHelper,
  full: true,
});

export const credentialFields = (
  t: WizardCopy,
): Record<ProviderChipKey, CredentialFieldDef[]> => ({
  aws: [
    awsAccountField(t, 'payerAccount', 'Payer Account', t.awsPayerHelper),
    awsAccountField(
      t,
      'linkedAccount',
      'Linked Account',
      // 하위 계정을 쓰지 않는 조직도 있어 이 안내가 붙는다 — 필수로 바뀐 이상 그 경우를
      // 열어 두지 않으면 단일 계정 사용자는 2단계를 통과할 방법이 없다.
      t.awsMemberHelper,
    ),
    descriptionField(t, t.descLabel, t.descPlaceholderAccount),
  ],
  azure: [
    azureGuidField(t, 'tenantId', 'Tenant ID', t.azureTenantHelper),
    azureGuidField(t, 'subscriptionId', 'Subscription ID', t.azureSubHelper),
    descriptionField(t, t.descLabel, t.descPlaceholderAccount),
  ],
  gcp: [
    {
      name: 'projectId',
      label: 'GCP Project ID',
      placeholder: 'my-project-id',
      helper: t.gcpProjectHelper,
      full: true,
    },
    descriptionField(t, t.descLabel, t.descPlaceholderAccount),
  ],
  idc: [descriptionField(t, t.infraDescLabel, t.descPlaceholderInfra)],
  other: [descriptionField(t, t.infraDescLabel, t.descPlaceholderInfra)],
});

export const credentialFieldError = (
  t: WizardCopy,
  field: CredentialFieldDef,
  rawValue: string,
): string | null => {
  const value = rawValue.trim();
  if (!value) return field.optional ? null : t.required(field.label);
  return field.validate?.(value) ?? null;
};

/** Field name → message. Empty object means the step may advance. */
export const getCredentialErrors = (
  t: WizardCopy,
  chipKey: ProviderChipKey,
  values: Record<string, string>,
): Record<string, string> =>
  credentialFields(t)[chipKey].reduce<Record<string, string>>((acc, field) => {
    const error = credentialFieldError(t, field, values[field.name] ?? '');
    return error ? { ...acc, [field.name]: error } : acc;
  }, {});
