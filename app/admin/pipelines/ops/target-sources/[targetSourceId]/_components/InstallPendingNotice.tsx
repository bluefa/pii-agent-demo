'use client';

/**
 * 설치 미완료 예보 — 연결 테스트 카드 안, Credential 알림 아래·밴드 위 한 상자.
 *
 * 연결 테스트는 설치가 세운 것에 접속하는 동작이라, 안 끝난 리소스는 이번 회차에서 반드시
 * 실패한다. 화면이 그 사실을 알면서 말하지 않으면 운영자는 실패를 한 번 만들고 나서야
 * 안다 — 이 상자는 그 한 회차를 앞당겨 말한다.
 *
 * 자리는 Credential 알림 **아래**다. 둘 다 다음 실행의 전제지만 무게가 다르다: Credential
 * 미설정은 실행 자체를 잠그는 사유이고(primary 가 닫혀 있는 이유), 이것은 실행은 되지만
 * 결과가 정해진다는 예보다. 잠금이 예보를 이긴다.
 *
 * ⛔ 게이트가 아니다. 실행 버튼을 잠그지 않는다 — 나머지 리소스를 확인하려는 실행은
 * 정당하고, 그 판단은 운영자의 것이다. 이 판정이 하는 일은 확인 모달 한 겹
 * (`InstallPendingConfirmModal`)뿐이다.
 *
 * ⛔ `needed` 일 때만 그린다. `done` 은 아무 말도 하지 않아야 하고(끝난 일은 소식이 아니다),
 * `unknown` 과 로딩은 우리가 읽지 못한 것을 근거로 실패를 예고할 수 없다.
 *
 * 상자의 모양은 `CredentialMissingNotice`·`ServiceWorkNotice` 의 그것이다(warn 워시 ·
 * 12px 라운드 · 글리프 + 14/600 제목 · 글리프 열에 맞춘 본문). 세 상자가 같은 카드 계열에서
 * 같은 무게의 말을 하므로 모양이 갈릴 이유가 없다.
 */
import { type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { useModal } from '@/app/hooks/useModal';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  InstallResourceListModal,
  type InstallResourceListRow,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallResourceListModal';
import type { InstallPendingResult } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type { InstallLastCheck } from '@/app/components/features/process-status/install-status-detail/model';

/** 조회 결과 한 묶음 — `TcTab` 이 만들어 카드까지 내려보낸다. 카드는 읽지 않고 자리만 준다. */
export interface InstallPendingNoticeData {
  result: InstallPendingResult;
  lastCheck: InstallLastCheck | null;
}

export interface InstallPendingNoticeProps {
  /** null = 이 대상에는 읽을 설치 상태가 없다(SDU). */
  data: InstallPendingNoticeData | null;
  /** 부르는 쪽 스택과의 간격 — 상자는 제 바깥 여백을 갖지 않는다. */
  className?: string;
}

export function InstallPendingNotice({
  data,
  className,
}: InstallPendingNoticeProps): ReactElement | null {
  const detailModal = useModal();

  if (data === null || data.result.kind !== 'needed') return null;
  const { result, lastCheck } = data;
  const rows: InstallResourceListRow[] = result.rows.map((row) => ({
    resourceId: row.resourceId,
    resourceName: row.resourceName,
    stepTitle: row.stepTitle,
    status: row.status,
    guide: row.guide,
  }));

  return (
    <>
      <div
        className={cn(
          'rounded-[12px] border border-[var(--pl-warn-border)] bg-[var(--pl-warn-bg)] px-3.5 py-3 text-left',
          className,
        )}
      >
        {/* 경고를 색만으로 말하지 않는다(WCAG 1.4.1) — 마크가 색 없이도 같은 뜻을 진다. */}
        <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--pl-warn-text)]">
          <StatusWarningIcon className="h-4 w-4 shrink-0" />
          설치가 끝나지 않아 연결 테스트가 실패합니다
        </div>
        {/* 제목의 글리프 열(16px + gap-2)에 본문을 맞춘다 — 상자 안에서 두 줄이 한 글 열에 선다. */}
        <p className="mt-1.5 break-keep pl-6 text-[14px] leading-[1.5] text-[var(--pl-warn-text)]">
          설치 작업이 끝나지 않은 리소스 <b className="font-bold tabular-nums">{result.open}건</b>이
          있습니다. 지금 실행하면 해당 리소스는 연결에 실패합니다. 설치가 끝난 뒤 실행하세요.
        </p>
        <button
          type="button"
          onClick={() => detailModal.open()}
          className={cn(opsStyles.detailLink, 'mt-2 ml-6')}
        >
          미완료 리소스 보기
          <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
        </button>
      </div>

      {detailModal.isOpen && (
        <InstallResourceListModal
          title="설치가 끝나지 않은 리소스"
          rows={rows}
          stepColumn
          lastCheck={lastCheck}
          onClose={detailModal.close}
        />
      )}
    </>
  );
}
