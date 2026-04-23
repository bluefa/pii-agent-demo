'use client';

interface DeleteInfrastructureButtonProps {
  onClick?: () => void;
}

/**
 * Detail page 우측 상단 "인프라 삭제" 버튼.
 *
 * 시안(design/SIT Prototype.html L985-988)의 danger-outline 스타일을 토큰 범주에서
 * 재현: red-100 배경 + red-800 텍스트 + red-200 테두리. 실제 삭제 API 는 아직
 * 제공되지 않으므로 onClick 이 없으면 placeholder alert 로 대체한다.
 */
export const DeleteInfrastructureButton = ({ onClick }: DeleteInfrastructureButtonProps) => {
  const handleClick = onClick ?? (() => alert('인프라 삭제 기능은 아직 준비 중입니다.'));

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
      인프라 삭제
    </button>
  );
};
