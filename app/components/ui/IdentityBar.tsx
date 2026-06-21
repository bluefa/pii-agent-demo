'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { CopyIcon, StatusSuccessIcon } from '@/app/components/ui/icons';
import { TIMINGS } from '@/lib/constants/timings';
import { cn, identityBarStyles } from '@/lib/theme';

export interface IdentityBarField {
  label: string;
  value: ReactNode;
  /** Render the value mono (ib-mono) + a copy button. Non-mono values (e.g. a link) render as-is. */
  mono?: boolean;
  /** Copy target; defaults to `value` when it is a string. */
  copyText?: string;
}

interface IdentityBarProps {
  /** Resolved per-provider accent hex (see `providerAccent`). Drives stripe + icon/agent tints. */
  accent: string;
  providerName: string;
  providerSub: string;
  /** Provider glyph rendered inside the 38px accent-tinted icon box. */
  icon: ReactNode;
  fields: IdentityBarField[];
  /** Agent badge label (monitoring method, e.g. "AWS Agent"). Hidden when empty. */
  agentLabel?: string;
}

/**
 * v15 `.identity-bar` — provider/ID/agent strip below the page header
 * (01-chrome.md 752–855). The per-provider accent is injected as `--ib-accent`
 * so the stripe + `color-mix` tints recolor without raw hex in markup.
 */
export const IdentityBar = ({
  accent,
  providerName,
  providerSub,
  icon,
  fields,
  agentLabel,
}: IdentityBarProps) => (
  <div className={identityBarStyles.bar} style={{ ['--ib-accent']: accent } as CSSProperties}>
    <div className={identityBarStyles.provider}>
      <span className={identityBarStyles.providerIcon} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <div className={identityBarStyles.providerName}>{providerName}</div>
        <div className={identityBarStyles.providerSub}>{providerSub}</div>
      </div>
    </div>

    {fields.map((field) => (
      <div key={field.label} className="flex items-center gap-8">
        <span className={identityBarStyles.divider} />
        <IdentityField field={field} />
      </div>
    ))}

    <span className={identityBarStyles.spacer} />

    {agentLabel ? (
      <span className={identityBarStyles.agent}>
        <svg className={identityBarStyles.agentIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v5c0 4.5 3.2 8.4 8 9.7 4.8-1.3 8-5.2 8-9.7V6l-8-3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
        </svg>
        {agentLabel}
      </span>
    ) : null}
  </div>
);

const IdentityField = ({ field }: { field: IdentityBarField }) => {
  const copyTarget =
    field.mono ? field.copyText ?? (typeof field.value === 'string' ? field.value : null) : null;

  return (
    <div className={identityBarStyles.field}>
      <span className={identityBarStyles.key}>{field.label}</span>
      <span className={identityBarStyles.idRow}>
        <span className={field.mono ? cn(identityBarStyles.mono, 'truncate') : 'min-w-0 truncate text-[13px]'}>
          {field.value}
        </span>
        {copyTarget ? <CopyChip value={copyTarget} label={`${field.label} 복사`} /> : null}
      </span>
    </div>
  );
};

const CopyChip = ({ value, label }: { value: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), TIMINGS.COPY_FEEDBACK_MS);
    } catch (error) {
      console.warn('[IdentityBar] clipboard.writeText failed', { error, label });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        identityBarStyles.copyBase,
        copied ? identityBarStyles.copyCopied : identityBarStyles.copyIdle,
      )}
    >
      {copied ? <StatusSuccessIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
    </button>
  );
};
