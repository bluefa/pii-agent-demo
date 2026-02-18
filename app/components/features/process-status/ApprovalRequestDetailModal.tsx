'use client';

import { Modal } from '@/app/components/ui/Modal';
import type { ApprovalHistoryResponse } from '@/app/lib/api';
import { cn, statusColors, getButtonClass } from '@/lib/theme';

type ApprovalRequest = ApprovalHistoryResponse['content'][0]['request'];

interface ApprovalRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ApprovalRequest | null;
}

export const ApprovalRequestDetailModal = ({
  isOpen,
  onClose,
  request,
}: ApprovalRequestDetailModalProps) => {
  if (!request) return null;

  const { resource_inputs, exclusion_reason_default } = request.input_data;
  const selectedResources = resource_inputs.filter((r) => r.selected);
  const excludedResources = resource_inputs.filter((r) => !r.selected);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="승인 요청 내용"
      size="lg"
      icon={
        <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      footer={
        <button onClick={onClose} className={getButtonClass('secondary')}>
          닫기
        </button>
      }
    >
      <div className="space-y-4">
        {/* 요청 정보 */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>요청일시: {new Date(request.requested_at).toLocaleString('ko-KR')}</span>
          <span>요청자: {request.requested_by}</span>
        </div>

        {/* 요약 */}
        <div className="flex gap-3">
          <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', statusColors.info.bg, statusColors.info.textDark)}>
            포함 {selectedResources.length}개
          </span>
          {excludedResources.length > 0 && (
            <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', statusColors.pending.bg, statusColors.pending.textDark)}>
              제외 {excludedResources.length}개
            </span>
          )}
        </div>

        {/* 포함 리소스 */}
        {selectedResources.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">포함 리소스</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">리소스 ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Credential</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Endpoint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedResources.map((r) => (
                    <tr key={r.resource_id}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.resource_id}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {r.resource_input?.credential_id || '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {r.resource_input?.endpoint_config
                          ? `${r.resource_input.endpoint_config.host}:${r.resource_input.endpoint_config.port}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 제외 리소스 */}
        {excludedResources.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">제외 리소스</h4>
            <div className="border border-gray-200 rounded-lg p-3 space-y-1">
              {excludedResources.map((r) => (
                <div key={r.resource_id} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-gray-600">{r.resource_id}</span>
                  <span className="text-gray-400">{r.exclusion_reason || exclusion_reason_default || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
