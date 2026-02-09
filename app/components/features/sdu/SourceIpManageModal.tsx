'use client';

import { useState } from 'react';
import type { SourceIpEntry } from '@/lib/types/sdu';
import { SDU_VALIDATION } from '@/lib/constants/sdu';
import { Modal } from '@/app/components/ui/Modal';
import { getButtonClass, getInputClass, cn, statusColors } from '@/lib/theme';

interface SourceIpManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceIps: SourceIpEntry[];
  onRegister?: (cidr: string) => void;
}

export const SourceIpManageModal = ({
  isOpen,
  onClose,
  sourceIps,
  onRegister,
}: SourceIpManageModalProps) => {
  const [newCidr, setNewCidr] = useState('');
  const [error, setError] = useState('');

  const handleRegister = () => {
    const trimmed = newCidr.trim();
    if (!trimmed) {
      setError('CIDR을 입력하세요.');
      return;
    }
    if (!SDU_VALIDATION.CIDR_REGEX.test(trimmed)) {
      setError('유효하지 않은 CIDR 형식입니다. (예: 10.0.0.0/24)');
      return;
    }
    if (sourceIps.some(ip => ip.cidr === trimmed)) {
      setError('이미 등록된 CIDR입니다.');
      return;
    }

    onRegister?.(trimmed);
    setNewCidr('');
    setError('');
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('ko-KR');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="SourceIP 관리"
      size="xl"
      icon={
        <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      }
    >
      <div className="space-y-6">
        {/* 등록 폼 */}
        <div className={cn('p-4 rounded-lg border', statusColors.info.bg, statusColors.info.border)}>
          <h3 className={cn('text-sm font-semibold mb-3', statusColors.info.textDark)}>새 SourceIP 등록</h3>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={newCidr}
                onChange={(e) => {
                  setNewCidr(e.target.value);
                  setError('');
                }}
                placeholder="예: 10.0.0.0/24"
                className={getInputClass(error ? 'error' : undefined)}
              />
              {error && (
                <p className={cn('text-xs mt-1', statusColors.error.textDark)}>{error}</p>
              )}
            </div>
            <button
              onClick={handleRegister}
              className={getButtonClass('primary', 'md')}
            >
              등록
            </button>
          </div>
        </div>

        {/* SourceIP 목록 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">등록된 SourceIP</h3>

          {sourceIps.length === 0 ? (
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium text-gray-600">등록된 SourceIP가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sourceIps.map((entry) => (
                <div
                  key={entry.cidr}
                  className="p-4 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <code className="text-sm font-mono font-semibold text-gray-900">
                      {entry.cidr}
                    </code>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-gray-500">등록일</dt>
                      <dd className="text-gray-900 font-medium">{formatDate(entry.registeredAt)}</dd>
                    </div>
                    {entry.registeredBy && (
                      <div>
                        <dt className="text-gray-500">등록자</dt>
                        <dd className="text-gray-900 font-medium">{entry.registeredBy}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
