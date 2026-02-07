'use client';

import { useState } from 'react';
import type { IamUser } from '@/lib/types/sdu';
import { Modal } from '@/app/components/ui/Modal';
import { getButtonClass, cn, statusColors } from '@/lib/theme';

interface IamUserManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  iamUser: IamUser | null;
  isAdmin: boolean;
  onReissue?: () => void;
  reissuing?: boolean;
}

export const IamUserManageModal = ({
  isOpen,
  onClose,
  iamUser,
  isAdmin,
  onReissue,
  reissuing = false,
}: IamUserManageModalProps) => {
  const [showReissueConfirm, setShowReissueConfirm] = useState(false);

  const handleReissue = () => {
    onReissue?.();
    setShowReissueConfirm(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const renderRow = (label: string, value: string) => (
    <div className="flex items-start gap-4 py-3 border-b border-gray-100 last:border-b-0">
      <dt className="w-32 text-sm font-medium text-gray-500 flex-shrink-0">{label}</dt>
      <dd className="flex-1 text-sm text-gray-900">{value}</dd>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="IAM USER 관리"
      size="lg"
      icon={
        <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      }
    >
      {!iamUser ? (
        <div className="py-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-gray-600">IAM USER 정보가 없습니다.</p>
          <p className="text-xs text-gray-500 mt-1">설치 프로세스를 통해 생성됩니다.</p>
        </div>
      ) : (
        <>
          {/* 재발급 확인 Dialog */}
          {showReissueConfirm && (
            <div className={cn('mb-6 p-4 rounded-lg border', statusColors.warning.bg, statusColors.warning.border)}>
              <div className="flex items-start gap-3">
                <svg className={cn('w-5 h-5 flex-shrink-0', statusColors.warning.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h4 className={cn('text-sm font-bold mb-1', statusColors.warning.textDark)}>AK/SK 재발급 확인</h4>
                  <p className={cn('text-sm mb-3', statusColors.warning.textDark)}>
                    기존 AK/SK는 즉시 무효화됩니다. 연결된 서비스에 영향을 줄 수 있습니다.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleReissue}
                      disabled={reissuing}
                      className={cn(getButtonClass('danger', 'sm'), 'disabled:opacity-50')}
                    >
                      {reissuing ? '재발급 중...' : '확인'}
                    </button>
                    <button
                      onClick={() => setShowReissueConfirm(false)}
                      disabled={reissuing}
                      className={getButtonClass('secondary', 'sm')}
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IAM User 정보 */}
          <dl className="divide-y divide-gray-100">
            {renderRow('USER명', iamUser.userName)}
            {renderRow('AK/SK 발급일', formatDate(iamUser.akSkIssuedAt))}
            {renderRow('발급자', iamUser.akSkIssuedBy || '-')}
            {renderRow('만료일', formatDate(iamUser.akSkExpiresAt))}
          </dl>

          {/* 관리자 전용 액션 */}
          {isAdmin && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={() => setShowReissueConfirm(true)}
                disabled={reissuing}
                className={cn(getButtonClass('danger', 'md'), 'w-full disabled:opacity-50')}
              >
                {reissuing ? 'AK/SK 재발급 중...' : 'AK/SK 재발급'}
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                재발급 시 기존 키는 즉시 무효화됩니다.
              </p>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};
