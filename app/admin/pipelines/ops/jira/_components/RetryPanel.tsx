'use client';

/**
 * 티켓 버킷의 동작 띠 — 설명 왼쪽, 주 버튼 하나 오른쪽. `POST …/collaboration-channel/retry`
 * 로 생성을 한 번 더 요청한다. 202 는 접수이지 생성이 아니라, 접수 중(`manualRetryPending`)에는
 * 띠가 접수 상태로 바뀌고 결과는 [다시 조회] 로 채널을 읽어 `status` 로 본다. 배너는 띠 바로
 * 아래 제 블록으로 선다.
 */
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { localClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { useNavCountsRefresh } from '@/app/admin/pipelines/_components/NavCountsRefresh';
import { userErrorText } from '@/app/admin/pipelines/ops/services/_components/errorText';
import { retryCollaborationChannel } from '@/app/lib/api/ops';

const styles = {
  band: 'flex items-center justify-between gap-4 rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-5 py-4',
  bandText: 'min-w-0',
  bandTitle: 'flex items-center gap-2 text-[14px] font-semibold leading-[1.4] text-[var(--pl-text-strong)]',
  bandSub: 'mt-0.5 text-[12px] leading-[1.4] text-[var(--pl-text-weak)] tabular-nums',
  spinner: 'flex-none animate-spin text-[var(--pl-text-weak)] motion-reduce:animate-none',
  banner: 'mt-3 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-[14px] leading-[1.5]',
  tone: {
    info: 'border-[var(--pl-info-text)] bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]',
    warn: 'border-[var(--pl-warn-text)] bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
    err: 'border-[var(--pl-err-text)] bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  },
} as const;

type Banner = { tone: keyof typeof styles.tone; text: string; refetch: boolean } | null;

/** 실패 넷은 서버 code 로, 권한은 status 로 가른다. 그 밖은 서버 문구(없으면 우리 문구). */
const bannerFor = (err: unknown): Banner => {
  if (err instanceof AppError) {
    switch (err.rawCode) {
      case 'JIRA_MANUAL_RETRY_BUSY':
        return { tone: 'warn', text: '이미 접수돼 처리 중입니다. 잠시 후 다시 조회해 주세요.', refetch: true };
      case 'JIRA_MANUAL_RETRY_UNAVAILABLE':
        return { tone: 'info', text: '다시 생성할 수 없는 상태입니다. 현재 값을 다시 불러왔어요.', refetch: false };
      case 'JIRA_TICKET_NOT_FOUND':
        return { tone: 'err', text: '저장된 생성 요청이 없습니다.', refetch: false };
      case 'JIRA_MANUAL_RETRY_DISABLED':
        return {
          tone: 'err',
          text: '서버의 자동 생성 기능이 꺼져 있습니다. 서비스 운영 화면에서 티켓을 직접 연결해 주세요.',
          refetch: false,
        };
    }
    if (err.status === 403) return { tone: 'err', text: '권한이 없습니다.', refetch: false };
  }
  return { tone: 'err', text: userErrorText(err, '요청에 실패했어요. 잠시 후 다시 시도해 주세요.'), refetch: false };
};

export function RetryPanel({
  id,
  channel,
  busy,
  reload,
}: {
  id: number | null;
  channel: CollaborationChannel | null;
  /** 상위가 채널을 읽는 중 — 그동안 버튼이 잠긴다. */
  busy: boolean;
  reload: () => Promise<void>;
}): ReactElement {
  const router = useRouter();
  const toast = usePlToast();
  const refreshCounts = useNavCountsRefresh();
  const [banner, setBanner] = useState<Banner>(null);
  const [sending, setSending] = useState(false);

  const pending = channel?.manualRetryPending === true;
  const requestedAt = localClock(channel?.manualRetryRequestedAt ?? null);

  const retry = async (): Promise<void> => {
    if (id == null) return;
    setBanner(null);
    setSending(true);
    try {
      await retryCollaborationChannel(id);
      toast.show('티켓 생성을 다시 요청했어요');
      router.refresh();
      refreshCounts();
      // 202 는 접수뿐 — 접수 시각과 pending 은 서버가 안다. 다시 읽어 그 사실을 그린다.
      await reload();
    } catch (err) {
      setBanner(bannerFor(err));
      // 다시 생성할 수 없는 상태 — 화면이 낡은 것이니 현재 값을 바로 다시 읽는다.
      if (err instanceof AppError && err.rawCode === 'JIRA_MANUAL_RETRY_UNAVAILABLE') await reload();
    } finally {
      setSending(false);
    }
  };

  const refetch = async (): Promise<void> => {
    setBanner(null);
    await reload();
  };

  // 연결된 티켓에는 요청할 것이 없다 — 띠는 없고, 마지막 배너만 남는다.
  const linked = channel?.status === 'CREATED' && !!channel.issueKey;

  return (
    <div>
      {linked ? null : (
      <div className={styles.band} data-testid="action-band">
        {pending ? (
          <>
            <div className={styles.bandText}>
              <p className={styles.bandTitle}>
                <Icon name="loader" size={14} className={styles.spinner} />
                재시도를 접수했어요
              </p>
              <p className={styles.bandSub}>
                {requestedAt ? `요청 ${requestedAt} · ` : ''}결과는 조회로 확인합니다
              </p>
            </div>
            <PlButton variant="secondary" onClick={() => void refetch()} disabled={busy}>
              다시 조회
            </PlButton>
          </>
        ) : (
          <>
            <div className={styles.bandText}>
              <p className={styles.bandTitle}>지금 한 번 더 생성을 요청합니다</p>
              <p className={styles.bandSub}>접수만 되고 결과는 잠시 뒤 조회로 확인합니다</p>
            </div>
            <PlButton variant="primary" onClick={() => void retry()} disabled={busy || sending}>
              {sending ? <Icon name="loader" size={14} className="animate-spin motion-reduce:animate-none" /> : null}
              티켓 다시 생성
            </PlButton>
          </>
        )}
      </div>
      )}

      {banner ? (
        <div role="status" className={cn(styles.banner, styles.tone[banner.tone])}>
          <span>{banner.text}</span>
          {banner.refetch ? (
            <PlButton variant="secondary" size="sm" onClick={() => void refetch()} disabled={busy}>
              다시 조회
            </PlButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
