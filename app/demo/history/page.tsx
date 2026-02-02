'use client';

import { useState } from 'react';
import { ProjectHistory, ProjectHistoryType, ProcessStatus } from '@/lib/types';
import { ProjectHistoryTable, ProjectHistoryDetailModal } from '@/app/components/features/history';
import { cardStyles, cn } from '@/lib/theme';

// 데모용 목 데이터
const generateDemoHistory = (): ProjectHistory[] => {
  const actors = [
    { id: 'user-1', name: '김철수' },
    { id: 'admin-1', name: '박관리자' },
    { id: 'system', name: '시스템' },
  ];

  const types: { type: ProjectHistoryType; actor: typeof actors[number]; details: ProjectHistory['details'] }[] = [
    { type: 'TARGET_CONFIRMED', actor: actors[0], details: { resourceCount: 5, excludedResourceCount: 1 } },
    { type: 'AUTO_APPROVED', actor: actors[2], details: {} },
    { type: 'TARGET_CONFIRMED', actor: actors[0], details: { resourceCount: 3, excludedResourceCount: 0 } },
    { type: 'APPROVAL', actor: actors[1], details: {} },
    { type: 'REJECTION', actor: actors[1], details: { reason: '리소스 정보가 불완전합니다. Credential 등록을 확인해주세요.' } },
    { type: 'TARGET_CONFIRMED', actor: actors[0], details: { resourceCount: 8, excludedResourceCount: 2 } },
  ];

  const now = Date.now();

  return types.map((item, index) => ({
    id: `demo-history-${index}`,
    projectId: 'demo-project',
    type: item.type,
    actor: item.actor,
    timestamp: new Date(now - index * 86400000).toISOString(),
    details: item.details,
  }));
};

const demoHistory = generateDemoHistory();

// 프로세스 상태 라벨
const processStatusLabels: Record<ProcessStatus, string> = {
  [ProcessStatus.WAITING_TARGET_CONFIRMATION]: '연동 대상 확정 대기',
  [ProcessStatus.WAITING_APPROVAL]: '승인 대기',
  [ProcessStatus.INSTALLING]: '설치 진행 중',
  [ProcessStatus.WAITING_CONNECTION_TEST]: '연결 테스트 대기',
  [ProcessStatus.CONNECTION_VERIFIED]: '연결 확인 완료',
  [ProcessStatus.INSTALLATION_COMPLETE]: '설치 완료',
};

type TabType = 'status' | 'history';

export default function HistoryDemoPage() {
  const [selectedItem, setSelectedItem] = useState<ProjectHistory | null>(null);
  const [currentStatus] = useState<ProcessStatus>(ProcessStatus.INSTALLING);
  const [activeTab, setActiveTab] = useState<TabType>('status');

  const tabs: { id: TabType; label: string }[] = [
    { id: 'status', label: '진행 상태' },
    { id: 'history', label: '진행 내역' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 페이지 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">프로젝트 상세</h1>
          <p className="text-gray-500 mt-1">PII Agent 설치 진행 상황</p>
        </div>

        {/* 탭 레이아웃 */}
        <div className={cn(cardStyles.base, 'overflow-hidden')}>
          {/* 탭 헤더 */}
          <div className="border-b border-gray-200">
            <nav className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* 탭 콘텐츠 */}
          <div>
            {activeTab === 'status' && (
              <ProcessStatusContent currentStatus={currentStatus} />
            )}
            {activeTab === 'history' && (
              <HistoryContent
                history={demoHistory}
                onItemClick={(item) => setSelectedItem(item)}
              />
            )}
          </div>
        </div>

        {/* 하단: 컴포넌트 설명 */}
        <ComponentExplanation />
      </div>

      {/* 상세 모달 */}
      {selectedItem && (
        <ProjectHistoryDetailModal
          history={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

// 진행 상태 콘텐츠
const ProcessStatusContent = ({ currentStatus }: { currentStatus: ProcessStatus }) => {
  const steps = [
    { status: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 확정' },
    { status: ProcessStatus.WAITING_APPROVAL, label: '승인' },
    { status: ProcessStatus.INSTALLING, label: '설치' },
    { status: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
    { status: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
  ];

  const currentIndex = steps.findIndex(s => s.status === currentStatus);

  return (
    <div className="p-6">
      {/* 현재 상태 표시 */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-600 font-medium">현재 진행 단계</p>
        <p className="text-xl font-bold text-blue-800 mt-1">
          {processStatusLabels[currentStatus]}
        </p>
      </div>

      {/* 단계 표시 */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.status} className="flex items-center gap-3">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  isCompleted && 'bg-green-500 text-white',
                  isCurrent && 'bg-blue-500 text-white',
                  !isCompleted && !isCurrent && 'bg-gray-200 text-gray-500'
                )}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'text-sm',
                  isCompleted && 'text-green-700',
                  isCurrent && 'text-blue-700 font-medium',
                  !isCompleted && !isCurrent && 'text-gray-400'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 진행 내역 콘텐츠
const HistoryContent = ({
  history,
  onItemClick,
}: {
  history: ProjectHistory[];
  onItemClick: (item: ProjectHistory) => void;
}) => {
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div>
      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-end">
        <button
          onClick={handleRefresh}
          className="text-sm text-blue-600 hover:text-blue-800"
          disabled={loading}
        >
          {loading ? '새로고침 중...' : '새로고침'}
        </button>
      </div>
      <ProjectHistoryTable
        history={history}
        loading={loading}
        onRowClick={onItemClick}
      />
    </div>
  );
};

// 컴포넌트 설명 섹션
const ComponentExplanation = () => {
  return (
    <div className={cn(cardStyles.base, 'p-6')}>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">UI 구성 요소</h2>
      <div className="grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="font-medium text-gray-700 mb-2">진행 상태 탭</p>
          <ul className="space-y-1 text-gray-600">
            <li>• 프로세스 5단계 진행 상황 표시</li>
            <li>• 현재 단계 강조 (파란색)</li>
            <li>• 완료된 단계 체크 표시 (녹색)</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-gray-700 mb-2">진행 내역 탭</p>
          <ul className="space-y-1 text-gray-600">
            <li>• 변경 이력 테이블 (시간순)</li>
            <li>• 각 뱃지에 Tooltip으로 설명 표시</li>
            <li>• 로딩 상태 지원</li>
            <li>• 행 클릭 시 상세 모달</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100">
        <p className="font-medium text-gray-700 mb-2">Tooltip 기능</p>
        <p className="text-gray-600">
          뱃지(연동 확정, 자동승인, 승인, 반려 등)에 마우스를 올리면 해당 상태에 대한 설명이 표시됩니다.
        </p>
      </div>
    </div>
  );
};
