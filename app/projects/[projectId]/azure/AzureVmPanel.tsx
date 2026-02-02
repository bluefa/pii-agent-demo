'use client';

import { useState } from 'react';
import { AzureVmStatus } from '@/lib/types/azure';
import { AzureServiceIcon } from '@/app/components/ui/AzureServiceIcon';
import { AzureSubnetGuide } from './AzureSubnetGuide';

interface AzureVmPanelProps {
  projectId: string;
  vms: AzureVmStatus[];
  onRefresh?: () => void;
  refreshing?: boolean;
}

const VmStatusRow = ({ vm, onShowGuide }: { vm: AzureVmStatus; onShowGuide: () => void }) => {
  const isComplete = vm.terraformInstalled && vm.subnetExists;

  return (
    <div className={`p-4 rounded-lg border ${isComplete ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <AzureServiceIcon type="AZURE_VM" size="md" />
          <div>
            <div className="font-medium text-gray-900">{vm.vmName}</div>
            <div className="text-xs text-gray-500 font-mono">{vm.vmId}</div>
          </div>
        </div>
        {isComplete && (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <span className={vm.terraformInstalled ? 'text-green-600' : 'text-gray-500'}>
          TF: {vm.terraformInstalled ? '완료' : '대기 중'}
        </span>
        <span className="text-gray-300">|</span>
        <span className={vm.subnetExists ? 'text-green-600' : 'text-orange-600'}>
          Subnet: {vm.subnetExists ? '설정됨' : '미설정'}
        </span>
      </div>
      {!vm.subnetExists && (
        <button
          onClick={onShowGuide}
          className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Subnet 설정 가이드
        </button>
      )}
    </div>
  );
};

export const AzureVmPanel = ({ projectId, vms, onRefresh, refreshing }: AzureVmPanelProps) => {
  const [showGuide, setShowGuide] = useState(false);

  const hasSubnetIssue = vms.some(vm => !vm.subnetExists);
  const completedCount = vms.filter(vm => vm.terraformInstalled && vm.subnetExists).length;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              VM 설치 상태
            </h3>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors text-sm"
            >
              {refreshing ? (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              새로고침
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        {hasSubnetIssue && (
          <div className="mx-6 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <p className="text-orange-800 font-medium">VM 리소스는 Subnet 설정이 필요합니다</p>
                <p className="text-orange-600 mt-1">
                  Agent 설치를 위해 VM이 위치한 VNet에 Subnet을 생성하고 Terraform 스크립트에 적용해야 합니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-3">
          {vms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              VM 리소스가 없습니다.
            </div>
          ) : (
            vms.map((vm) => (
              <VmStatusRow key={vm.vmId} vm={vm} onShowGuide={() => setShowGuide(true)} />
            ))
          )}
        </div>

        {/* Footer */}
        {vms.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex items-center justify-between">
            <span className="text-gray-500 text-sm">
              {completedCount}/{vms.length} 설치 완료
            </span>
            <button
              onClick={() => window.open(`/api/azure/projects/${projectId}/terraform-script`, '_blank')}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              TF 스크립트 다운로드
            </button>
          </div>
        )}
      </div>

      {/* Subnet Guide Modal */}
      {showGuide && <AzureSubnetGuide onClose={() => setShowGuide(false)} />}
    </>
  );
};
