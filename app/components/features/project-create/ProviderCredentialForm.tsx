'use client';

import { cn, getInputClass, textColors, statusColors } from '@/lib/theme';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';
import {
  validateAwsAccountId,
  validateGuid,
  sanitizeDigits,
} from '@/lib/validation/infra-credentials';

export interface CredentialFieldDef {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  sanitize?: (value: string) => string;
  validate?: (value: string) => string | null;
}

const awsAccountField = (name: string, label: string): CredentialFieldDef => ({
  name,
  label,
  placeholder: '12-digit AWS account ID',
  maxLength: 12,
  sanitize: (v) => sanitizeDigits(v, 12),
  validate: validateAwsAccountId,
});

const azureGuidField = (name: string, label: string): CredentialFieldDef => ({
  name,
  label,
  placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  validate: validateGuid,
});

export const CREDENTIAL_FIELDS: Record<Extract<ProviderChipKey, 'aws-global' | 'aws-china' | 'azure' | 'gcp'>, CredentialFieldDef[]> = {
  'aws-global': [
    awsAccountField('payerAccount', 'Payer Account'),
    awsAccountField('linkedAccount', 'Linked Account'),
  ],
  'aws-china': [
    awsAccountField('payerAccount', 'Payer Account'),
    awsAccountField('linkedAccount', 'Linked Account'),
  ],
  azure: [
    azureGuidField('tenantId', 'Tenant ID'),
    azureGuidField('subscriptionId', 'Subscription ID'),
  ],
  gcp: [
    {
      name: 'projectId',
      label: 'GCP Project ID',
      placeholder: 'my-project-id',
      hint: 'Project Number가 아닌 Project ID를 입력하세요',
    },
  ],
};

interface ProviderCredentialFormProps {
  chipKey: ProviderChipKey;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

export const ProviderCredentialForm = ({ chipKey, values, onChange }: ProviderCredentialFormProps) => {
  if (chipKey === 'idc' || chipKey === 'other' || chipKey === 'saas') return null;

  const fields = CREDENTIAL_FIELDS[chipKey];

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const value = values[field.name] ?? '';
        const error = field.validate ? field.validate(value) : null;
        return (
          <div key={field.name}>
            <label className={cn('block text-sm font-medium mb-1.5', textColors.secondary)}>
              {field.label}
            </label>
            <input
              type="text"
              value={value}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              className={getInputClass(error ? 'error' : undefined)}
              onChange={(e) => {
                const next = field.sanitize ? field.sanitize(e.target.value) : e.target.value;
                onChange({ ...values, [field.name]: next });
              }}
            />
            {error && <p className={cn('mt-1 text-sm', statusColors.error.text)}>{error}</p>}
            {!error && field.hint && (
              <p className={cn('mt-1 text-xs', textColors.tertiary)}>{field.hint}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const validateCredentials = (
  chipKey: ProviderChipKey,
  values: Record<string, string>,
): string | null => {
  if (chipKey === 'idc' || chipKey === 'other' || chipKey === 'saas') return '지원하지 않는 Provider입니다';
  const fields = CREDENTIAL_FIELDS[chipKey];
  for (const field of fields) {
    const v = values[field.name] ?? '';
    if (!v.trim()) return `${field.label}을(를) 입력하세요`;
    const err = field.validate?.(v);
    if (err) return `${field.label}: ${err}`;
  }
  return null;
};
