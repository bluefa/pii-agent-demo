'use client';

import { useState } from 'react';
import { useModal } from '@/app/hooks/useModal';
import { TfRoleGuideModal } from '@/app/components/features/process-status/aws/TfRoleGuideModal';
import { TfScriptGuideModal } from '@/app/components/features/process-status/aws/TfScriptGuideModal';
import type { AwsInstallationMode, Project } from '@/lib/types';

interface AwsInstallationModeSelectorProps {
  projectId: string;
  onModeSelected: (project: Project) => void;
}

export const AwsInstallationModeSelector = ({
  projectId,
  onModeSelected,
}: AwsInstallationModeSelectorProps) => {
  const [selecting, setSelecting] = useState<AwsInstallationMode | null>(null);
  const roleGuideModal = useModal();
  const scriptGuideModal = useModal();

  const handleSelectMode = async (mode: AwsInstallationMode) => {
    setSelecting(mode);
    try {
      const response = await fetch(`/api/aws/projects/${projectId}/installation-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) {
        throw new Error('설치 모드 선택에 실패했습니다.');
      }

      const data = await response.json();
      onModeSelected(data.project);
    } catch (error) {
      console.error('Failed to select installation mode:', error);
      alert('설치 모드 선택에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSelecting(null);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">설치 모드 선택</h2>
        </div>

        {/* 본문 */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-2">
            AWS PII Agent 설치 방식을 선택해주세요.
          </p>
          <div className="flex items-center gap-2 text-sm text-amber-600 mb-6">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>설치 모드는 프로젝트 생성 후 변경할 수 없습니다.</span>
          </div>

          {/* 카드 그리드 */}
          <div className="grid grid-cols-2 gap-6">
            {/* 자동 설치 카드 */}
            <div className="border-2 border-blue-200 rounded-lg p-5 hover:border-blue-400 transition-colors bg-blue-50/30 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚡</span>
                <h3 className="text-base font-semibold text-gray-900">자동 설치</h3>
              </div>

              <ul className="text-sm text-gray-600 space-y-2 mb-4 flex-1">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>TerraformExecutionRole 등록 필요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>시스템이 자동으로 TF 실행</span>
                </li>
              </ul>

              <div className="text-center space-y-3">
                <button
                  type="button"
                  onClick={() => roleGuideModal.open()}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Role 등록 가이드
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectMode('AUTO')}
                  disabled={selecting !== null}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {selecting === 'AUTO' ? '선택 중...' : '자동 설치 선택'}
                </button>
              </div>
            </div>

            {/* 수동 설치 카드 */}
            <div className="border-2 border-gray-200 rounded-lg p-5 hover:border-gray-400 transition-colors bg-gray-50/30 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">📋</span>
                <h3 className="text-base font-semibold text-gray-900">수동 설치</h3>
              </div>

              <ul className="text-sm text-gray-600 space-y-2 mb-4 flex-1">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>TF Script를 직접 실행</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>TF Role 불필요</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>담당자와 일정 조율 필요</span>
                </li>
              </ul>

              <div className="text-center space-y-3">
                <button
                  type="button"
                  onClick={() => scriptGuideModal.open()}
                  className="text-sm text-gray-600 hover:text-gray-800 hover:underline"
                >
                  Script 설치 가이드
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectMode('MANUAL')}
                  disabled={selecting !== null}
                  className="w-full px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {selecting === 'MANUAL' ? '선택 중...' : '수동 설치 선택'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 모달 */}
      {roleGuideModal.isOpen && (
        <TfRoleGuideModal onClose={roleGuideModal.close} />
      )}
      {scriptGuideModal.isOpen && (
        <TfScriptGuideModal onClose={scriptGuideModal.close} />
      )}
    </>
  );
};
