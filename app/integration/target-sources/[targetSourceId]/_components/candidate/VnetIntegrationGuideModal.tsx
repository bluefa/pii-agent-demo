'use client';

import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { cn, statusColors, textColors } from '@/lib/theme';
import { AZURE_GUIDE_URLS, AZURE_NETWORKING_MODE_LABELS } from '@/lib/constants/azure';

interface VnetIntegrationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceId: string;
}

const WarningIcon = () => (
  <svg className={cn('w-5 h-5', statusColors.warning.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export const VnetIntegrationGuideModal = ({ isOpen, onClose, resourceId }: VnetIntegrationGuideModalProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Private Endpoint 연결 불가"
    size="md"
    footer={<Button variant="secondary" onClick={onClose}>닫기</Button>}
  >
    <div className="space-y-4">
      {/* 경고 아이콘 + 리소스 ID */}
      <div className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg', statusColors.warning.bg)}>
        <WarningIcon />
        <span className={cn('text-sm font-mono break-all', textColors.tertiary)}>{resourceId}</span>
      </div>

      {/* 원인 설명 */}
      <div className="space-y-2">
        <p className={cn('text-sm leading-relaxed', textColors.secondary)}>
          이 리소스는 <strong className={textColors.primary}>{AZURE_NETWORKING_MODE_LABELS.VNET_INTEGRATION}</strong> 모드로
          생성되어 Private Endpoint를 통한 연결이 불가능합니다.
        </p>
        <p className={cn('text-sm leading-relaxed', textColors.tertiary)}>
          Azure MySQL/PostgreSQL Flexible Server는 생성 시 네트워킹 모드를 선택하며, 이후 변경할 수 없습니다.
        </p>
      </div>

      {/* 해결 방법 */}
      <div className={cn('p-3 rounded-lg border', statusColors.info.bg, statusColors.info.border)}>
        <p className={cn('text-sm font-medium mb-1', statusColors.info.textDark)}>해결 방법</p>
        <p className={cn('text-sm', textColors.secondary)}>
          <strong>{AZURE_NETWORKING_MODE_LABELS.PUBLIC_ACCESS}</strong> 모드로 새 서버를 생성한 뒤 데이터를 마이그레이션하세요.
        </p>
      </div>

      {/* Azure 문서 링크 */}
      <a
        href={AZURE_GUIDE_URLS.VNET_NETWORKING}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('inline-flex items-center gap-1.5 text-sm font-medium', statusColors.info.text, 'hover:underline')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        Azure VNet 네트워킹 문서
      </a>
    </div>
  </Modal>
);
