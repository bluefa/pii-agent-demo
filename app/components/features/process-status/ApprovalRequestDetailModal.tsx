import { Modal } from '@/app/components/ui/Modal';
import type { ApprovalHistoryResponse } from '@/app/lib/api';
import { cn, statusColors, getButtonClass, textColors, bgColors, borderColors, tableStyles } from '@/lib/theme';

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
        <div className={cn('flex items-center gap-4 text-sm', textColors.tertiary)}>
          <span>요청일시: {new Date(request.requested_at).toLocaleString('ko-KR')}</span>
          <span>요청자: {request.requested_by}</span>
        </div>

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

        {selectedResources.length > 0 && (
          <div>
            <h4 className={cn('text-sm font-medium mb-2', textColors.secondary)}>포함 리소스</h4>
            <div className={cn('border rounded-lg overflow-hidden', borderColors.default)}>
              <table className="w-full text-sm">
                <thead className={bgColors.muted}>
                  <tr>
                    <th className={cn('px-3 py-2 text-left text-xs font-medium', textColors.tertiary)}>리소스 ID</th>
                    <th className={cn('px-3 py-2 text-left text-xs font-medium', textColors.tertiary)}>Credential</th>
                    <th className={cn('px-3 py-2 text-left text-xs font-medium', textColors.tertiary)}>Endpoint</th>
                  </tr>
                </thead>
                <tbody className={tableStyles.body}>
                  {selectedResources.map((r) => (
                    <tr key={r.resource_id}>
                      <td className={cn('px-3 py-2 font-mono text-xs', textColors.secondary)}>{r.resource_id}</td>
                      <td className={cn('px-3 py-2 text-xs', textColors.tertiary)}>
                        {r.resource_input?.credential_id || '-'}
                      </td>
                      <td className={cn('px-3 py-2 text-xs', textColors.tertiary)}>
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

        {excludedResources.length > 0 && (
          <div>
            <h4 className={cn('text-sm font-medium mb-2', textColors.secondary)}>제외 리소스</h4>
            <div className={cn('border rounded-lg p-3 space-y-1', borderColors.default)}>
              {excludedResources.map((r) => (
                <div key={r.resource_id} className="flex items-center justify-between text-xs">
                  <span className={cn('font-mono', textColors.tertiary)}>{r.resource_id}</span>
                  <span className={textColors.quaternary}>{r.exclusion_reason || exclusion_reason_default || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
