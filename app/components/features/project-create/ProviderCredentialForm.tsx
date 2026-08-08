'use client';

import { useState } from 'react';
import {
  CREDENTIAL_FIELDS,
  credentialFieldError,
} from '@/app/components/features/project-create/credential-fields';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';
import { cn, getInputClass, statusColors, textColors } from '@/lib/theme';

interface ProviderCredentialFormProps {
  chipKey: ProviderChipKey;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** True once 다음 has been refused — only then do empty required fields complain. */
  showRequiredErrors: boolean;
}

export const ProviderCredentialForm = ({
  chipKey,
  values,
  onChange,
  showRequiredErrors,
}: ProviderCredentialFormProps) => {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  return (
    <div className="grid max-w-[640px] grid-cols-2 gap-x-[18px] gap-y-4">
      {CREDENTIAL_FIELDS[chipKey].map((field) => {
        const value = values[field.name] ?? '';
        const error = credentialFieldError(field, value);
        // A field the user has not filled in yet is not wrong yet: while typing, only
        // format errors speak; "required" waits until 다음 is refused.
        const visibleError =
          error && (showRequiredErrors || (value.trim().length > 0 && touched[field.name]))
            ? error
            : null;
        const errorId = `cred-${field.name}-error`;

        return (
          <div key={field.name} className={field.full ? 'col-span-2' : undefined}>
            <label
              htmlFor={`cred-${field.name}`}
              className={cn('mb-1.5 block text-sm font-semibold', textColors.secondary)}
            >
              {field.label}
              {field.optional ? (
                <span className={cn('ml-1 text-xs font-normal', textColors.tertiary)}>(선택)</span>
              ) : (
                <span className={cn('ml-1', statusColors.error.text)}>*</span>
              )}
            </label>
            <input
              id={`cred-${field.name}`}
              type="text"
              value={value}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              aria-invalid={visibleError ? true : undefined}
              aria-describedby={visibleError ? errorId : undefined}
              className={getInputClass(visibleError ? 'error' : undefined)}
              onBlur={() => setTouched((prev) => ({ ...prev, [field.name]: true }))}
              onChange={(e) => {
                const next = field.sanitize ? field.sanitize(e.target.value) : e.target.value;
                setTouched((prev) => ({ ...prev, [field.name]: true }));
                onChange({ ...values, [field.name]: next });
              }}
            />
            {visibleError ? (
              <p id={errorId} className={cn('mt-1.5 text-xs', statusColors.error.textDark)}>
                {visibleError}
              </p>
            ) : (
              field.helper && (
                <p className={cn('mt-1.5 text-xs', textColors.tertiary)}>{field.helper}</p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
};
