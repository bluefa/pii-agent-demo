/**
 * Scan status vocabulary — shared by the 스캔 tab's pill (`scanShared.tsx`) and the
 * 진행 상태 탭의 연동 현황 카드 (`status/statusRows.ts`). It lives outside both for
 * the same reason `terraformState.ts` does: two surfaces name the same enum, and a
 * second copy is a vocabulary that drifts.
 *
 * Pure data — no React — so a Server Component may read it. A `'use client'` module
 * cannot hold it: every export of such a module becomes a client reference, and the
 * card would be reading a proxy instead of a label.
 */

export type ScanTone = 'ok' | 'info' | 'err' | 'off';

/**
 * ScanStatus (app/api/_lib/v1-types.ts) → tone + Korean label. SAVING is the
 * contract's name for the window where discovery is over but the results are
 * still being written — it is a status like any other here, so nothing synthesises
 * a pseudo-status for it any more.
 */
export const SCAN_STATE: Record<string, { tone: ScanTone; label: string }> = {
  SUCCESS: { tone: 'ok', label: '성공' },
  SCANNING: { tone: 'info', label: '스캔 중' },
  SAVING: { tone: 'info', label: '마무리 중' },
  FAIL: { tone: 'err', label: '실패' },
  TIMEOUT: { tone: 'err', label: '타임아웃' },
  CANCELED: { tone: 'off', label: '취소' },
};
