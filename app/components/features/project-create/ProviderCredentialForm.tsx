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
  optional?: boolean;
  sanitize?: (value: string) => string;
  validate?: (value: string) => string | null;
}

const awsAccountField = (name: string, label: string, optional = false): CredentialFieldDef => ({
  name,
  label,
  placeholder: '12-digit AWS account ID',
  maxLength: 12,
  optional,
  sanitize: (v) => sanitizeDigits(v, 12),
  validate: (v) => (optional && !v ? null : validateAwsAccountId(v)),
});

const azureGuidField = (name: string, label: string): CredentialFieldDef => ({
  name,
  label,
  placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  validate: validateGuid,
});

const descriptionField = (optional = false): CredentialFieldDef => ({
  name: 'description',
  label: '인프라 설명',
  placeholder: '이 인프라에 대한 간단한 설명',
  optional,
  hint: optional ? '선택 입력' : undefined,
});

export const CREDENTIAL_FIELDS: Record<ProviderChipKey, CredentialFieldDef[]> = {
  aws: [
    awsAccountField('payerAccount', 'Payer Account'),
    awsAccountField('linkedAccount', 'Linked Account', true),
    descriptionField(true),
  ],
  azure: [
    azureGuidField('tenantId', 'Tenant ID'),
    azureGuidField('subscriptionId', 'Subscription ID'),
    descriptionField(true),
  ],
  gcp: [
    {
      name: 'projectId',
      label: 'GCP Project ID',
      placeholder: 'my-project-id',
      hint: 'Project Number가 아닌 Project ID를 입력하세요',
    },
    descriptionField(true),
  ],
  idc: [descriptionField(false)],
  other: [descriptionField(false)],
};

interface ProviderCredentialFormProps {
  chipKey: ProviderChipKey;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

export const ProviderCredentialForm = ({ chipKey, values, onChange }: ProviderCredentialFormProps) => {
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
              {field.optional && (
                <span className={cn('ml-1.5 text-xs font-normal', textColors.tertiary)}>
                  (선택)
                </span>
              )}
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
  const fields = CREDENTIAL_FIELDS[chipKey];
  for (const field of fields) {
    const v = values[field.name] ?? '';
    if (!v.trim()) {
      if (field.optional) continue;
      return `${field.label}을(를) 입력하세요`;
    }
    const err = field.validate?.(v);
    if (err) return `${field.label}: ${err}`;
  }
  return null;
};
