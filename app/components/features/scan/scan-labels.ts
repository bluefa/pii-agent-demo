import type { CloudProvider } from '@/lib/types';

/**
 * 실제로 끝난 스캔의 상태 집합. 계약 enum은 SCANNING/SAVING/FAIL/CANCELED/SUCCESS/
 * TIMEOUT 이지만 mock BFF는 이력이 없을 때 'NO_SCAN' 센티널 잡을 합성해 돌려준다
 * (loose codegen이라 통과) — 그 잡을 "마지막 스캔 실패"로 그리면 거짓말이 되므로,
 * 스트립·신선도 표기는 이 집합에 든 잡만 결과로 취급한다. SAVING은 결과를 저장하는
 * 중이라 아직 결과가 아니다: 허용 목록이라 새 상태는 스스로 들어오지 않는다.
 */
export const TERMINAL_SCAN_STATUSES: ReadonlySet<string> = new Set([
  'SUCCESS',
  'FAIL',
  'TIMEOUT',
  'CANCELED',
]);

/**
 * 끝난 스캔인가. 완료 시각·소요 시간은 끝난 잡에만 존재하므로, 그 필드를 그리는
 * 표면은 전부 이 판정을 쓴다 — `!== 'SAVING'` 같은 부정형은 SCANNING 과 이 빌드가
 * 어휘를 갖지 못한 상태를 조용히 "끝남"으로 통과시킨다.
 */
export const isScanSettled = (scanStatus: string | null | undefined): boolean =>
  scanStatus != null && TERMINAL_SCAN_STATUSES.has(scanStatus);

/** ScanJobResponse.scan_status → 한국어 표기 (이력 모달·스트립 공용). */
export const SCAN_STATUS_LABELS: Record<string, string> = {
  SCANNING: '진행 중',
  SAVING: '마무리 중',
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
