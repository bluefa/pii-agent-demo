'use client';

import { useState } from 'react';
import { Project, ProcessStatus, Resource } from '@/lib/types';
import { IdcInstallationStatus as IdcInstallationStatusType } from '@/lib/types/idc';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { statusColors, primaryColors, cn } from '@/lib/theme';

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
                    ? `${statusColors.info.dot} text-white ring-2 ${statusColors.info.ring}`
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
                    ? `${primaryColors.text} font-medium`
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
        return 'BDC에서 환경을 구성하고 있습니다';
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
          : statusColors.info.bg
      }`}>
        {currentStep === ProcessStatus.INSTALLATION_COMPLETE ? (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : currentStep === ProcessStatus.INSTALLING ? (
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className={cn('w-4 h-4', primaryColors.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>
    </div>
  );
};

// BDC 서버 IP (방화벽 결재용)
const BDC_SERVER_IP = '10.100.50.10';

// 리소스에서 IP/Host와 Port 추출
interface FirewallRule {
  sourceIp: string;
  destinationIp: string;
  port: number;
}

const extractFirewallRules = (resources: Resource[]): FirewallRule[] => {
  const rules: FirewallRule[] = [];

  resources.forEach((r) => {
    // resourceId에서 IP/Host와 Port 추출 (예: "DB명 (192.168.1.100:3306)")
    const match = r.resourceId.match(/\(([^)]+):(\d+)\)/);
    if (match) {
      const destinations = match[1].split(', '); // 여러 IP인 경우
      const port = parseInt(match[2], 10);
      destinations.forEach((dest) => {
        rules.push({
          sourceIp: BDC_SERVER_IP,
          destinationIp: dest.trim(),
          port,
        });
      });
    }
  });

  // 중복 제거
  const uniqueRules = rules.filter((rule, index, self) =>
    index === self.findIndex((r) =>
      r.sourceIp === rule.sourceIp && r.destinationIp === rule.destinationIp && r.port === rule.port
    )
  );

  return uniqueRules;
};

// 방화벽 가이드 컴포넌트
const FirewallGuide = ({ resources }: { resources: Resource[] }) => {
  const [copied, setCopied] = useState(false);
  const rules = extractFirewallRules(resources);

  if (rules.length === 0) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500">
          등록된 리소스가 없습니다. 리소스를 추가하면 방화벽 결재 정보가 표시됩니다.
        </p>
      </div>
    );
  }

  const generateCsv = (): string => {
    const header = 'Source IP,Destination IP,Port';
    const rows = rules.map((r) => `${r.sourceIp},${r.destinationIp},${r.port}`);
    return [header, ...rows].join('\n');
  };

  const handleCopyCsv = async () => {
    try {
      await navigator.clipboard.writeText(generateCsv());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium text-yellow-800">방화벽 결재 필요</span>
        </div>
        <button
          onClick={handleCopyCsv}
          className="text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 flex items-center gap-1"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              복사됨
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              CSV 복사
            </>
          )}
        </button>
      </div>
      <p className="text-xs text-yellow-700 mb-2">
        아래 정보로 방화벽 결재를 진행하세요.
      </p>
      <div className="overflow-hidden rounded border border-yellow-200">
        <table className="w-full text-xs">
          <thead className="bg-yellow-100">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-yellow-800">Source IP</th>
              <th className="px-2 py-1.5 text-center font-medium text-yellow-800"></th>
              <th className="px-2 py-1.5 text-left font-medium text-yellow-800">Destination IP (등록된 DB)</th>
              <th className="px-2 py-1.5 text-left font-medium text-yellow-800">Port</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-yellow-100">
            {rules.map((rule, idx) => (
              <tr key={idx}>
                <td className="px-2 py-1.5 font-mono text-gray-700">{rule.sourceIp}</td>
                <td className="px-1 py-1.5 text-center text-gray-400">→</td>
                <td className="px-2 py-1.5 font-mono text-gray-700">{rule.destinationIp}</td>
                <td className="px-2 py-1.5 font-mono text-gray-700">{rule.port}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// IDC 설치 상태 표시
const IdcInstallationStatusDisplay = ({
  status,
  resources,
  onRetry,
  onTestConnection,
}: {
  status: IdcInstallationStatusType;
  resources: Resource[];
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
        isBdcCompleted ? 'bg-green-50' : isBdcFailed ? 'bg-red-50' : statusColors.info.bgLight
      }`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
          isBdcCompleted ? 'bg-green-500' : isBdcFailed ? 'bg-red-500' : statusColors.info.dot
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
          isBdcCompleted ? 'text-green-700' : isBdcFailed ? 'text-red-700' : statusColors.info.textDark
        }`}>
          BDC 환경 구성 {isBdcCompleted ? '완료' : isBdcFailed ? '실패' : isBdcInProgress ? '진행 중' : '대기 중'}
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

      {/* 방화벽 가이드 - 방화벽 미확인 상태일 때 항상 표시 (BDC 진행 중에도 미리 결재 가능) */}
      {!status.firewallOpened && (
        <FirewallGuide resources={resources} />
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
  hasPendingResources?: boolean;
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
  hasPendingResources = false,
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
            <p className="text-sm text-gray-500">
              {hasPendingResources
                ? '아래 리소스 목록에서 연동 대상을 확인하고 확정하세요'
                : '아래 리소스 목록에서 연결할 데이터베이스를 등록하세요'}
            </p>
          )}

          {project.processStatus === ProcessStatus.INSTALLING && idcInstallationStatus && (
            <IdcInstallationStatusDisplay
              status={idcInstallationStatus}
              resources={project.resources}
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
