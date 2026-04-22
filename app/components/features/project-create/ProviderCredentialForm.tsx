'use client';

import { cn, getInputClass, textColors, statusColors } from '@/lib/theme';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';

export interface CredentialFieldDef {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  sanitize?: (value: string) => string;
  validate?: (value: string) => string | null;
}

export const CREDENTIAL_FIELDS: Record<Extract<ProviderChipKey, 'aws-global' | 'aws-china' | 'azure' | 'gcp'>, CredentialFieldDef[]> = {
  'aws-global': [
    {
      name: 'payerAccount',
      label: 'Payer Account',
      placeholder: '12-digit AWS account ID',
      maxLength: 12,
      sanitize: (v) => v.replace(/\D/g, '').slice(0, 12),
      validate: (v) => (v && !/^\d{12}$/.test(v) ? '12자리 숫자를 입력하세요' : null),
    },
    {
      name: 'linkedAccount',
      label: 'Linked Account',
      placeholder: '12-digit AWS account ID',
      maxLength: 12,
      sanitize: (v) => v.replace(/\D/g, '').slice(0, 12),
      validate: (v) => (v && !/^\d{12}$/.test(v) ? '12자리 숫자를 입력하세요' : null),
    },
  ],
  'aws-china': [
    {
      name: 'payerAccount',
      label: 'Payer Account',
      placeholder: '12-digit AWS account ID',
      maxLength: 12,
      sanitize: (v) => v.replace(/\D/g, '').slice(0, 12),
      validate: (v) => (v && !/^\d{12}$/.test(v) ? '12자리 숫자를 입력하세요' : null),
    },
    {
      name: 'linkedAccount',
      label: 'Linked Account',
      placeholder: '12-digit AWS account ID',
      maxLength: 12,
      sanitize: (v) => v.replace(/\D/g, '').slice(0, 12),
      validate: (v) => (v && !/^\d{12}$/.test(v) ? '12자리 숫자를 입력하세요' : null),
    },
  ],
  azure: [
    {
      name: 'tenantId',
      label: 'Tenant ID',
      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      validate: (v) =>
        v && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
          ? 'GUID 형식이 올바르지 않습니다'
          : null,
    },
    {
      name: 'subscriptionId',
      label: 'Subscription ID',
      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      validate: (v) =>
        v && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
          ? 'GUID 형식이 올바르지 않습니다'
          : null,
    },
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
