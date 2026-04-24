'use client';

import { useState } from 'react';
import { getConfirmedIntegration, type ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import { ProcessStatus, type ProjectSummary } from '@/lib/types';
import { cn } from '@/lib/theme';
import { InfraCardHeader } from './InfraCardHeader';
import { InfraCardBody } from './InfraCardBody';

interface InfraCardProps {
  project: ProjectSummary;
  actionLoading: string | null;
  onConfirmCompletion: (targetSourceId: number, e: React.MouseEvent) => void;
  onViewApproval?: (project: ProjectSummary, e: React.MouseEvent) => void;
  onManageAction: (action: 'view' | 'delete', targetSourceId: number) => void;
  onOpenDetail: (targetSourceId: number) => void;
}

type FetchState = 'idle' | 'loading' | 'error';

export const InfraCard = ({
  project,
  actionLoading,
  onConfirmCompletion,
  onViewApproval,
  onManageAction,
  onOpenDetail,
}: InfraCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmedResources, setConfirmedResources] =
    useState<ConfirmedIntegrationResourceItem[] | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('idle');

  const canExpand =
    project.cloudProvider !== 'IDC' &&
    project.cloudProvider !== 'SDU' &&
    project.processStatus >= ProcessStatus.INSTALLING;

  const fetchResources = async () => {
    setFetchState('loading');
    try {
      const res = await getConfirmedIntegration(project.targetSourceId);
      setConfirmedResources(res.resource_infos);
      setFetchState('idle');
    } catch (error: unknown) {
      // 빈 confirmed-integration (신규 정책: empty 는 정상 상태) 도 404 로 오므로 폴백.
      if (isMissingConfirmedIntegrationError(error)) {
        setConfirmedResources([]);
        setFetchState('idle');
        return;
      }
      setConfirmedResources([]);
      setFetchState('error');
    }
  };

  const handleToggle = async () => {
    if (!expanded && confirmedResources === null) {
      await fetchResources();
    }
    setExpanded((prev) => !prev);
  };

  const handleRetry = () => {
    void fetchResources();
  };

  return (
    <div
      className={cn(
        'bg-white border rounded-[10px] overflow-hidden mb-3',
        expanded ? 'border-slate-300' : 'border-gray-200',
      )}
    >
      <InfraCardHeader
        project={project}
        canExpand={canExpand}
        expanded={expanded}
        onToggle={handleToggle}
        actionLoading={actionLoading}
        onConfirmCompletion={onConfirmCompletion}
        onViewApproval={onViewApproval}
        onManageAction={onManageAction}
        onOpenDetail={onOpenDetail}
      />
      {canExpand && expanded && (
        <InfraCardBody
          resources={confirmedResources}
          loading={fetchState === 'loading'}
          error={fetchState === 'error'}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
};
