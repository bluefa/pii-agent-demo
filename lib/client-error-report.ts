/**
 * 브라우저 에러 리포터 (관측성 v3, Phase 3).
 *
 * 서버가 볼 수 없는 클라이언트 전용 에러(루트 레이아웃 에러, 바운더리 리포트,
 * unhandled rejection, window.onerror)만 수집한다. API 실패는 서버(withV1)가
 * 원천 기록하므로 여기서 다시 보내지 않는다.
 *
 * 원문 fetch로만 POST한다(fetchJson 금지) — fetchJson을 쓰면 이 리포트가 다시
 * 링버퍼에 쌓이고 상관관계 헤더를 달며, 실패 시 스스로의 rejection 핸들러로
 * 되먹임된다. 모든 실패는 삼킨다.
 */

import { toInternalInfraApiPath } from '@/lib/infra-api';
import { getRecentApiCalls } from '@/lib/fetch-json';

export type ClientErrorType = 'global' | 'boundary' | 'rejection' | 'error-event';

export interface ClientErrorInput {
  type: ClientErrorType;
  message: string;
  stack?: string;
  digest?: string;
  componentStack?: string;
}

const ENDPOINT = toInternalInfraApiPath('/observability/client-errors');

// 스로틀: 동일 메시지 30초 억제 + 전체 분당 10건 상한 (탭 단위 인메모리).
const DEDUPE_MS = 30_000;
const MAX_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

const lastSentAt = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;

function shouldSend(message: string, now: number): boolean {
  const last = lastSentAt.get(message);
  if (last !== undefined && now - last < DEDUPE_MS) return false;

  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= MAX_PER_MINUTE) return false;

  lastSentAt.set(message, now);
  windowCount += 1;
  return true;
}

export function reportClientError(input: ClientErrorInput): void {
  try {
    const now = Date.now();
    if (!shouldSend(input.message, now)) return;

    const payload = {
      type: input.type,
      message: input.message,
      stack: input.stack,
      digest: input.digest,
      componentStack: input.componentStack,
      page: typeof location !== 'undefined' ? location.pathname : undefined,
      breadcrumbs: getRecentApiCalls(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // swallow — the reporter must never surface or re-throw.
    });
  } catch {
    // swallow — serialization or any other failure is non-fatal.
  }
}

let handlersInstalled = false;

/** Idempotent: wires window `error` + `unhandledrejection` once per tab. */
export function installGlobalErrorHandlers(): void {
  if (handlersInstalled || typeof window === 'undefined') return;
  handlersInstalled = true;

  window.addEventListener('error', (event) => {
    reportClientError({
      type: 'error-event',
      message: event.message || 'Uncaught error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      type: 'rejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
