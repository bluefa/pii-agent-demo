import { ProcessStatus, type Resource } from '@/lib/types';
import { statusColors, textColors } from '@/lib/theme';

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

const INTEGRATION_STATUS_TEXT_CLASS: Record<ResourceIntegrationStatus, string> = {
  '연동 완료': statusColors.success.textDark,
  '연동 진행중': statusColors.info.textDark,
  '—': textColors.quaternary,
};

export const getIntegrationStatusTextClass = (status: ResourceIntegrationStatus): string =>
  INTEGRATION_STATUS_TEXT_CLASS[status];
