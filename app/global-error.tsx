'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/client-error-report';

/**
 * Last-resort boundary for a crash in the root layout itself. It REPLACES the
 * root layout, so it renders its own <html>/<body>, and globals.css/theme may
 * not have loaded — inline styles only (hex values are sanctioned here). Only
 * reachable in a production build (dev shows the Next overlay instead).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      type: 'global',
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'sans-serif', background: '#f9fafb', color: '#111827' }}>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center', padding: 24 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>일시적인 오류가 발생했습니다</h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
              잠시 후 다시 시도해주세요.
              {error.digest && <> (오류 코드: {error.digest})</>}
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#ffffff',
                background: '#0064FF',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
