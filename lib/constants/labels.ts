/**
 * 라벨 상수 모음
 *
 * UI에서 사용되는 라벨, 에러 메시지, 상태 텍스트 등을 중앙에서 관리합니다.
 */

import { ProcessStatus, ConnectionStatus } from '../types';

/**
 * 연결 에러 타입 라벨
 */
export const ERROR_TYPE_LABELS: Record<string, string> = {
  AUTH_FAILED: '인증 실패',
  PERMISSION_DENIED: '권한 부족',
  NETWORK_ERROR: '네트워크 오류',
  TIMEOUT: '연결 타임아웃',
  UNKNOWN_ERROR: '알 수 없는 오류',
};

/**
 * 프로세스 상태 라벨
 */
export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  [ProcessStatus.WAITING_TARGET_CONFIRMATION]: '연동 대상 확정 대기',
  [ProcessStatus.WAITING_APPROVAL]: '승인 대기',
  [ProcessStatus.INSTALLING]: '설치 진행 중',
  [ProcessStatus.WAITING_CONNECTION_TEST]: '연결 테스트 필요',
  [ProcessStatus.CONNECTION_VERIFIED]: '연결 확인 완료',
  [ProcessStatus.INSTALLATION_COMPLETE]: '설치 완료',
};

/**
 * 연결 상태 설정
 */
export const CONNECTION_STATUS_CONFIG: Record<ConnectionStatus, {
  label: string;
  className: string;
  icon: string;
}> = {
  CONNECTED: {
    label: '연결됨',
    className: 'text-green-500',
    icon: '●',
  },
  DISCONNECTED: {
    label: '연결 끊김',
    className: 'text-red-500',
    icon: '●',
  },
  PENDING: {
    label: '대기중',
    className: 'text-gray-400',
    icon: '○',
  },
};

/**
 * AWS 리전 라벨
 */
export const REGION_LABELS: Record<string, string> = {
  'ap-northeast-2': '서울 (ap-northeast-2)',
  'ap-northeast-1': '도쿄 (ap-northeast-1)',
  'us-east-1': '버지니아 (us-east-1)',
  'us-west-2': '오레곤 (us-west-2)',
};

/**
 * 리전 코드로 라벨을 가져옵니다. 없으면 코드를 그대로 반환합니다.
 */
export const getRegionLabel = (region: string): string => {
  return REGION_LABELS[region] || region;
};

/**
 * 에러 타입으로 라벨을 가져옵니다. 없으면 기본 메시지를 반환합니다.
 */
export const getErrorTypeLabel = (errorType: string): string => {
  return ERROR_TYPE_LABELS[errorType] || '알 수 없는 오류';
};

/**
 * 프로세스 상태로 라벨을 가져옵니다.
 */
export const getProcessStatusLabel = (status: ProcessStatus): string => {
  return PROCESS_STATUS_LABELS[status] || '알 수 없는 상태';
};
