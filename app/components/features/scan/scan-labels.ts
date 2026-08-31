import type { ScanCopy } from '@/app/components/features/scan/copy';
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

/**
 * ScanJobResponse.scan_status → display label, in the reader's language (the
 * history modal and the strip share it).
 *
 * A function of the dictionary rather than a constant: the map is a plain module
 * that cannot call `useLocale`, so the render site passes `SCAN_COPY[locale]` in.
 */
export const scanStatusLabels = (t: ScanCopy): Record<string, string> => ({
  SCANNING: t.statusScanning,
  SUCCESS: t.statusSuccess,
  FAIL: t.statusFail,
  TIMEOUT: t.statusTimeout,
  CANCELED: t.statusCanceled,
});

/** ScanJobResponse.scan_error → display label. Same rule as above. */
export const scanErrorLabels = (t: ScanCopy): Record<string, string> => ({
  AUTH_PERMISSION_ERROR: t.errorAuthPermission,
  RATE_LIMIT: t.errorRateLimit,
  NETWORK_ERROR: t.errorNetwork,
  SERVICE_ERROR: t.errorService,
  UNKNOWN: t.errorUnknown,
});

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
