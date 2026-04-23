'use client';

import { DeleteIcon } from '@/app/components/ui/icons';

interface DeleteInfrastructureButtonProps {
  onClick?: () => void;
}

/**
 * Detail page 우측 상단 "인프라 삭제" 버튼.
 *
 * 시안(design/SIT Prototype.html L985-988)의 `.btn.danger-outline` 스타일을
 * theme 토큰으로 재현: red-50 배경 + red-200 테두리 + red-800 텍스트.
 * 실제 삭제 API 는 아직 연동되지 않아 `onClick` 이 없으면 준비중 안내로 대체한다.
 */
export const DeleteInfrastructureButton = ({ onClick }: DeleteInfrastructureButtonProps) => {
  const handleClick = onClick ?? (() => alert('기능 준비중입니다.'));

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-100"
    >
      <DeleteIcon className="h-3.5 w-3.5" />
      인프라 삭제
    </button>
  );
};
