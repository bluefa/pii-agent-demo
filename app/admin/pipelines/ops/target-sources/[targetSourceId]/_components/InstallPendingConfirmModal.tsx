'use client';

/**
 * 설치 미완료 확인 — `연결 테스트 실행` 을 누른 순간 한 겹 서는 모달.
 *
 * 예보(`InstallPendingNotice`)는 카드 첫 줄에 서 있지만, 운영자가 실행을 누르는 순간에 그
 * 문장이 시야에 있으리라는 보장은 없다 — 상자는 밴드 위에 있고 단추는 밴드 아래에 있다.
 * 그래서 경고는 두 번 선다: 화면에 한 번(읽는 자리), 동작에 한 번(누르는 자리).
 *
 * ⛔ 막지 않는다. 이 모달의 primary 는 실행이고, 그 낱말이 결과를 서술한다 —
 * 「실패를 감수하고 실행」. 나머지 리소스를 확인하려는 실행은 정당하므로 화면이 대신
 * 결정하지 않고, 무엇이 일어날지만 말한 뒤 선택을 넘긴다.
 *
 * ⛔ Credential 잠금이 이것보다 앞선다. 미설정이 있으면 실행 단추 자체가 `blocked` 라
 * 이 모달까지 오지 않는다 — 잠긴 사유가 둘이면 운영자는 둘 다 못 읽는다.
 */
import { type ReactElement } from 'react';
import { pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import type { InstallPendingResult } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';

const TITLE_ID = 'pl-install-pending-confirm-title';

/** 이름 줄에 세우는 리소스 수 — 나머지는 `외 N건` 으로 접는다. */
const NAME_LIMIT = 5;

export interface InstallPendingConfirmModalProps {
  result: InstallPendingResult;
  /** 실행 요청이 나가는 동안 — 확인 단추가 밴드와 같은 낱말로 잠긴다. */
  triggering: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function InstallPendingConfirmModal({
  result,
  triggering,
  onConfirm,
  onClose,
}: InstallPendingConfirmModalProps): ReactElement {
  // 행이 아니라 리소스다 — 한 리소스가 두 단계에서 걸려도 이름은 한 번만 선다.
  const names = [...new Set(result.rows.map((row) => row.resourceName ?? row.resourceId))];
  const shown = names.slice(0, NAME_LIMIT);
  const rest = names.length - shown.length;

  return (
    <ModalShell open onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        설치가 끝나지 않았습니다
      </h3>
      <p className={pipelineStyles.modal.desc}>
        설치 작업이 끝나지 않은 리소스{' '}
        <b className="font-bold tabular-nums">{result.open}건</b>은 이번 연결 테스트에서 반드시
        실패합니다. 그래도 지금 실행하시겠습니까?
      </p>
      {/* 어느 리소스인가 — 목록이 아니라 한 줄이다. 전부 세는 표는 카드의 경고 상자가
          여는 모달의 몫이고, 여기서 필요한 것은 「내가 아는 그 리소스가 맞나」의 확인뿐이다. */}
      <p className="break-keep text-[12px] leading-[1.5] text-[var(--pl-text-weak)]">
        {shown.join(' · ')}
        {rest > 0 && ` 외 ${rest}건`}
      </p>

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose}>
          취소
        </PlButton>
        <PlButton variant="primary" disabled={triggering} onClick={onConfirm}>
          {triggering ? '시작 중…' : '실패를 감수하고 실행'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
