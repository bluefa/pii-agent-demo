'use client';

import { DownloadIcon } from '@/app/components/ui/icons';

interface ExportButtonProps {
  onClick: () => void;
}

export const ExportButton = ({ onClick }: ExportButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200"
    style={{
      background: 'linear-gradient(135deg, #0064FF 0%, #4f46e5 100%)',
      color: '#ffffff',
      boxShadow: '0 1px 3px 0 rgba(0, 100, 255, 0.3)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(0, 100, 255, 0.4)';
      e.currentTarget.style.transform = 'translateY(-1px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 100, 255, 0.3)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}
  >
    <DownloadIcon />
    CSV 추출
  </button>
);
