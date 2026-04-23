'use client';

import { useState } from 'react';
import type { CloudProvider } from '@/lib/types';
import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';
import { CopyIcon, OpenExternalIcon, StatusSuccessIcon } from '@/app/components/ui/icons';
import { TIMINGS } from '@/lib/constants/timings';
import { cardStyles, cn, providerColors, textColors } from '@/lib/theme';

/**
 * 하나의 식별자 레코드. "TargetSource"가 가리키는 클라우드 계정을 고유하게
 * 지정하는 공개 정보 — AWS Account ID, Azure Subscription/Tenant ID, GCP
 * Project ID 등. 비밀키(SecretKey)와는 별개의 개념이다.
 */
export interface TargetSourceIdentifier {
  label: string;
  value: string | null;
  /** true면 mono font + hover 시 복사 버튼 노출 */
  mono?: boolean;
}

export interface ProjectIdentity {
  cloudProvider: CloudProvider;
  /** e.g. "AWS Agent", "Azure Agent", "SDU" */
  monitoringMethod: string;
  /** Jira 티켓 URL. null/undefined면 chip 렌더하지 않음 */
  jiraLink?: string | null;
  /** provider별 공개 식별자들 (account id, subscription id, tenant id, project id 등) */
  identifiers: TargetSourceIdentifier[];
}

interface ProjectIdentityCardProps {
  identity: ProjectIdentity;
}

const JIRA_KEY_PATTERN = /\/browse\/([A-Z][A-Z0-9]+-\d+)/;

const extractJiraLabel = (url: string): string => {
  const match = url.match(JIRA_KEY_PATTERN);
  return match ? match[1] : 'Jira';
};

export const ProjectIdentityCard = ({ identity }: ProjectIdentityCardProps) => {
  const { cloudProvider, monitoringMethod, jiraLink, identifiers } = identity;
  const providerStyle = providerColors[cloudProvider];

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className={cn('h-6', providerStyle.gradient)} aria-hidden="true" />

      <header className="flex items-start justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <CloudProviderIcon provider={cloudProvider} size="md" variant="icon" />
          <div>
            <h2 className={cn('text-base font-bold tracking-tight', textColors.primary)}>
              {cloudProvider} Infrastructure
            </h2>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={cn('text-xs', textColors.tertiary)}>모니터링</span>
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
                  providerStyle.bg,
                  providerStyle.text,
                )}
              >
                {monitoringMethod}
              </span>
            </div>
          </div>
        </div>

        {jiraLink ? (
          <a
            href={jiraLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
              'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
              textColors.secondary,
              'transition-colors',
            )}
          >
            <span>{extractJiraLabel(jiraLink)}</span>
            <OpenExternalIcon />
          </a>
        ) : null}
      </header>

      {identifiers.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4">
          <dl
            className={cn(
              'grid gap-x-8 gap-y-3',
              identifiers.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
            )}
          >
            {identifiers.map((identifier) => (
              <TargetSourceIdentifierRow key={identifier.label} identifier={identifier} />
            ))}
          </dl>
        </div>
      )}
    </section>
  );
};

const TargetSourceIdentifierRow = ({ identifier }: { identifier: TargetSourceIdentifier }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!identifier.value) return;
    try {
      await navigator.clipboard.writeText(identifier.value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), TIMINGS.COPY_FEEDBACK_MS);
    } catch (error) {
      // 클립보드 접근 실패 (feature detect 실패 / Safari iframe / permission denied)
      // UI 피드백 없이 실패를 삼키지 말고 콘솔에 남겨 추후 문제 추적 가능하게 유지.
      console.warn('[ProjectIdentityCard] clipboard.writeText failed', {
        error,
        label: identifier.label,
      });
    }
  };

  const hasValue = identifier.value !== null && identifier.value !== '';

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt
        className={cn(
          'text-[11px] font-medium uppercase tracking-wide',
          textColors.tertiary,
        )}
      >
        {identifier.label}
      </dt>
      <dd className="group flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            'truncate',
            identifier.mono ? 'font-mono text-[13px] text-gray-800' : 'text-sm text-gray-700',
            !hasValue && 'text-gray-400',
          )}
          title={identifier.value ?? undefined}
        >
          {hasValue ? identifier.value : '-'}
        </span>
        {hasValue && identifier.mono ? (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'shrink-0 rounded p-0.5 transition-opacity',
              copied
                ? 'opacity-100 text-green-600'
                : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            )}
            aria-label={`${identifier.label} 복사`}
          >
            {copied ? <StatusSuccessIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </dd>
    </div>
  );
};
