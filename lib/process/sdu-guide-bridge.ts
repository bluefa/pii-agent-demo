import { ProcessStatus } from '@/lib/types';
import type { SduProcessStatus } from '@/lib/types/sdu';

/**
 * SDU 전용 단계 식별자(`SduProcessStatus`)를 GuideCard가 인식하는
 * canonical `ProcessStatus` enum으로 매핑한다.
 *
 * SDU 파이프라인은 6단계, ProcessStatus는 7단계라 1:1 대응이 아니므로
 * 의미상 가장 가까운 단계로 흡수한다.
 */
export const mapSduStatusToProcessStatus = (status: SduProcessStatus): ProcessStatus => {
  switch (status) {
    case 'S3_UPLOAD_PENDING':
      return ProcessStatus.WAITING_TARGET_CONFIRMATION;
    case 'S3_UPLOAD_CONFIRMED':
      return ProcessStatus.APPLYING_APPROVED;
    case 'INSTALLING':
      return ProcessStatus.INSTALLING;
    case 'WAITING_CONNECTION_TEST':
      return ProcessStatus.WAITING_CONNECTION_TEST;
    case 'CONNECTION_VERIFIED':
      return ProcessStatus.CONNECTION_VERIFIED;
    case 'INSTALLATION_COMPLETE':
      return ProcessStatus.INSTALLATION_COMPLETE;
  }
};
