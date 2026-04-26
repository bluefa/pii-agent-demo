import { ProcessStatus } from '@/lib/types';

export const isLayoutRoutedStatus = (status: ProcessStatus): boolean =>
  status === ProcessStatus.WAITING_APPROVAL ||
  status === ProcessStatus.APPLYING_APPROVED ||
  status === ProcessStatus.INSTALLING ||
  status === ProcessStatus.WAITING_CONNECTION_TEST ||
  status === ProcessStatus.CONNECTION_VERIFIED ||
  status === ProcessStatus.INSTALLATION_COMPLETE;
