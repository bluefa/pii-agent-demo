import type { CloudProvider } from '@/lib/types';

/**
 * 실제로 끝난 스캔의 상태 집합. 계약 enum은 SCANNING/FAIL/CANCELED/SUCCESS/TIMEOUT
 * 이지만 mock BFF는 이력이 없을 때 'NO_SCAN' 센티널 잡을 합성해 돌려준다(loose
 * codegen이라 통과) — 그 잡을 "마지막 스캔 실패"로 그리면 거짓말이 되므로,
 * 스트립·신선도 표기는 이 집합에 든 잡만 결과로 취급한다.
 */
export const TERMINAL_SCAN_STATUSES: ReadonlySet<string> = new Set([
  'SUCCESS',
  'FAIL',
  'TIMEOUT',
  'CANCELED',
]);

/** ScanJobResponse.scan_status → 한국어 표기 (이력 모달·스트립 공용). */
export const SCAN_STATUS_LABELS: Record<string, string> = {
  SCANNING: '진행 중',
  SUCCESS: '성공',
  FAIL: '실패',
  TIMEOUT: '시간 초과',
  CANCELED: '취소',
};

/** ScanJobResponse.scan_error → 한국어 표기. */
export const SCAN_ERROR_LABELS: Record<string, string> = {
  AUTH_PERMISSION_ERROR: '스캔 권한 오류',
  RATE_LIMIT: '요청 한도 초과',
  NETWORK_ERROR: '네트워크 오류',
  SERVICE_ERROR: '서비스 오류',
  UNKNOWN: '알 수 없는 오류',
};

/**
 * 프로바이더별 스캔 자격 명칭 — 권한 확인 UI가 실제 검증 대상을 그대로 부른다
 * (AWS verify-scan-role · GCP scan-service-account · Azure scan-app).
 */
export const SCAN_CREDENTIAL_LABELS: Record<CloudProvider, string> = {
  AWS: 'Scan Role',
  GCP: 'Scan Service Account',
  Azure: 'Scan App',
  IDC: '', // IDC는 클라우드 스캔이 없음 — 호출부가 렌더하지 않는다.
};
