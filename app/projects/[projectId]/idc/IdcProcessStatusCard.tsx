'use client';

import { Project, ProcessStatus } from '@/lib/types';
import { IdcInstallationStatus as IdcInstallationStatusType } from '@/lib/types/idc';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';

// IDC Step Progress Bar - 승인 단계 없음 (4단계)
const idcSteps = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '리소스 등록' },
  { step: ProcessStatus.INSTALLING, label: '환경 구성' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
];

const IdcStepProgressBar = ({ currentStep }: { currentStep: ProcessStatus }) => {
  const getIdcStepIndex = (step: ProcessStatus): number => {
    if (step === ProcessStatus.WAITING_TARGET_CONFIRMATION) return 0;
    if (step === ProcessStatus.INSTALLING) return 1;
    if (step === ProcessStatus.WAITING_CONNECTION_TEST || step === ProcessStatus.CONNECTION_VERIFIED) return 2;
    if (step === ProcessStatus.INSTALLATION_COMPLETE) return 3;
    return 0;
  };

  const currentIndex = getIdcStepIndex(currentStep);

  return (
    <div className="flex items-center justify-between mb-6">
      {idcSteps.map((item, index) => {
        const isCompleted = currentIndex > index;
        const isCurrent = currentIndex === index;
        const isLast = index === idcSteps.length - 1;

        return (
          <div key={item.step} className="flex items-center flex-1">
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

const IdcStepGuide = ({ currentStep }: { currentStep: ProcessStatus }) => {
  const getGuideText = (): string => {
    switch (currentStep) {
      case ProcessStatus.WAITING_TARGET_CONFIRMATION:
        return '연결할 데이터베이스 정보를 입력하세요';
      case ProcessStatus.INSTALLING:
        return 'BDC 환경을 구성하고 방화벽을 확인하세요';
      case ProcessStatus.WAITING_CONNECTION_TEST:
      case ProcessStatus.CONNECTION_VERIFIED:
        return '설치가 완료되었습니다. DB 연결을 테스트하세요';
      case ProcessStatus.INSTALLATION_COMPLETE:
        return 'PII Agent 연동이 완료되었습니다.';
      default:
        return '';
    }
  };

  const guideText = getGuideText();

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        currentStep === ProcessStatus.INSTALLATION_COMPLETE
          ? 'bg-green-100'
          : currentStep === ProcessStatus.INSTALLING
          ? 'bg-orange-100'
          : 'bg-blue-100'
      }`}>
        {currentStep === ProcessStatus.INSTALLATION_COMPLETE ? (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : currentStep === ProcessStatus.INSTALLING ? (
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        )}
      </div>
      <div>
        <p className={`font-medium ${
          currentStep === ProcessStatus.INSTALLATION_COMPLETE
            ? 'text-green-700'
            : 'text-gray-900'
        }`}>
          {guideText}
        </p>
        {currentStep === ProcessStatus.INSTALLING && (
          <p className="text-sm text-gray-500 mt-1">
            방화벽 확인 완료 후 연결 테스트를 진행할 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
};

// IDC 설치 상태 표시
const IdcInstallationStatusDisplay = ({
  status,
  onConfirmFirewall,
  onRetry,
  onTestConnection,
}: {
  status: IdcInstallationStatusType;
  onConfirmFirewall: () => void;
  onRetry: () => void;
  onTestConnection: () => void;
}) => {
  const isBdcCompleted = status.bdcTf === 'COMPLETED';
  const isBdcFailed = status.bdcTf === 'FAILED';
  const isBdcInProgress = status.bdcTf === 'IN_PROGRESS';

  return (
    <div className="space-y-3">
      {/* BDC TF 상태 */}
      <div className={`flex items-center gap-2 p-3 rounded-lg ${
        isBdcCompleted ? 'bg-green-50' : isBdcFailed ? 'bg-red-50' : 'bg-blue-50'
      }`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
          isBdcCompleted ? 'bg-green-500' : isBdcFailed ? 'bg-red-500' : 'bg-blue-500'
        }`}>
          {isBdcCompleted ? (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : isBdcFailed ? (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <span className={`text-sm font-medium ${
          isBdcCompleted ? 'text-green-700' : isBdcFailed ? 'text-red-700' : 'text-blue-700'
        }`}>
          BDC TF {isBdcCompleted ? '완료' : isBdcFailed ? '실패' : isBdcInProgress ? '진행 중' : '대기 중'}
        </span>
        {isBdcFailed && (
          <button
            onClick={onRetry}
            className="ml-auto text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            재시도
          </button>
        )}
      </div>

      {/* 방화벽 확인 */}
      {isBdcCompleted && !status.firewallOpened && (
        <button
          onClick={onConfirmFirewall}
          className="w-full px-4 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
        >
          방화벽 확인 완료
        </button>
      )}

      {/* 연결 테스트 */}
      {isBdcCompleted && status.firewallOpened && (
        <button
          onClick={onTestConnection}
          className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
        >
          Test Connection
        </button>
      )}
    </div>
  );
};

interface IdcProcessStatusCardProps {
  project: Project;
  idcInstallationStatus: IdcInstallationStatusType | null;
  showResourceInput: boolean;
  idcActionLoading: boolean;
  testLoading: boolean;
  onShowResourceInput: () => void;
  onConfirmFirewall: () => void;
  onRetry: () => void;
  onTestConnection: () => void;
}

export const IdcProcessStatusCard = ({
  project,
  idcInstallationStatus,
  showResourceInput,
  idcActionLoading,
  testLoading,
  onShowResourceInput,
  onConfirmFirewall,
  onRetry,
  onTestConnection,
}: IdcProcessStatusCardProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        프로세스 진행 상태
      </h3>

      <IdcStepProgressBar currentStep={project.processStatus} />

      <div className="border-t border-gray-100 my-4" />

      <div className="flex-1 flex flex-col">
        <IdcStepGuide currentStep={project.processStatus} />

        <div className="mt-auto pt-4">
          {project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION && (
            <div className="space-y-3">
              {project.resources.length === 0 && !showResourceInput && (
                <button
                  onClick={onShowResourceInput}
                  disabled={idcActionLoading}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  리소스 등록
                </button>
              )}
              {project.resources.length > 0 && (
                <p className="text-sm text-gray-500">
                  아래 리소스 목록에서 연동 대상을 선택하세요
                </p>
              )}
            </div>
          )}

          {project.processStatus === ProcessStatus.INSTALLING && idcInstallationStatus && (
            <IdcInstallationStatusDisplay
              status={idcInstallationStatus}
              onConfirmFirewall={onConfirmFirewall}
              onRetry={onRetry}
              onTestConnection={onTestConnection}
            />
          )}

          {(project.processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
            project.processStatus === ProcessStatus.CONNECTION_VERIFIED ||
            project.processStatus === ProcessStatus.INSTALLATION_COMPLETE) && (
            <div className="space-y-3">
              <button
                onClick={onTestConnection}
                disabled={testLoading}
                className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {testLoading && <LoadingSpinner />}
                Test Connection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
