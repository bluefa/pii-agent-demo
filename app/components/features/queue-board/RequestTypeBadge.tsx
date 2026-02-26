'use client';

import { cn } from '@/lib/theme';
import type { ApprovalRequestType } from '@/lib/types/queue-board';

interface RequestTypeBadgeProps {
  requestType: ApprovalRequestType;
  requestTypeName: string;
  /** Optional status suffix text (e.g. "대기중", "반영중", "승인") */
  statusSuffix?: string;
  /** Status suffix color: 'pending' | 'processing' | 'approved' | 'rejected' */
  statusVariant?: 'pending' | 'processing' | 'approved' | 'rejected';
}

// Request type color mapping (inline — no theme token for domain-specific categories)
const TYPE_STYLES: Record<ApprovalRequestType, { bg: string; text: string; border: string }> = {
  TARGET_CONFIRMATION: {
    bg: 'bg-blue-50',       // blue for confirmation workflow
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  END_OF_SERVICE: {
    bg: 'bg-amber-50',      // amber for EoS teardown
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
};

const STATUS_SUFFIX_COLORS: Record<string, string> = {
  pending: 'text-gray-500',
  processing: 'text-orange-600',
  approved: 'text-[#2A7D52]',
  rejected: 'text-red-600',
};

export const RequestTypeBadge = ({
  requestType,
  requestTypeName,
  statusSuffix,
  statusVariant,
}: RequestTypeBadgeProps) => {
  const style = TYPE_STYLES[requestType];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border',
          style.bg,
          style.text,
          style.border,
        )}
      >
        {requestTypeName}
      </span>
      {statusSuffix && (
        <span
          className={cn(
            'text-xs',
            statusVariant ? STATUS_SUFFIX_COLORS[statusVariant] : 'text-gray-500',
          )}
        >
          {statusSuffix}
        </span>
      )}
    </span>
  );
};
