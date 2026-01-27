import { useState, useCallback } from 'react';

/**
 * 모달 상태 관리 훅
 *
 * @template T - 모달에 전달할 데이터 타입 (선택)
 *
 * @example
 * // 기본 사용 (데이터 없음)
 * const modal = useModal();
 * <button onClick={modal.open}>열기</button>
 * <Modal isOpen={modal.isOpen} onClose={modal.close}>...</Modal>
 *
 * @example
 * // 데이터와 함께 사용
 * const detailModal = useModal<User>();
 * <button onClick={() => detailModal.open(user)}>상세보기</button>
 * {detailModal.data && (
 *   <Modal isOpen={detailModal.isOpen} onClose={detailModal.close}>
 *     <p>{detailModal.data.name}</p>
 *   </Modal>
 * )}
 */
export interface UseModalReturn<T = undefined> {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 모달에 전달된 데이터 */
  data: T | undefined;
  /** 모달 열기 (데이터 전달 가능) */
  open: (data?: T) => void;
  /** 모달 닫기 (데이터 초기화) */
  close: () => void;
  /** 모달 토글 */
  toggle: () => void;
}

export const useModal = <T = undefined>(): UseModalReturn<T> => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | undefined>(undefined);

  const open = useCallback((modalData?: T) => {
    setData(modalData);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // 닫힐 때 데이터 초기화 (애니메이션 후 초기화하려면 setTimeout 사용)
    setData(undefined);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return { isOpen, data, open, close, toggle };
};

export default useModal;
