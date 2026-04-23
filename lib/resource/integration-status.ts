import { ProcessStatus, type Resource } from '@/lib/types';

export type ResourceIntegrationStatus = '연동 완료' | '연동 진행중' | '—';

export const getResourceIntegrationStatus = (
  resource: Resource,
  processStatus: ProcessStatus,
): ResourceIntegrationStatus => {
  if (!resource.isSelected) return '—';
  if (processStatus === ProcessStatus.INSTALLATION_COMPLETE) return '연동 완료';
  if (processStatus >= ProcessStatus.APPLYING_APPROVED) return '연동 진행중';
  return '—';
};
