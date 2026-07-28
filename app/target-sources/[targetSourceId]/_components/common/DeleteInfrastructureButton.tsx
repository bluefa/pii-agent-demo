'use client';

import { DeleteIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { cn, deleteInfraButtonStyle } from '@/lib/theme';

interface DeleteInfrastructureButtonProps {
  onClick?: () => void;
  className?: string;
}

/**
 * "인프라 삭제" destructive action — rendered in the guide rail's management
 * footer (GuidePanel). Quiet danger-outline optics via `deleteInfraButtonStyle`.
 * The delete API is not wired yet; without `onClick` a click shows the
 * "기능 준비중" toast instead.
 */
export const DeleteInfrastructureButton = ({ onClick, className }: DeleteInfrastructureButtonProps) => {
  const toast = useToast();
  const handleClick = onClick ?? (() => toast.info('기능 준비중입니다.'));

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(deleteInfraButtonStyle, className)}
    >
      <DeleteIcon className="h-3.5 w-3.5" />
      인프라 삭제
    </button>
  );
};
