'use client';

/**
 * 티켓 버킷의 동작 띠 — 설명 왼쪽, 주 버튼 하나 오른쪽. `POST …/collaboration-channel/retry`
 * 로 생성을 한 번 더 요청한다. 202 는 접수이지 생성이 아니라, 접수 뒤에는 띠가 **스스로**
 * 채널을 5초마다 다시 읽어(최대 2분) 결과를 기다린다 — 오너: "왜 결과가 바로 안 보이나".
 * 결과가 오면 띠가 답한다(생성됨 → 띠 사라짐 + toast, 또 실패 → 띠 복귀 + 경고 배너); 2분이
 * 지나면 [다시 조회] 가 돌아온다. 배너는 띠 바로 아래 제 블록으로 선다.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { WATCHER_PAGE_SIZE, localClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { useNavCountsRefresh } from '@/app/admin/pipelines/_components/NavCountsRefresh';
import { userErrorText } from '@/app/admin/pipelines/ops/services/_components/errorText';
import { getCollaborationChannel, retryCollaborationChannel } from '@/app/lib/api/ops';

/** 접수 뒤 결과를 기다리는 리듬 — 5초마다, 최대 2분(24 tick). 연속 3 tick 실패면 멈춘다. */
export const RETRY_POLL_MS = 5_000;
export const RETRY_POLL_MAX_TICKS = 24;
const RETRY_POLL_MAX_FAILURES = 3;

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
  onChannel,
}: {
  id: number | null;
  channel: CollaborationChannel | null;
  /** 상위가 채널을 읽는 중 — 그동안 버튼이 잠긴다. */
  busy: boolean;
  reload: () => Promise<void>;
  /** 폴링이 읽어 온 채널을 상위에 올린다 — 카드 태그와 사실 칸이 같이 바뀐다. */
  onChannel: (channel: CollaborationChannel) => void;
}): ReactElement {
  const router = useRouter();
  const toast = usePlToast();
  const refreshCounts = useNavCountsRefresh();
  const [banner, setBanner] = useState<Banner>(null);
  const [sending, setSending] = useState(false);
  // 접수 상태로 열렸으면 바로 기다리기 시작한다.
  // 폴링이 멈췄는데 여전히 접수 중이면 그것이 "손으로 조회할 차례" 다 — 따로 든 상태가 없다.
  const [polling, setPolling] = useState(channel?.manualRetryPending === true);

  const pending = channel?.manualRetryPending === true;
  const linked = channel?.status === 'CREATED' && !!channel.issueKey;
  const requestedAt = localClock(channel?.manualRetryRequestedAt ?? null);

  // 폴링 tick 이 부르는 것들은 ref 로 — 효과가 tick 마다 다시 걸리지 않게.
  const latest = useRef({ onChannel, toast, router, refreshCounts });
  latest.current = { onChannel, toast, router, refreshCounts };

  useEffect(() => {
    if (!polling || id == null) return;
    let ticks = 0;
    let failures = 0;
    let settled = false;
    const stop = () => {
      settled = true;
      clearInterval(timer);
      setPolling(false);
    };
    const timer = setInterval(async () => {
      if (settled) return;
      ticks += 1;
      try {
        const next = await getCollaborationChannel(id, { watcherSize: WATCHER_PAGE_SIZE });
        if (settled) return;
        failures = 0;
        if (next) latest.current.onChannel(next);
        if (next && !next.manualRetryPending) {
          stop();
          if (next.status === 'CREATED' && next.issueKey) {
            latest.current.toast.show(`티켓이 생성됐어요 · ${next.issueKey}`);
            latest.current.router.refresh();
            latest.current.refreshCounts();
          } else {
            setBanner({ tone: 'warn', text: '이번 재시도도 실패했어요. 상태와 다음 시도 시각을 확인해 주세요.', refetch: false });
          }
          return;
        }
      } catch {
        // 한 tick 의 조회 실패는 넘긴다 — 폴링 중에 「조회 실패」 를 띄우지 않는다.
        failures += 1;
        if (failures >= RETRY_POLL_MAX_FAILURES) {
          stop();
          return;
        }
      }
      if (ticks >= RETRY_POLL_MAX_TICKS) stop();
    }, RETRY_POLL_MS);
    return () => {
      settled = true;
      clearInterval(timer);
    };
  }, [polling, id]);

  const retry = async (): Promise<void> => {
    if (id == null) return;
    setBanner(null);
    setSending(true);
    try {
      await retryCollaborationChannel(id);
      latest.current.router.refresh();
      latest.current.refreshCounts();
      // 202 는 접수뿐 — 접수 시각과 pending 은 서버가 안다. 다시 읽고, 결과를 기다리기 시작한다.
      await reload();
      setPolling(true);
    } catch (err) {
      setBanner(bannerFor(err));
      // 다시 생성할 수 없는 상태 — 화면이 낡은 것이니 현재 값을 바로 다시 읽는다.
      if (err instanceof AppError && err.rawCode === 'JIRA_MANUAL_RETRY_UNAVAILABLE') await reload();
    } finally {
      setSending(false);
    }
  };

  /** 손 조회 — 2분 상한 뒤의 한 번. 여전히 접수 중이면 그 상태에 머문다. */
  const refetch = async (): Promise<void> => {
    setBanner(null);
    await reload();
  };

  return (
    <div>
      {linked ? null : (
        <div className={styles.band} data-testid="action-band">
          {pending && polling ? (
            <div className={styles.bandText}>
              <p className={styles.bandTitle}>
                <Icon name="loader" size={14} className={styles.spinner} />
                재시도를 접수했어요
              </p>
              <p className={styles.bandSub}>
                {requestedAt ? `요청 ${requestedAt} · ` : ''}결과를 확인하는 중입니다
              </p>
            </div>
          ) : pending ? (
            <>
              <div className={styles.bandText}>
                <p className={styles.bandTitle}>아직 처리 중입니다</p>
                <p className={styles.bandSub}>
                  {requestedAt ? `요청 ${requestedAt} · ` : ''}잠시 뒤 다시 조회해 주세요
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
