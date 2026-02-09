'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';
import { createProject } from '@/app/lib/api';
import { cn, getInputClass, modalStyles, providerColors, statusColors, textColors, bgColors, borderColors, interactiveColors } from '@/lib/theme';
import { PROVIDER_DESCRIPTIONS, AWS_REGION_TYPE_LABELS, PROVIDER_FIELD_LABELS } from '@/lib/constants/labels';
import type { CloudProvider } from '@/lib/types';

const ALL_PROVIDERS: CloudProvider[] = ['AWS', 'Azure', 'GCP', 'IDC', 'SDU'];

const PROVIDER_SELECTED_STYLES = providerColors;

const validateAwsAccountId = (value: string): string | null => {
  if (!value) return null;
  return /^\d{12}$/.test(value) ? null : '12자리 숫자를 입력하세요';
};

const validateGuid = (value: string): string | null => {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? null
    : 'GUID 형식이 올바르지 않습니다 (예: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)';
};

const labelClass = cn('block text-sm font-medium mb-1.5', textColors.secondary);
const labelClassMb2 = cn('block text-sm font-medium mb-2', textColors.secondary);
const optionalSpanClass = cn('font-normal', textColors.quaternary);
const errorTextClass = cn('mt-1 text-sm', statusColors.error.text);
const hintTextClass = cn('mt-1 text-xs', textColors.tertiary);

interface ProjectCreateModalProps {
  selectedServiceCode: string;
  serviceName: string;
  onClose: () => void;
  onCreated: () => void;
}

export const ProjectCreateModal = ({ selectedServiceCode, serviceName, onClose, onCreated }: ProjectCreateModalProps) => {
  const [projectCode, setProjectCode] = useState('');
  const [description, setDescription] = useState('');
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('AWS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Provider-specific fields
  const [awsAccountId, setAwsAccountId] = useState('');
  const [awsRegionType, setAwsRegionType] = useState<'global' | 'china'>('global');
  const [tenantId, setTenantId] = useState('');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [gcpProjectId, setGcpProjectId] = useState('');

  const awsAccountIdError = validateAwsAccountId(awsAccountId);
  const tenantIdError = validateGuid(tenantId);
  const subscriptionIdError = validateGuid(subscriptionId);

  const hasValidationError =
    (cloudProvider === 'AWS' && !!awsAccountIdError) ||
    (cloudProvider === 'Azure' && (!!tenantIdError || !!subscriptionIdError));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectCode.trim()) {
      setError('과제 코드를 입력하세요');
      return;
    }
    if (hasValidationError) return;

    setLoading(true);
    setError('');
    try {
      await createProject({
        projectCode,
        serviceCode: selectedServiceCode,
        cloudProvider,
        description: description || undefined,
        ...(cloudProvider === 'AWS' && {
          ...(awsAccountId && { awsAccountId }),
          awsRegionType,
        }),
        ...(cloudProvider === 'Azure' && {
          ...(tenantId && { tenantId }),
          ...(subscriptionId && { subscriptionId }),
        }),
        ...(cloudProvider === 'GCP' && gcpProjectId && { gcpProjectId }),
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error('과제 생성 실패:', err);
      setError('과제 생성에 실패했습니다: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
  };

  const renderProviderFields = () => {
    if (cloudProvider === 'AWS') return (
      <div className="space-y-4">
        <div>
          <label className={labelClass}>
            {PROVIDER_FIELD_LABELS.AWS.accountId} <span className={optionalSpanClass}>(선택)</span>
          </label>
          <input
            type="text"
            value={awsAccountId}
            onChange={(e) => setAwsAccountId(e.target.value.replace(/\D/g, '').slice(0, 12))}
            className={getInputClass(awsAccountIdError ? 'error' : undefined)}
            placeholder="123456789012"
            maxLength={12}
          />
          {awsAccountIdError && <p className={errorTextClass}>{awsAccountIdError}</p>}
        </div>
        <div>
          <label className={labelClass}>{PROVIDER_FIELD_LABELS.AWS.regionType}</label>
          <div className="flex gap-3">
            {(Object.entries(AWS_REGION_TYPE_LABELS) as [typeof awsRegionType, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAwsRegionType(value)}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all',
                  awsRegionType === value
                    ? `${providerColors.AWS.border} ${providerColors.AWS.bg} ${providerColors.AWS.text}`
                    : cn(interactiveColors.unselectedBorder, interactiveColors.unselectedText)
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    if (cloudProvider === 'Azure') return (
      <div className="space-y-4">
        <div>
          <label className={labelClass}>
            {PROVIDER_FIELD_LABELS.Azure.tenantId} <span className={optionalSpanClass}>(선택)</span>
          </label>
          <input
            type="text"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className={getInputClass(tenantIdError ? 'error' : undefined)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
          {tenantIdError && <p className={errorTextClass}>{tenantIdError}</p>}
        </div>
        <div>
          <label className={labelClass}>
            {PROVIDER_FIELD_LABELS.Azure.subscriptionId} <span className={optionalSpanClass}>(선택)</span>
          </label>
          <input
            type="text"
            value={subscriptionId}
            onChange={(e) => setSubscriptionId(e.target.value)}
            className={getInputClass(subscriptionIdError ? 'error' : undefined)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
          {subscriptionIdError && <p className={errorTextClass}>{subscriptionIdError}</p>}
        </div>
      </div>
    );

    if (cloudProvider === 'GCP') return (
      <div>
        <label className={labelClass}>
          {PROVIDER_FIELD_LABELS.GCP.projectId} <span className={optionalSpanClass}>(선택)</span>
        </label>
        <input
          type="text"
          value={gcpProjectId}
          onChange={(e) => setGcpProjectId(e.target.value)}
          className={getInputClass()}
          placeholder="my-project-id"
        />
        <p className={hintTextClass}>Project Number가 아닌 Project ID를 입력하세요</p>
      </div>
    );

    return null;
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={cn(modalStyles.container, 'w-[560px] shadow-2xl max-h-[90vh] flex flex-col')} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={modalStyles.header}>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', statusColors.info.bg)}>
              <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className={cn('text-lg font-bold', textColors.primary)}>새 과제 등록</h2>
              <p className={cn('text-sm', textColors.tertiary)}>PII Agent 설치 과제를 생성합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn('p-2 rounded-lg transition-colors', interactiveColors.closeButton)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* 서비스 코드 (읽기 전용) */}
          <div>
            <label className={labelClassMb2}>서비스 코드</label>
            <div className={cn('flex items-center gap-3 px-4 py-3 rounded-lg border', borderColors.default, bgColors.muted)}>
              <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', bgColors.primary)}>
                <span className={cn('text-xs font-bold', textColors.inverse)}>{selectedServiceCode.charAt(0)}</span>
              </div>
              <div>
                <div className={cn('font-medium', textColors.primary)}>{selectedServiceCode}</div>
                <div className={cn('text-sm', textColors.tertiary)}>{serviceName}</div>
              </div>
            </div>
          </div>

          {/* 과제 코드 */}
          <div>
            <label className={labelClassMb2}>과제 코드</label>
            <input
              type="text"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              className={getInputClass()}
              placeholder="예: N-IRP-001"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className={labelClassMb2}>
              설명 <span className={optionalSpanClass}>(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={cn(getInputClass(), 'resize-none')}
              placeholder="과제에 대한 간단한 설명을 입력하세요"
            />
          </div>

          {/* Cloud Provider 선택 */}
          <div>
            <label className={labelClassMb2}>Cloud Provider</label>
            <div className="grid grid-cols-3 gap-2.5">
              {ALL_PROVIDERS.map((provider) => {
                const isSelected = cloudProvider === provider;
                const styles = PROVIDER_SELECTED_STYLES[provider];
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setCloudProvider(provider)}
                    className={cn(
                      'relative p-3 rounded-lg border-2 transition-all text-center',
                      isSelected
                        ? `${styles.border} ${styles.bg}`
                        : cn(interactiveColors.unselectedBorder, bgColors.muted)
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5">
                        <svg className="w-4 h-4 text-current opacity-70" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-1.5">
                      <CloudProviderIcon provider={provider} size="md" showLabel={false} variant="icon" />
                      <span className={cn('text-sm font-medium', isSelected ? textColors.primary : textColors.secondary)}>{provider}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className={cn('mt-2 text-xs', textColors.tertiary)}>{PROVIDER_DESCRIPTIONS[cloudProvider]}</p>
          </div>

          {/* Provider-specific fields */}
          {renderProviderFields()}

          {/* Error */}
          {error && (
            <div className={cn('flex items-center gap-2 px-4 py-3 rounded-lg border', statusColors.error.bg, statusColors.error.border)}>
              <svg className={cn('w-5 h-5 flex-shrink-0', statusColors.error.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={cn('text-sm', statusColors.error.textDark)}>{error}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} type="button">
              취소
            </Button>
            <Button type="submit" disabled={loading || hasValidationError}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  등록 중...
                </span>
              ) : '과제 등록'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
