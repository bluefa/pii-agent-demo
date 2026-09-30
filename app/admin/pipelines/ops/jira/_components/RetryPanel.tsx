'use client';

/**
 * 「다시 생성」 — 티켓 버킷 모달의 섹션. `POST …/collaboration-channel/retry` 로 생성을
 * 한 번 더 요청한다. 202 는 접수이지 생성이 아니라, 결과는 [다시 조회] 로 채널을 읽어
 * `status` 로 본다. 접수 중(`manualRetryPending`)에는 버튼이 잠긴다.
 */
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { localClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { useNavCountsRefresh } from '@/app/admin/pipelines/_components/NavCountsRefresh';
import { userErrorText } from '@/app/admin/pipelines/ops/services/_components/errorText';
import { retryCollaborationChannel } from '@/app/lib/api/ops';

const styles = {
  heading: cn(pipelineStyles.text.subsectionTitle, 'block'),
  desc: cn(pipelineStyles.modal.desc, 'mt-1'),
  banner: 'mt-3 flex items-start justify-between gap-3 rounded-lg border px-3.5 py-3 text-[14px] leading-[1.6]',
  bannerLines: 'flex min-w-0 flex-col',
  bannerSub: 'text-[12px] tabular-nums',
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
        return { tone: 'err', text: '서버의 자동 생성 기능이 꺼져 있습니다.', refetch: false };
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
  const linked = channel?.status === 'CREATED' && !!channel.issueKey;
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
      const next = bannerFor(err);
      setBanner(next);
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

  return (
    <section aria-labelledby="ops-jira-retry-heading">
      <h4 id="ops-jira-retry-heading" className={styles.heading}>
        다시 생성
      </h4>
      <p className={styles.desc}>
        jira-manager 에 티켓 생성을 한 번 더 요청합니다. 접수 뒤 결과는 조회로 확인하고, 자동 재시도 종료
        시각은 늘어나지 않습니다.
      </p>

      {linked ? null : (
        <PlButton variant="primary" onClick={() => void retry()} disabled={busy || sending || pending}>
          {sending ? '요청 중…' : '티켓 다시 생성'}
        </PlButton>
      )}

      {pending ? (
        <div role="status" className={cn(styles.banner, styles.tone.info)}>
          <span className={styles.bannerLines}>
            <span>재시도를 접수했어요. 결과는 조회로 확인합니다.</span>
            {requestedAt ? <span className={styles.bannerSub}>요청 {requestedAt}</span> : null}
          </span>
          <PlButton variant="secondary" size="sm" onClick={() => void refetch()} disabled={busy}>
            다시 조회
          </PlButton>
        </div>
      ) : null}

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
    </section>
  );
}
