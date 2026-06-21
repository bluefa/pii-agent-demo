'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { bgColors, borderColors, cn, interactiveColors, modalStyles, statusColors, textColors } from '@/lib/theme';

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
  /**
   * Modal chrome. 'default' keeps the shared app styling — byte-identical for
   * existing callers (AWS/Azure/GCP). 'toss' opts into the IDC-only prototype
   * styling (radius 24, 26px title, white footer).
   */
  chrome?: 'default' | 'toss';
  /** Header icon-circle tone (meaningful with toss chrome). 'warn' is the amber warning color. */
  tone?: 'info' | 'warn';
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
  chrome = 'default',
  tone = 'info',
  children,
  footer,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: ModalProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Keep the latest onClose in a ref so the keydown listener doesn't re-bind on
  // every parent render (onClose is often an inline closure).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // ESC 키로 닫기 — re-bind only when isOpen/closeOnEscape change (rare); read
  // the latest onClose from the ref so identity churn never re-binds.
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape]);

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

  // Default (non-toss) branch reproduces the original byte-for-byte class strings
  // (tokens compose in the original order) so AWS/Azure/GCP modals are unchanged.
  const isToss = chrome === 'toss';
  const containerCls = isToss
    ? cn('bg-white shadow-xl w-full mx-4 overflow-hidden', modalStyles.toss.container, SIZE_CLASSES[size])
    : cn('bg-white rounded-xl shadow-xl w-full', SIZE_CLASSES[size], 'mx-4 overflow-hidden');
  const headerCls = isToss
    ? modalStyles.toss.header
    : cn('flex items-center justify-between px-6 py-4 border-b', borderColors.light);
  const iconGroupCls = isToss ? 'flex gap-3 items-start' : 'flex items-center gap-3';
  const iconCls = isToss
    ? cn(modalStyles.toss.iconBase, tone === 'warn' ? modalStyles.toss.iconWarn : modalStyles.toss.iconInfo)
    : cn('w-10 h-10', statusColors.info.bg, 'rounded-lg flex items-center justify-center flex-shrink-0');
  const titleCls = isToss ? modalStyles.toss.title : cn('text-lg font-bold', textColors.primary);
  const subtitleCls = isToss ? modalStyles.toss.subtitle : cn('text-sm', textColors.tertiary);
  const bodyCls = isToss ? modalStyles.toss.body : 'p-6';
  const footerCls = isToss
    ? modalStyles.toss.footer
    : cn('px-6 py-4 border-t', borderColors.light, bgColors.muted, 'flex justify-end gap-3');

  return (
    <div ref={overlayRef} className={modalStyles.overlay} onClick={handleBackdropClick}>
      <div className={containerCls} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {/* Header */}
        <div className={headerCls}>
          <div className={iconGroupCls}>
            {icon && <div className={iconCls}>{icon}</div>}
            <div>
              <h2 id="modal-title" className={titleCls}>
                {title}
              </h2>
              {subtitle && <p className={subtitleCls}>{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn('p-2', interactiveColors.closeButton, 'rounded-lg transition-colors')}
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={bodyCls}>{children}</div>

        {/* Footer */}
        {footer && <div className={footerCls}>{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
