'use client';

import { DeleteIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { borderColors, cn, deleteInfraButtonStyle } from '@/lib/theme';

interface DeleteInfrastructureButtonProps {
  onClick?: () => void;
  className?: string;
}

/**
 * "인프라 삭제" destructive action — rendered at the foot of the content column
 * (`InfraDangerZone`). Quiet danger-outline optics via `deleteInfraButtonStyle`.
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

/**
 * Where the destructive action lives: last thing in the content column, alone under a
 * hairline.
 *
 * It used to be pinned to the guide rail's bottom edge, and the reasons for that still
 * hold here — one predictable spot, visually isolated, not competing with the step's own
 * CTA. What the rail could not give it is REACHABILITY. That rail vanished below 1360px
 * and now folds on request, and a surface that can be put away must never hold the only
 * copy of an irreversible action.
 *
 * Right-aligned: the column's step cards are left-anchored, so the opposite edge is the
 * one place nothing else claims, and it keeps the button off the reading path down the
 * page. Last in the DOM, so it is also last in the tab order.
 */
export const InfraDangerZone = () => (
  <div className={cn('flex justify-end border-t pt-5', borderColors.default)}>
    <DeleteInfrastructureButton />
  </div>
);
