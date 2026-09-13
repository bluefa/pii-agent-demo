'use client';

/**
 * 확정 정보 워크벤치의 pane 문법과 확정 pane.
 *
 * pane 은 세 슬롯 고정이다 — ① 머리(제목 + 카운터 + 액션) ② 정체(kv 2~3열, 테두리
 * 없음) ③ 실체(테이블 하나, 전폭). 순서는 불변이고, 채울 사실이 없는 슬롯만 통째로
 * 빠진다 — 빈 칸을 추정으로 채우지 않는다.
 *
 * 테두리 있는 표면은 화면당 하나(= 탭 밴드를 머리로 쓰는 컨테이너)뿐이므로, 여기의
 * 슬롯들은 전부 그 안의 바닥에 직접 놓이고 헤어라인으로만 갈린다.
 */
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { ConfirmedResourceTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmedResourceTable';
import { ConfirmedIdcTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmedIdcTable';
import { confirmedToIdcRows } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedIdcRows';
import { confirmedIntegrationToConfirmed } from '@/lib/resource-catalog';
import type { ConfirmedIntegrationResponse } from '@/app/lib/api';

export const paneStyles = {
  pane: 'px-[22px] pt-5',
  /** ① 머리 */
  slot1: 'flex items-center justify-between gap-4',
  head: 'text-[16px] font-bold tracking-[-0.02em] text-[var(--pl-text-strong)]',
  headSub: 'ml-[9px] text-[12px] font-medium text-[var(--pl-text-weak)]',
  actions: 'flex flex-none items-center gap-3',
  /** ② 정체 — 테두리 없는 kv 3열. 사실이 없으면 이 슬롯째로 빠진다. */
  slot2: 'mb-5 mt-4 grid grid-cols-3 gap-x-8 gap-y-3.5',
  kvKey: 'text-[12px] text-[var(--pl-text-weak)]',
  kvValue: 'mt-1 text-[14px] font-semibold text-[var(--pl-text-strong)]',
  kvNote: 'font-normal text-[var(--pl-text-weak)]',
  /** ③ 실체 — pane 의 좌우 패딩을 벗어나 컨테이너 폭 전체를 쓴다. */
  bleed: '-mx-[22px]',
  bleedTop: 'border-t border-[var(--pl-border)]',
  paneEmpty: 'border-t border-[var(--pl-border)] px-[22px] py-14 text-center',
  emptyTitle: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  emptyDesc: 'mt-1.5 text-[12px] text-[var(--pl-text-weak)]',
} as const;

export function Kv({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }): ReactElement {
  return (
    <div className="min-w-0">
      <p className={paneStyles.kvKey}>{label}</p>
      <p className={paneStyles.kvValue}>
        {value}
        {note != null && <span className={cn(paneStyles.kvNote, 'ml-1.5')}>{note}</span>}
      </p>
    </div>
  );
}

// ── ② 확정 정보 ──────────────────────────────────────────────────────────────

export interface ConfirmPaneProps {
  /** 확정 정보 응답 — pane 은 이 응답의 리소스를 그대로 보여 준다. */
  wire: ConfirmedIntegrationResponse | null;
  /** terraform-status.latest_confirmed_at — 확정 시각을 말하는 유일한 계약 필드. */
  confirmedAt: string | null;
  /** IDC 는 확정 리소스의 정체가 이름·id 가 아니라 접속 주소라 표 자체가 다르다. */
  isIdc: boolean;
  /**
   * 이 대상에 승인 축이 있는가. 빈 상태의 문장이 이것 하나로 갈린다 — SDU 에는 승인이
   * 없어서(계약 §0) 「승인된 리소스를 기준으로」가 참일 수 없다.
   */
  hasApproval: boolean;
  /**
   * 확정은 읽혔는데 `latest_confirmed_at`(terraform 응답)만 없다. 밴드가 서는 대상에서는
   * 확정 칸이 그 말을 하므로 넘기지 않는다 — SDU 처럼 밴드가 없는 대상에서만 참으로 온다.
   * 없으면 머리가 시각을 그냥 생략해 「시각 없는 확정」과 구별되지 않는다.
   */
  confirmedAtFailed?: boolean;
  /**
   * 확정 정보 입력 — 계약이 쓰기 경로를 주는 provider 에서만 내려온다. 고쳐 쓰는 길은
   * 없다: 등록이 있으면 지운 뒤 다시 넣는다(오너 2026-09-03).
   */
  onEdit?: () => void;
  /**
   * 확정 정보 삭제 — **편집과 나란한 두 번째 문**이다. 지우려는 사람이 편집기를 먼저
   * 열 이유가 없고, 삭제 확인은 이 콘솔의 다른 파괴적 동작(연동 초기화)과 같은 문법을
   * 쓴다. 지울 것이 있고(확정 등록됨) 쓰기 경로가 있을 때만 내려온다.
   */
  onDelete?: () => void;
}

/**
 * 현재 확정 정보만 보여 준다 — 표는 provider 로
 * 갈린다: 클라우드는 Step 6·7 의 `ConfirmedResourceTable`, IDC 는 옆 칸(연동 요청 확인)의
 * `IdcResourceTable`. 승인 스냅샷과의 비교·Raw 렌즈는 라이브 리뷰에서 제거됐다
 * ("뭘 비교한다는 건지"가 전달되지 않았다). 승인 내역이 필요하면 옆 칸(연동 요청
 * 확인)이 원문까지 가지고 있다.
 */
export function ConfirmPane({
  wire,
  confirmedAt,
  isIdc,
  hasApproval,
  confirmedAtFailed,
  onEdit,
  onDelete,
}: ConfirmPaneProps): ReactElement {
  const resources = wire?.resource_infos ?? [];
  const empty = resources.length === 0;
  // Step 6·7 과 같은 표가 도메인 타입을 읽는다 — 같은 응답을 같은 매퍼로 넘긴다.
  const structureRows = useMemo(() => (wire ? confirmedIntegrationToConfirmed(wire) : []), [wire]);
  // IDC 행은 요청 표와 같은 모양으로 내려간다 — 매핑은 호출부의 몫이다(`ConfirmedIdcTable`).
  const idcRows = useMemo(() => confirmedToIdcRows(wire?.resource_infos ?? []), [wire]);

  // 문의 낱말은 늘 「입력」이다 — 등록을 고쳐 쓰는 길은 없고 지운 뒤 다시 넣는다(오너
  // 2026-09-03). 그래서 등록이 있는 동안 문은 자리를 지키되 잠긴다. 사유가 있는 잠금은
  // `disabled` 가 아니라 `blocked` 다: 얼굴은 그대로지만 hover·포커스를 잃지 않아 아래
  // 툴팁이 마우스로도 키보드로도 닿는다. native `title` 은 이 콘솔에서 버렸다(오너
  // 2026-08-30) — OS 가 제 서체로 그리는 상자라 화면의 나머지와 같은 물건이 아니었다.
  const editDoor = onEdit ? (
    <PlButton variant="primary" blocked={!empty} onClick={onEdit}>
      확정 정보 입력
    </PlButton>
  ) : null;

  return (
    <div className={paneStyles.pane}>
      <div className={paneStyles.slot1}>
        {/* 정체 슬롯이 없다 — 확정이 어느 승인에 근거하는지는 계약에 없으므로 지어내지
            않고, 말할 수 있는 사실 하나(등록 시각)만 머리의 보조 텍스트로 붙인다. */}
        <p className={paneStyles.head}>
          확정 정보
          {/* Nothing registered, nothing said (owner 2026-09-11): the verdict head above already
              says what is missing, and 「미등록」 named no fact the reader could act on. */}
          {!empty && (
            <span className={paneStyles.headSub}>
              {confirmedAtFailed
                ? `리소스 ${resources.length}건 · 확정 시각 불러오지 못함`
                : `리소스 ${resources.length}건${confirmedAt ? ` · ${fmtDateTime(confirmedAt)} 등록` : ''}`}
            </span>
          )}
        </p>
        {(onEdit || onDelete) && (
          /* 두 문은 같은 눈금(32px)이다 — 이 pane 안의 검색 입력이 32px 이라, 액션만
             28px 로 내려가면 머리줄에서 셋이 서로 다른 높이로 선다. */
          <div className={paneStyles.actions}>
            {!empty && onDelete && (
              <PlButton variant="danger" onClick={onDelete}>
                확정 정보 삭제
              </PlButton>
            )}
            {editDoor &&
              (empty ? (
                editDoor
              ) : (
                <Tooltip
                  content="확정 정보를 삭제한 뒤 입력할 수 있습니다"
                  variant="value"
                  triggerClassName="shrink-0"
                >
                  {editDoor}
                </Tooltip>
              ))}
          </div>
        )}
      </div>

      {empty ? (
        <div className={cn(paneStyles.bleed, paneStyles.paneEmpty, 'mt-5')}>
          <p className={paneStyles.emptyTitle}>아직 확정된 리소스가 없습니다</p>
          <p className={paneStyles.emptyDesc}>
            {/* 기준이 될 승인이 없는 대상에서는 그 절만 빠진다 — 무엇이 대신 기준인지는
                계약이 아직 말하지 않으므로(§9.2) 지어내지 않는다. */}
            {onEdit
              ? '승인된 리소스를 기준으로 확정 정보를 입력하세요.'
              : hasApproval
                ? '승인된 리소스를 기준으로 확정 정보가 등록되면 여기에 표시됩니다.'
                : '확정 정보가 등록되면 여기에 표시됩니다.'}
          </p>
        </div>
      ) : isIdc ? (
        <ConfirmedIdcTable rows={idcRows} className="mt-6 pb-6" />
      ) : (
        <ConfirmedResourceTable resources={structureRows} className="mt-6 pb-6" />
      )}
    </div>
  );
}
