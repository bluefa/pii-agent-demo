'use client';

import { useEffect, useRef, ReactNode } from 'react';

export interface ModalProps {
  /** 모달 표시 여부 */
  isOpen: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** 모달 제목 */
  title: string;
  /** 모달 부제목 (선택) */
  subtitle?: string;
  /** 헤더 아이콘 (선택) */
  icon?: ReactNode;
  /** 모달 크기 */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** 모달 본문 */
  children: ReactNode;
  /** 푸터 영역 (버튼 등) */
  footer?: ReactNode;
  /** 배경 클릭으로 닫기 허용 여부 */
  closeOnBackdropClick?: boolean;
  /** ESC 키로 닫기 허용 여부 */
  closeOnEscape?: boolean;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

/**
 * 재사용 가능한 모달 컴포넌트
 *
 * @example
 * <Modal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="제목"
 *   subtitle="부제목"
 *   footer={
 *     <>
 *       <Button variant="secondary" onClick={onClose}>취소</Button>
 *       <Button onClick={onConfirm}>확인</Button>
 *     </>
 *   }
 * >
 *   <p>모달 내용</p>
 * </Modal>
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  children,
  footer,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: ModalProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // ESC 키로 닫기
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // 모달 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 배경 클릭 핸들러
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${SIZE_CLASSES[size]} mx-4 overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h2 id="modal-title" className="text-lg font-bold text-gray-900">
                {title}
              </h2>
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
