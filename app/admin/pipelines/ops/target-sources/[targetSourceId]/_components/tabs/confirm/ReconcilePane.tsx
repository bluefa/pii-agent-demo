'use client';

/**
 * 확정 정보 탭의 본문(승인 축이 있는 대상) — 두 기록을 나란히 세우고, 리소스는 한 표로 합친다.
 *
 * 밴드(연동 요청 확인 | 확정 정보)가 하던 일을 이 pane 이 대신한다. 밴드는 두 축을 **번갈아**
 * 보여 줬고, 그래서 "승인에는 있는데 확정에 없다"는 질문에 답하려면 사람이 두 화면을 기억으로
 * 맞대야 했다. 여기서는 축이 둘 다 서 있고(카드 둘), 리소스는 애초에 그 질문의 단위이므로 한
 * 표에서 행마다 판정이 붙는다.
 *
 * 카드는 요약만 진다 — 신원과 결말, 그리고 「대조」한 줄. 리소스 목록은 카드 안에 들어가지
 * 않는다: 두 개의 반쪽짜리 표는 같은 열을 두 번 그리면서 어느 행이 어느 행과 짝인지는 끝내
 * 말하지 못한다.
 *
 * 「대조」는 **셀 수 있을 때만** 선다. 승인이 없거나(요청 없음·반려·대기) 조회가 실패했으면
 * 두 목록 중 하나가 없는 것이고, 그때 「일치」는 화면이 벌지 않은 주장이다 — 그 경우 표는
 * 예전 그대로 확정 행만, 판정 열 없이 싣는다.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { ConfirmedResourceTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmedResourceTable';
import { ConfirmedIdcTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmedIdcTable';
import { confirmedToIdcRows } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedIdcRows';
import { Kv, paneStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/panes';
import type { ReconcileTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/reconcileRows';
import { confirmedIntegrationToConfirmed } from '@/lib/resource-catalog';
import {
  CONFIRMED_STATE_TONE,
  confirmTagStyles,
  deriveConfirmedStateTag,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedStateTag';
import type { ConfirmedIntegrationResponse } from '@/app/lib/api';
import type { ApprovalRequestDetail } from '@/app/lib/api/task-queue-requests';
import { Badge, type BadgeVariant } from '@/app/components/ui/Badge';

const styles = {
  /** 두 기록은 형제다 — 같은 눈금의 카드 둘, 폭도 같다. */
  cards: 'grid grid-cols-2 gap-4',
  /** 왼쪽(승인)은 끝난 기록이라 한 단 가라앉은 바닥에 선다. */
  cardPast: 'rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-gray-50)] p-4',
  /** 오른쪽(확정)은 지금 쓰는 기록이라 흰 바닥이다 — 액션이 서는 쪽도 여기다. */
  cardLive: 'rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] p-4',
  cardHead: 'flex items-start justify-between gap-3',
  /** 카드가 좁아(패널 절반) kv 는 2열이다. */
  kvGrid: 'mt-3.5 grid grid-cols-2 gap-x-6 gap-y-3.5',
  chips: 'mt-5 flex items-center gap-2',
  /** 태그와 그 톤은 판정 줄과 공유한다 — 같은 사실이 두 자리에서 다른 낱말로 서지 않게. */
  tag: confirmTagStyles.tag,
  ok: confirmTagStyles.ok,
  warn: confirmTagStyles.warn,
  off: confirmTagStyles.off,
} as const;

export interface ReconcilePaneProps {
  /** 최신 연동 요청. 없으면 요청 카드는 그 사실만 말한다. */
  request: ApprovalRequestDetail | null;
  /** 요청 조회가 실패했다 — 없는 것과 다르다. */
  requestFailed: boolean;
  /**
   * 요청 카드 머리의 칩이 말할 것 — 이 탭의 어휘와 그 톤(`REQUEST_STATUS`). 계약 enum 원문이 아니고,
   * 카드 머리의 태그도 아니다: 결말은 한 카드 안에서 한 번만 선다.
   */
  requestOutcome: { tone: BadgeVariant; label: string } | null;
  confirmed: ConfirmedIntegrationResponse | null;
  /** terraform-status.latest_confirmed_at — 확정 시각을 말하는 유일한 계약 필드. */
  confirmedAt: string | null;
  /** 확정은 읽혔는데 시각만 못 읽었다(terraform 조회 실패). */
  confirmedAtFailed: boolean;
  isIdc: boolean;
  /** 조인 결과. `null` 이면 대조가 불가능한 상태다 — 판정 열도 「대조」도 서지 않는다. */
  reconcile: ReconcileTable | null;
  /** 3단계인데 확정이 이미 있다 — 그 확정으로는 다음 단계로 넘어가지 않는다. */
  reconfirmNeeded: boolean;
  /**
   * 재확정 — 철거·재설치는 인프라 작업 탭이 소유하므로 그리로 보낸다. 쓰기 경로가 있는
   * 대상에는 **언제나** 선다(오너 2026-09-11): 다시 입력이 필요한 상태에서만 열리던 문이
   * 아니다.
   */
  onReconfirm?: () => void;
  /**
   * Why the 재확정 door is closed, or `null` when it is open. The reason REPLACES the intro tip
   * (a blocked button never carries two tooltips). `null` also covers the unknown case — a
   * failed request fetch does not block.
   */
  reconfirmBlocked?: string | null;
  onEdit?: () => void;
  /**
   * Why 확정 정보 입력 is closed on the approval axis, or `null`. A standing record closes the
   * same door with its own reason and wins when both apply — it is the nearer obstacle.
   */
  editBlocked?: string | null;
  onDelete?: () => void;
  /** Why 확정 정보 삭제 is closed (a run in progress), or `null`. */
  deleteBlocked?: string | null;
  /** The 작업 줄 — the tab owns the run; the pane only gives it the slot under the card head. */
  runLine?: ReactNode;
}

export function ReconcilePane({
  request,
  requestFailed,
  requestOutcome,
  confirmed,
  confirmedAt,
  confirmedAtFailed,
  isIdc,
  reconcile,
  reconfirmNeeded,
  onReconfirm,
  reconfirmBlocked = null,
  onEdit,
  editBlocked = null,
  onDelete,
  deleteBlocked = null,
  runLine,
}: ReconcilePaneProps): ReactElement {
  // 차이가 있는 화면에서 먼저 답해야 하는 질문은 "무엇이 다른가"다 — 전체 목록은 한 번의
  // 클릭 뒤에 있다. 차이가 없으면 이 칩 줄 자체가 서지 않으므로 기본값이 목록을 숨기는
  // 일은 없다.
  const [diffOnly, setDiffOnly] = useState(true);

  const confirmedRows = confirmed?.resource_infos ?? [];
  const empty = confirmedRows.length === 0;
  const verdict = request?.verdict ?? null;
  const hasDiff = reconcile != null && reconcile.diffCount > 0;
  const stateTag = deriveConfirmedStateTag({ confirmedCount: confirmedRows.length, reconfirmNeeded });
  const showDiffOnly = hasDiff && diffOnly;

  const confirmedFact = confirmedAtFailed
      ? `리소스 ${confirmedRows.length}건 · 확정 시각 불러오지 못함`
      : `리소스 ${confirmedRows.length}건${confirmedAt ? ` · ${fmtDateTime(confirmedAt)}` : ''}`;

  // Two things close this door, and the standing record wins: it is the obstacle the person hits
  // first and the one they can act on here. 등록이 있는 동안 문은 자리를 지키되 잠긴다 — 고쳐
  // 쓰는 길은 없고 지운 뒤 다시 넣는다(오너 2026-09-03). 승인이 없는 경우는 오너 2026-09-11.
  // 사유가 있는 잠금은 `blocked` 다: 툴팁이 마우스로도 키보드로도 닿는다.
  const editReason = !empty ? '확정 정보를 삭제한 뒤 입력할 수 있습니다' : editBlocked;
  const editDoor = onEdit ? (
    <PlButton variant="primary" blocked={editReason != null} onClick={onEdit}>
      확정 정보 입력
    </PlButton>
  ) : null;

  return (
    <div className={paneStyles.pane}>
      <div className={styles.cards}>
        <section className={styles.cardPast}>
          <div className={styles.cardHead}>
            {/* The request id is not printed anywhere in this tab (owner 2026-09-11): the
                연동 요청 정보 tab owns it, and 「#0」 read as a puzzle, not an identity. */}
            <p className={paneStyles.head}>연동 요청</p>
            {/* 결말은 머리의 칩 하나다 (owner 2026-09-11) — 승인 대기 · 승인 · 반려 … 이 탭의
                어휘로. 조회 실패는 결말이 아니라 값들이 왜 비었는지의 답이라 칩이 아니다. */}
            {requestOutcome && <Badge variant={requestOutcome.tone}>{requestOutcome.label}</Badge>}
            {requestFailed && <span className={cn(styles.tag, styles.off)}>불러오지 못함</span>}
          </div>

          <div className={styles.kvGrid}>
            <Kv
              label="요청"
              value={request?.request.requestedBy ?? '—'}
              note={request ? fmtDateTime(request.request.requestedAt) : undefined}
            />
            {/* "승인" 이 아니라 "처리" 다 — 계약 필드가 processed_by/processed_at 이고,
                반려된 요청에도 처리자가 있다. 승인이라 부르면 반려를 승인으로 읽힌다. */}
            <Kv
              label="처리"
              value={verdict?.processedBy ?? '—'}
              note={verdict?.processedAt ? fmtDateTime(verdict.processedAt) : undefined}
            />
            {reconcile && (
              <Kv
                label="대조"
                value={
                  reconcile.missingConfirmed > 0 ? (
                    <span className={styles.warn}>확정에 없음 {reconcile.missingConfirmed}건</span>
                  ) : (
                    <span className={styles.ok}>일치</span>
                  )
                }
              />
            )}
          </div>
        </section>

        <section className={styles.cardLive}>
          <div className={styles.cardHead}>
            <p className={paneStyles.head}>확정 정보</p>
            {(onReconfirm || onEdit || onDelete) && (
              /* 세 문은 같은 눈금(32px)이다 — 등급을 색으로만 가른다. */
              <div className={paneStyles.actions}>
                {/* Nothing to re-confirm when nothing is registered (owner 09-11). */}
                {onReconfirm && !empty && (
                  // The door always stands; what changes is whether it opens. It is closed only
                  // when the tab KNOWS there is no approved 연동 요청 to re-register from — a
                  // request fetch that failed leaves it open, because unknown is not a reason
                  // (owner 2026-09-11). Do not re-add the old `reconfirmNeeded` gate as a
                  // stand-in for the active-pipeline lock; that one ships with the run-line PR.
                  //
                  // One tooltip either way: the blocked reason replaces the intro tip, which
                  // describes the action and therefore cannot double as a reason.
                  <Tooltip
                    content={
                      reconfirmBlocked ??
                      '확정 정보를 지우고 승인 내용으로 다시 등록합니다. 인프라는 다시 설치되지 않습니다.'
                    }
                    variant="value"
                    triggerClassName="shrink-0"
                  >
                    <PlButton
                      variant="warnSolid"
                      blocked={reconfirmBlocked != null}
                      onClick={onReconfirm}
                    >
                      재확정
                    </PlButton>
                  </Tooltip>
                )}
                {!empty && onDelete && (
                  deleteBlocked == null ? (
                    <PlButton variant="dangerSolid" onClick={onDelete}>
                      확정 정보 삭제
                    </PlButton>
                  ) : (
                    <Tooltip content={deleteBlocked} variant="value" triggerClassName="shrink-0">
                      <PlButton variant="dangerSolid" blocked onClick={onDelete}>
                        확정 정보 삭제
                      </PlButton>
                    </Tooltip>
                  )
                )}
                {editDoor &&
                  (editReason == null ? (
                    editDoor
                  ) : (
                    <Tooltip content={editReason} variant="value" triggerClassName="shrink-0">
                      {editDoor}
                    </Tooltip>
                  ))}
              </div>
            )}
          </div>

          {runLine}

          {/* No record, no facts (owner 09-11): 「등록 —」 and a 「대조」 against nothing are
              noise. The headline above already says what is missing. */}
          {stateTag != null && (
          <div className={cn(styles.kvGrid, runLine != null && 'mt-3')}>
            <Kv
              label="상태"
              value={<span className={styles[CONFIRMED_STATE_TONE[stateTag]]}>{stateTag}</span>}
            />
            <Kv label="등록" value={confirmedFact} />
            {reconcile && (
              <Kv
                label="대조"
                value={
                  reconcile.missingApproved > 0 ? (
                    <span className={styles.warn}>승인에 없음 {reconcile.missingApproved}건</span>
                  ) : (
                    <span className={styles.ok}>일치</span>
                  )
                }
              />
            )}
          </div>
          )}
        </section>
      </div>

      {/* 차이가 없으면 고를 것도 없다 — 두 칩이 같은 목록을 가리킨다. */}
      {hasDiff && (
        <div className={styles.chips} role="group" aria-label="리소스 목록 범위">
          {([
            { value: true, label: '차이만' },
            { value: false, label: '전체' },
          ] as const).map((option) => {
            const on = option.value === diffOnly;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={on}
                onClick={() => setDiffOnly(option.value)}
                // 켠 칩은 base 를 **대체한다** — `cn` 은 이어 붙이기만 하므로 두 벌의
                // 바탕·테두리를 겹치면 어느 쪽이 이길지 스타일시트 순서가 정한다.
                className={cn(
                  on
                    ? pipelineStyles.filterChip.scope
                    : // `base` carries no text colour of its own (its key/value spans do), so the
                      // off chip states one; same weight as the on chip so the pill does not resize.
                      cn(pipelineStyles.filterChip.base, 'font-semibold text-[var(--pl-text-medium)]'),
                  'cursor-pointer',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 확정이 하나도 없을 때의 안내는 그대로 선다. 아래 표가 그 자리에서 무엇을
          기준으로 입력하게 되는지(승인 행 전부가 「확정 없음」)를 이어서 말한다. */}
      {empty && (
        <div className={cn(paneStyles.bleed, paneStyles.paneEmpty, 'mt-5')}>
          <p className={paneStyles.emptyTitle}>아직 확정된 리소스가 없습니다</p>
          <p className={paneStyles.emptyDesc}>
            {onEdit
              ? '승인된 리소스를 기준으로 확정 정보를 입력하세요.'
              : '승인된 리소스를 기준으로 확정 정보가 등록되면 여기에 표시됩니다.'}
          </p>
        </div>
      )}
      <ResourceArea
        isIdc={isIdc}
        reconcile={reconcile}
        diffOnly={showDiffOnly}
        confirmed={confirmed}
        // 안내가 이미 위 칸을 닫았으면 표는 제 선을 또 긋지 않는다.
        topRule={!empty}
      />
    </div>
  );
}

/**
 * 표 한 자리 — 대조가 가능하면 조인된 행(판정 열 포함), 아니면 예전 그대로 확정 행만.
 * 대조가 불가능한데 확정도 없으면 그릴 행이 없으므로 위의 안내만 남는다.
 */
function ResourceArea({
  isIdc,
  reconcile,
  diffOnly,
  confirmed,
  topRule,
}: {
  isIdc: boolean;
  reconcile: ReconcileTable | null;
  diffOnly: boolean;
  confirmed: ConfirmedIntegrationResponse | null;
  topRule: boolean;
}): ReactNode {
  const frame = cn(paneStyles.bleed, topRule && paneStyles.bleedTop, topRule ? 'mt-6' : 'mt-5');

  if (reconcile != null) {
    return (
      <div className={frame}>
        {reconcile.kind === 'idc' ? (
          <ConfirmedIdcTable
            rows={diffOnly ? reconcile.rows.filter((row) => row.reconcile !== 'match') : reconcile.rows}
            className="pb-6 pt-5"
          />
        ) : (
          <ConfirmedResourceTable
            resources={
              diffOnly ? reconcile.rows.filter((row) => row.reconcile !== 'match') : reconcile.rows
            }
            className="pb-6 pt-5"
          />
        )}
      </div>
    );
  }

  if (confirmed == null || confirmed.resource_infos.length === 0) return null;
  return (
    <div className={frame}>
      {isIdc ? (
        <ConfirmedIdcTable rows={confirmedToIdcRows(confirmed.resource_infos)} className="pb-6 pt-5" />
      ) : (
        <ConfirmedResourceTable
          resources={confirmedIntegrationToConfirmed(confirmed)}
          className="pb-6 pt-5"
        />
      )}
    </div>
  );
}
