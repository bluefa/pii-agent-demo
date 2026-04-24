'use client';

import { useCallback, useState } from 'react';
import type { VmDatabaseConfig } from '@/lib/types';

export function useProjectPageFormState() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [vmConfigs, setVmConfigs] = useState<Record<string, VmDatabaseConfig>>({});
  const [submitting, setSubmitting] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [expandedVmId, setExpandedVmId] = useState<string | null>(null);

  const openApprovalModal = useCallback(() => {
    setApprovalError(null);
    setApprovalModalOpen(true);
  }, []);

  const closeApprovalModal = useCallback(() => {
    setApprovalModalOpen(false);
    setApprovalError(null);
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    vmConfigs,
    setVmConfigs,
    submitting,
    setSubmitting,
    approvalModalOpen,
    openApprovalModal,
    closeApprovalModal,
    approvalError,
    setApprovalError,
    expandedVmId,
    setExpandedVmId,
  };
}
