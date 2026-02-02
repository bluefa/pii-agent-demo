'use client';

import { AzureVmStatus } from '@/lib/types/azure';

interface AzureVmResourceRowProps {
  vm: AzureVmStatus;
  onShowSubnetGuide?: () => void;
}

export const AzureVmResourceRow = ({ vm, onShowSubnetGuide }: AzureVmResourceRowProps) => {
  const isComplete = vm.terraformInstalled && vm.subnetExists;

  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isComplete ? 'bg-green-500' : 'bg-orange-500'}`} />
        <span className="text-sm font-medium text-gray-900 truncate">
          {vm.vmName}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs ${vm.terraformInstalled ? 'text-green-600' : 'text-gray-400'}`}>
          TF: {vm.terraformInstalled ? '완료' : '대기'}
        </span>
        <span className="text-gray-300">|</span>
        {vm.subnetExists ? (
          <span className="text-xs text-green-600">Subnet: 설정됨</span>
        ) : (
          <button
            onClick={onShowSubnetGuide}
            className="text-xs text-orange-600 hover:text-orange-700 hover:underline"
          >
            Subnet: 미설정
          </button>
        )}
      </div>
    </div>
  );
};
