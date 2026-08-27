'use client';

/**
 * 값 옆의 복사 하나 — 「상세 정보」 폴드가 쓰던 것을 마스트헤드의 GCP kv 줄과 나눠 쓰기
 * 위해 제 모듈로 나왔다 (오너 2026-08-27). 동작은 그대로다.
 */
import { useState, type ReactElement } from 'react';
import { TIMINGS } from '@/lib/constants/timings';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

export interface CopyButtonProps {
  value: string;
  label: string;
}

/** 전문 옆의 복사 — 값이 아니라 동작이라 아이콘 하나로 서고, 누른 뒤 체크로 답한다. */
export function CopyButton({ value, label }: CopyButtonProps): ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={opsStyles.fmCopy}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), TIMINGS.COPY_FEEDBACK_MS);
        } catch (error) {
          console.warn('[CopyButton] clipboard.writeText failed', { error, label });
        }
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size="sm" />
    </button>
  );
}
