'use client';

import { useModal } from '@/app/hooks/useModal';
import {
  borderColors,
  cn,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import { TfRoleGuideModal } from '@/app/components/features/process-status/aws/TfRoleGuideModal';
import { TfScriptGuideModal } from '@/app/components/features/process-status/aws/TfScriptGuideModal';
import type { CloudTargetSource } from '@/lib/types';

interface AwsInstallationModeSelectorProps {
  targetSourceId: number;
  // Kept for the parent contract; the mode is no longer chosen via an API call.
  onModeSelected: (project: CloudTargetSource) => void;
}

/**
 * REMOVED-no-swagger: POST …/aws/installation-mode is absent from
 * install-v1.yaml, so the mode can no longer be persisted. The install flow
 * defaults to AUTO (InstallationStatusSlot passes `awsInstallationMode ?? 'AUTO'`
 * and AwsInstallationInline carries an in-card AUTO/MANUAL toggle). This screen
 * now only surfaces the Role / Script guides; the previous "자동/수동 설치 선택"
 * API buttons were removed with the endpoint.
 */
export const AwsInstallationModeSelector = (_props: AwsInstallationModeSelectorProps) => {
  const roleGuideModal = useModal();
  const scriptGuideModal = useModal();

  return (
    <>
      <div className={cn('bg-white rounded-lg border shadow-sm', borderColors.default)}>
        <div className={cn('px-6 py-4 border-b', borderColors.default)}>
          <h2 className={cn('text-lg font-semibold', textColors.primary)}>설치 가이드</h2>
        </div>

        <div className="p-6">
          <p className={cn('text-sm mb-2', textColors.tertiary)}>
            AWS PII Agent 설치는 기본적으로 자동 설치(AUTO) 방식으로 진행됩니다.
          </p>
          <div className={cn('flex items-center gap-2 text-sm mb-6', statusColors.warning.text)}>
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>설치 방식은 설치 화면에서 전환할 수 있습니다.</span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className={cn('border-2 rounded-lg p-5 flex flex-col', primaryColors.bgLight, primaryColors.borderLight)}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚡</span>
                <h3 className={cn('text-base font-semibold', textColors.primary)}>자동 설치</h3>
              </div>
              <ul className={cn('text-sm space-y-2 mb-4 flex-1', textColors.tertiary)}>
                <li className="flex items-start gap-2">
                  <span className={cn('mt-0.5', textColors.quaternary)}>•</span>
                  <span>TerraformExecutionRole 등록 필요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className={cn('mt-0.5', textColors.quaternary)}>•</span>
                  <span>시스템이 자동으로 TF 실행</span>
                </li>
              </ul>
              <button
                type="button"
                onClick={() => roleGuideModal.open()}
                className={cn('text-sm', primaryColors.text, primaryColors.textHover, 'hover:underline')}
              >
                Role 등록 가이드
              </button>
            </div>

            <div className={cn('border-2 rounded-lg p-5 flex flex-col', borderColors.default)}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📋</span>
                <h3 className={cn('text-base font-semibold', textColors.primary)}>수동 설치</h3>
              </div>
              <ul className={cn('text-sm space-y-2 mb-4 flex-1', textColors.tertiary)}>
                <li className="flex items-start gap-2">
                  <span className={cn('mt-0.5', textColors.quaternary)}>•</span>
                  <span>TF Script를 직접 실행</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className={cn('mt-0.5', textColors.quaternary)}>•</span>
                  <span>TF Role 불필요</span>
                </li>
              </ul>
              <button
                type="button"
                onClick={() => scriptGuideModal.open()}
                className={cn('text-sm hover:underline', textColors.tertiary)}
              >
                Script 설치 가이드
              </button>
            </div>
          </div>
        </div>
      </div>

      {roleGuideModal.isOpen && <TfRoleGuideModal onClose={roleGuideModal.close} />}
      {scriptGuideModal.isOpen && <TfScriptGuideModal onClose={scriptGuideModal.close} />}
    </>
  );
};
