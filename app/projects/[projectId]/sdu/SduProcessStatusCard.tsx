'use client';

import type { Project } from '@/lib/types';
import type { SduProcessStatus, SduInstallationStatus, IamUser, SourceIpEntry } from '@/lib/types/sdu';
import { SDU_STEP_LABELS } from '@/lib/constants/sdu';
import { cn, getButtonClass, statusColors } from '@/lib/theme';
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
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200',
                  isCompleted && cn(statusColors.success.dot, 'text-white'),
                  isCurrent && cn(statusColors.info.dot, 'text-white ring-2', statusColors.info.bg),
                  !isCompleted && !isCurrent && 'bg-gray-100 text-gray-400'
                )}
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
                className={cn(
                  'mt-1.5 text-xs text-center max-w-[70px] leading-tight',
                  isCompleted && cn(statusColors.success.textDark, 'font-medium'),
                  isCurrent && cn(statusColors.info.textDark, 'font-medium'),
                  !isCompleted && !isCurrent && 'text-gray-400'
                )}
              >
                {item.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-1 mt-[-20px]">
                <div className={cn('h-0.5 rounded-full', isCompleted ? statusColors.success.dot : 'bg-gray-200')} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ===== S3 Upload Guide =====

interface S3UploadGuideProps {
  iamUser: IamUser | null;
  sourceIps: SourceIpEntry[];
  projectId: string;
}

const CheckIcon = () => (
  <svg className={cn('w-4 h-4 flex-shrink-0', statusColors.success.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const WarningIcon = () => (
  <svg className={cn('w-4 h-4 flex-shrink-0', statusColors.warning.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const S3UploadGuide = ({ iamUser, sourceIps, projectId }: S3UploadGuideProps) => {
  const bucketSuffix = projectId.slice(-8);
  const bucketName = `sdu-data-${bucketSuffix}`;
  const uploadPath = `s3://${bucketName}/`;
  const hasAkSk = !!(iamUser?.akSkIssuedAt);
  const hasSourceIp = sourceIps.length > 0;

  const prerequisites = [
    {
      done: hasAkSk,
      label: 'IAM USER AK/SK 발급',
      hint: hasAkSk ? `${iamUser?.userName}` : '좌측 IAM USER [관리]에서 확인하세요',
    },
    {
      done: hasSourceIp,
      label: 'SourceIP 등록',
      hint: hasSourceIp
        ? `${sourceIps.length}건 등록 완료`
        : '미등록 시 S3 접근이 차단될 수 있습니다',
    },
  ];

  const steps = [
    {
      number: 1,
      title: 'S3 버킷 경로 확인',
      description: 'BDC에서 안내받은 S3 버킷명과 업로드 경로를 확인합니다.',
    },
    {
      number: 2,
      title: '데이터 업로드',
      description: '발급받은 AK/SK를 사용하여 AWS CLI 또는 SDK로 데이터를 업로드합니다.',
    },
    {
      number: 3,
      title: '업로드 완료 대기',
      description: '업로드가 완료되면 자동으로 다음 단계로 진행됩니다.',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', statusColors.info.bg)}>
          <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h4 className="text-base font-semibold text-gray-900">S3 데이터 업로드</h4>
          <p className="text-sm text-gray-500 mt-0.5">BDC에서 제공한 S3 버킷에 데이터를 업로드하세요.</p>
        </div>
      </div>

      {/* Prerequisites */}
      <div className={cn('rounded-lg border p-4', statusColors.info.border, 'bg-gray-50')}>
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">사전 확인</h5>
        <div className="space-y-2.5">
          {prerequisites.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              {item.done ? <CheckIcon /> : <WarningIcon />}
              <div className="flex-1 min-w-0">
                <span className={cn('text-sm font-medium', item.done ? 'text-gray-900' : statusColors.warning.textDark)}>
                  {item.label}
                </span>
                <p className={cn('text-xs mt-0.5', item.done ? 'text-gray-500' : statusColors.warning.text)}>
                  {item.hint}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* S3 Bucket Info */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">S3 버킷 정보</h5>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 w-20 flex-shrink-0">버킷명</span>
            <code className="font-mono text-xs text-gray-900">{bucketName}</code>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 w-20 flex-shrink-0">업로드 경로</span>
            <code className="font-mono text-xs text-gray-900">{uploadPath}</code>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 w-20 flex-shrink-0">리전</span>
            <code className="font-mono text-xs text-gray-900">ap-northeast-2</code>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div>
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">업로드 절차</h5>
        <div className="space-y-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex gap-3">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  statusColors.info.bg, statusColors.info.textDark
                )}>
                  {step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn('w-px flex-1 my-1', statusColors.info.border)} />
                )}
              </div>
              {/* Content */}
              <div className={cn('pb-4', index < steps.length - 1 && 'border-b border-gray-100')}>
                <p className="text-sm font-medium text-gray-900 leading-6">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Polling indicator */}
      <div className={cn('flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg', statusColors.info.bg)}>
        <LoadingSpinner />
        <span className={cn('text-sm', statusColors.info.textDark)}>S3 업로드 상태를 확인하고 있습니다...</span>
      </div>

      {/* Warning */}
      <div className={cn('flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg', statusColors.warning.bg)}>
        <WarningIcon />
        <p className={cn('text-xs', statusColors.warning.textDark)}>
          업로드가 확인되면 BDC에서 환경 구성을 자동으로 시작합니다. 데이터가 정확히 업로드되었는지 확인해주세요.
        </p>
      </div>
    </div>
  );
};

// ===== Step Guide (non-S3 steps) =====

const SduStepGuide = ({ currentStep }: { currentStep: SduProcessStatus }) => {
  const getGuideText = (): string => {
    switch (currentStep) {
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

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        currentStep === 'INSTALLATION_COMPLETE'
          ? statusColors.success.bg
          : currentStep === 'INSTALLING' || currentStep === 'S3_UPLOAD_CONFIRMED'
          ? statusColors.warning.bg
          : statusColors.info.bg
      )}>
        {currentStep === 'INSTALLATION_COMPLETE' ? (
          <svg className={cn('w-4 h-4', statusColors.success.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : currentStep === 'INSTALLING' || currentStep === 'S3_UPLOAD_CONFIRMED' ? (
          <div className={cn('w-4 h-4 border-2 border-t-transparent rounded-full animate-spin', statusColors.warning.border)} />
        ) : (
          <svg className={cn('w-4 h-4', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <p className={cn('font-medium',
        currentStep === 'INSTALLATION_COMPLETE' ? statusColors.success.textDark : 'text-gray-900'
      )}>
        {getGuideText()}
      </p>
    </div>
  );
};

// ===== Main Component =====

interface SduProcessStatusCardProps {
  project: Project;
  currentStep: SduProcessStatus;
  sduInstallationStatus: SduInstallationStatus | null;
  iamUser: IamUser | null;
  sourceIps: SourceIpEntry[];
  connectionTestLoading: boolean;
  onExecuteConnectionTest: () => void;
  projectId: string;
}

export const SduProcessStatusCard = ({
  currentStep,
  sduInstallationStatus,
  iamUser,
  sourceIps,
  connectionTestLoading,
  onExecuteConnectionTest,
  projectId,
}: SduProcessStatusCardProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        프로세스 진행 상태
      </h3>

      <SduStepProgressBar currentStep={currentStep} />

      <div className="border-t border-gray-100 my-4" />

      <div className="flex-1 flex flex-col">
        {currentStep === 'S3_UPLOAD_PENDING' ? (
          <S3UploadGuide iamUser={iamUser} sourceIps={sourceIps} projectId={projectId} />
        ) : (
          <>
            <SduStepGuide currentStep={currentStep} />

            <div className="mt-auto pt-4">
              {(currentStep === 'S3_UPLOAD_CONFIRMED' || currentStep === 'INSTALLING') && sduInstallationStatus && (
                <SduInstallationProgress installationStatus={sduInstallationStatus} />
              )}

              {(currentStep === 'WAITING_CONNECTION_TEST' ||
                currentStep === 'CONNECTION_VERIFIED' ||
                currentStep === 'INSTALLATION_COMPLETE') && (
                <button
                  onClick={onExecuteConnectionTest}
                  disabled={connectionTestLoading}
                  className={cn(getButtonClass('success', 'md'), 'w-full flex items-center justify-center gap-2')}
                >
                  {connectionTestLoading && <LoadingSpinner />}
                  연결 테스트 실행
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
