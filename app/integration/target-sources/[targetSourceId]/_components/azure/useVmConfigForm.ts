'use client';

import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { VmDatabaseConfig } from '@/lib/types';

export interface UseVmConfigFormInput {
  restoredSelectedIds: string[];
  targetSourceId: number;
}

export interface VmConfigForm {
  selectedIds: string[];
  draftVmConfigs: Record<string, VmDatabaseConfig>;
  expandedVmId: string | null;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setExpandedVmId: Dispatch<SetStateAction<string | null>>;
  saveVmConfig: (resourceId: string, config: VmDatabaseConfig) => void;
}

export const useVmConfigForm = ({
  restoredSelectedIds,
  targetSourceId,
}: UseVmConfigFormInput): VmConfigForm => {
  const [selectedIds, setSelectedIds] = useState<string[]>(restoredSelectedIds);
  const [draftVmConfigs, setDraftVmConfigs] = useState<Record<string, VmDatabaseConfig>>({});
  const [expandedVmId, setExpandedVmId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState({ restoredSelectedIds, targetSourceId });

  if (resetKey.restoredSelectedIds !== restoredSelectedIds || resetKey.targetSourceId !== targetSourceId) {
    setResetKey({ restoredSelectedIds, targetSourceId });
    setSelectedIds(restoredSelectedIds);
    setDraftVmConfigs({});
    setExpandedVmId(null);
  }

  const saveVmConfig = useCallback((resourceId: string, config: VmDatabaseConfig) => {
    setDraftVmConfigs((previous) => ({ ...previous, [resourceId]: config }));
  }, []);

  return {
    selectedIds,
    draftVmConfigs,
    expandedVmId,
    setSelectedIds,
    setExpandedVmId,
    saveVmConfig,
  };
};
