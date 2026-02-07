'use client';

import { useState } from 'react';
import type { Project } from '@/lib/types';
import type { SduProcessStatus, SduInstallationStatus } from '@/lib/types/sdu';
import { SDU_STEP_LABELS } from '@/lib/constants/sdu';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { SduInstallationProgress } from '@/app/components/features/sdu';

const sduSteps = [
  { label: SDU_STEP_LABELS.s3Upload },
  { label: SDU_STEP_LABELS.installation },
  { label: SDU_STEP_LABELS.connectionTest },
  { label: SDU_STEP_LABELS.complete },
];

const SduStepProgressBar = ({ currentStep }: { currentStep: SduProcessStatus }) => {
  const getSduStepIndex = (step: SduProcessStatus): number => {
    if (step === 'S3_UPLOAD_PENDING') return 0;
    if (step === 'S3_UPLOAD_CONFIRMED' || step === 'INSTALLING') return 1;
    if (step === 'WAITING_CONNECTION_TEST' || step === 'CONNECTION_VERIFIED') return 2;
    if (step === 'INSTALLATION_COMPLETE') return 3;
    return 0;
  };

  const currentIndex = getSduStepIndex(currentStep);

  return (
    <div className="flex items-center justify-between mb-6">
      {sduSteps.map((item, index) => {
        const isCompleted = currentIndex > index;
        const isCurrent = currentIndex === index;
        const isLast = index === sduSteps.length - 1;

        return (
          <div key={item.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white ring-2 ring-blue-200'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-1.5 text-xs text-center max-w-[70px] leading-tight ${
                  isCompleted
                    ? 'text-green-600 font-medium'
                    : isCurrent
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-1 mt-[-20px]">
                <div
                  className={`h-0.5 rounded-full ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const SduStepGuide = ({ currentStep }: { currentStep: SduProcessStatus }) => {
  const getGuideText = (): string => {
    switch (currentStep) {
      case 'S3_UPLOAD_PENDING':
        return 'S3 버킷에 데이터를 업로드하고 확인 버튼을 눌러주세요';
      case 'S3_UPLOAD_CONFIRMED':
      case 'INSTALLING':
        return 'BDC에서 환경을 구성하고 있습니다';
      case 'WAITING_CONNECTION_TEST':
      case 'CONNECTION_VERIFIED':
        return '설치가 완료되었습니다. 연결을 테스트하세요';
      case 'INSTALLATION_COMPLETE':
        return 'SDU 연동이 완료되었습니다';
      default:
        return '';
    }
  };

  const guideText = getGuideText();

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        currentStep === 'INSTALLATION_COMPLETE'
          ? 'bg-green-100'
          : currentStep === 'INSTALLING' || currentStep === 'S3_UPLOAD_CONFIRMED'
          ? 'bg-orange-100'
          : 'bg-blue-100'
      }`}>
        {currentStep === 'INSTALLATION_COMPLETE' ? (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : currentStep === 'INSTALLING' || currentStep === 'S3_UPLOAD_CONFIRMED' ? (
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        )}
      </div>
      <div>
        <p className={`font-medium ${
          currentStep === 'INSTALLATION_COMPLETE'
            ? 'text-green-700'
            : 'text-gray-900'
        }`}>
          {guideText}
        </p>
      </div>
    </div>
  );
};

interface SduProcessStatusCardProps {
  project: Project;
  currentStep: SduProcessStatus;
  sduInstallationStatus: SduInstallationStatus | null;
  s3UploadLoading: boolean;
  connectionTestLoading: boolean;
  onConfirmS3Upload: () => void;
  onCheckInstallation: () => void;
  onExecuteConnectionTest: () => void;
}

export const SduProcessStatusCard = ({
  project,
  currentStep,
  sduInstallationStatus,
  s3UploadLoading,
  connectionTestLoading,
  onConfirmS3Upload,
  onCheckInstallation,
  onExecuteConnectionTest,
}: SduProcessStatusCardProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        프로세스 진행 상태
      </h3>

      <SduStepProgressBar currentStep={currentStep} />

      <div className="border-t border-gray-100 my-4" />

      <div className="flex-1 flex flex-col">
        <SduStepGuide currentStep={currentStep} />

        <div className="mt-auto pt-4">
          {currentStep === 'S3_UPLOAD_PENDING' && (
            <button
              onClick={onConfirmS3Upload}
              disabled={s3UploadLoading}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {s3UploadLoading && <LoadingSpinner />}
              S3 업로드 확인
            </button>
          )}

          {(currentStep === 'S3_UPLOAD_CONFIRMED' || currentStep === 'INSTALLING') && sduInstallationStatus && (
            <div className="space-y-3">
              <SduInstallationProgress installationStatus={sduInstallationStatus} />
              <button
                onClick={onCheckInstallation}
                className="w-full px-4 py-2.5 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                설치 상태 확인
              </button>
            </div>
          )}

          {(currentStep === 'WAITING_CONNECTION_TEST' ||
            currentStep === 'CONNECTION_VERIFIED' ||
            currentStep === 'INSTALLATION_COMPLETE') && (
            <button
              onClick={onExecuteConnectionTest}
              disabled={connectionTestLoading}
              className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {connectionTestLoading && <LoadingSpinner />}
              연결 테스트 실행
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
