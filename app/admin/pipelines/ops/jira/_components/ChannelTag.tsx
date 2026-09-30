/**
 * 협업 채널 상태 태그 — 표의 셀과 모달의 상태 줄이 같은 것을 그린다.
 *
 * 상태는 색 점이 아니라 글자 태그다 (한 줄 한 사실). 톤은 판정이다: CREATED ok ·
 * PENDING info · RETRYING warn · FAILED err · NONE/조회 실패 off. 모양은
 * `opsStyles.lifecycleTag.base` 와 같은 20px 스트로크 태그다.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import type { CollaborationChannel } from '@/lib/types/collaboration-channel';

type Tone = 'ok' | 'info' | 'warn' | 'err' | 'off';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-[var(--pl-ok-text)] bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  info: 'border-[var(--pl-info-text)] bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]',
  warn: 'border-[var(--pl-warn-text)] bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  err: 'border-[var(--pl-err-text)] bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  off: 'border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] text-[var(--pl-text-medium)]',
};

/**
 * 태그 문구. RETRYING 의 (n/m) 은 둘 다 있을 때만 — attempt_count 가 0(인증 문제로
 * 아직 한 번도 못 셈)이거나 max_attempts 가 없으면 괄호를 뺀다.
 */
export function channelTagCopy(channel: CollaborationChannel | null): { text: string; tone: Tone } {
  if (!channel) return { text: '조회 실패', tone: 'off' };
  switch (channel.status) {
    case 'CREATED':
      return { text: '생성됨', tone: 'ok' };
    case 'PENDING':
      return { text: '티켓 생성 중', tone: 'info' };
    case 'RETRYING': {
      const counted = channel.attemptCount != null && channel.attemptCount > 0 && channel.maxAttempts != null;
      return {
        text: counted ? `재시도 중 (${channel.attemptCount}/${channel.maxAttempts})` : '재시도 중',
        tone: 'warn',
      };
    }
    case 'FAILED':
      return { text: '자동 생성 실패', tone: 'err' };
    case 'NONE':
      return { text: '티켓 없음', tone: 'off' };
  }
}

export function ChannelTag({ channel }: { channel: CollaborationChannel | null }): ReactElement {
  const { text, tone } = channelTagCopy(channel);
  return <span className={cn(opsStyles.lifecycleTag.base, TONE_CLASS[tone])}>{text}</span>;
}

/** Watcher 실패 태그 — 같은 모양, err 톤. */
export function WatcherFailTag({ count }: { count: number }): ReactElement {
  return (
    <span className={cn(opsStyles.lifecycleTag.base, TONE_CLASS.err)}>Watcher {count}명 실패</span>
  );
}
