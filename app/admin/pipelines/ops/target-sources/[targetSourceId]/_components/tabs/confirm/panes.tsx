'use client';

/**
 * 확정 정보 워크벤치의 pane 문법과 세 pane.
 *
 * pane 은 네 슬롯 고정이다 — ① 머리(제목 + 카운터 + 액션) ② 정체(kv 2~3열, 테두리
 * 없음) ③ 실체(테이블 하나, 전폭) ④ 원본(우상단 렌즈 토글). 순서는 불변이고, 채울
 * 사실이 없는 슬롯만 통째로 빠진다 — 빈 칸을 추정으로 채우지 않는다.
 *
 * 테두리 있는 표면은 화면당 하나(= 탭 밴드를 머리로 쓰는 컨테이너)뿐이므로, 여기의
 * 슬롯들은 전부 그 안의 바닥에 직접 놓이고 헤어라인으로만 갈린다.
 */
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { SegControl } from '@/app/admin/pipelines/_components/SegControl';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  TONE,
  SIDE_LABEL,
  metaOf,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import { ResourceList } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/RequestTab';
import { ConfirmedResourceTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmedResourceTable';
import { confirmedIntegrationToConfirmed } from '@/lib/resource-catalog';
import type { ConfirmedIntegrationResponse, TerraformStatusResponse } from '@/app/lib/api';
import type { ApprovalRequestDetail } from '@/app/lib/api/task-queue-requests';

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
  /** ④ 원본 — 모달이 아니라 렌즈. */
  raw: 'max-h-[520px] overflow-auto whitespace-pre bg-[var(--pl-gray-50)] px-[22px] py-[18px] text-[12px] leading-[1.8] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
  paneEmpty: 'border-t border-[var(--pl-border)] px-[22px] py-14 text-center',
  emptyTitle: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  emptyDesc: 'mt-1.5 text-[12px] text-[var(--pl-text-weak)]',
} as const;

function Kv({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }): ReactElement {
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

// ── ① 연동 요청 확인 ─────────────────────────────────────────────────────────

/**
 * 승인은 요청 없이 존재하지 않으므로 한 pane 이다. 계약이 주는 것만 쓴다 —
 * ApprovalRequestLatestDto 에 요청 유형(신규/재승인) 필드는 없으므로 그 말은 하지
 * 않고, 결과는 result 가 있을 때만 쓴다.
 */
export function RequestPane({
  detail,
  wire,
  isIdc,
  targetSourceId,
}: {
  detail: ApprovalRequestDetail | null;
  wire: unknown;
  isIdc: boolean;
  targetSourceId: number;
}): ReactElement {
  const [lens, setLens] = useState<'structure' | 'raw'>('structure');

  if (!detail?.request) {
    return (
      <div className={paneStyles.pane}>
        <div className={paneStyles.slot1}>
          <p className={paneStyles.head}>연동 요청 확인</p>
        </div>
        <PlEmptyState icon="inbox" message="승인 요청 이력이 없습니다." className="my-10" />
      </div>
    );
  }

  const { request, verdict, resources } = detail;
  const selected = resources.filter((row) => row.selected).length;

  return (
    <div className={paneStyles.pane}>
      <div className={paneStyles.slot1}>
        <p className={paneStyles.head}>
          연동 요청{request.requestId != null ? ` #${request.requestId}` : ''}
          <span className={paneStyles.headSub}>승인 요청 리소스 {selected}건</span>
        </p>
        <div className={paneStyles.actions}>
          <SegControl
            value={lens}
            onChange={setLens}
            ariaLabel="연동 요청 보기 방식"
            options={[
              { value: 'structure', label: '구조' },
              { value: 'raw', label: 'Raw' },
            ]}
          />
        </div>
      </div>

      <div className={paneStyles.slot2}>
        <Kv label="요청" value={request.requestedBy ?? '—'} note={fmtDateTime(request.requestedAt)} />
        {/* "승인" 이 아니라 "처리" 다 — 계약 필드가 processed_by/processed_at 이고,
            반려된 요청에도 처리자가 있다. 승인이라 부르면 반려를 승인으로 읽힌다. */}
        <Kv
          label="처리"
          value={verdict?.processedBy ?? '—'}
          note={verdict?.processedAt ? fmtDateTime(verdict.processedAt) : undefined}
        />
        <Kv label="결과" value={verdict?.status ?? request.status ?? '—'} />
      </div>

      {lens === 'raw' ? (
        <div className={cn(paneStyles.bleed, paneStyles.bleedTop)}>
          <pre className={paneStyles.raw}>{JSON.stringify(wire, null, 2)}</pre>
        </div>
      ) : resources.length === 0 ? (
        <PlEmptyState icon="inbox" message="요청 리소스가 없습니다." className="my-10" />
      ) : (
        <div className="pb-6">
          <ResourceList
            key={`${targetSourceId}:${request.requestId ?? 'latest'}`}
            targetSourceId={targetSourceId}
            rows={resources}
            isIdc={isIdc}
          />
        </div>
      )}
    </div>
  );
}

// ── ② 확정 정보 ──────────────────────────────────────────────────────────────

export interface ConfirmPaneProps {
  /** 확정 정보 응답 — pane 은 이 응답의 리소스를 그대로 보여 준다. */
  wire: ConfirmedIntegrationResponse | null;
  /** terraform-status.latest_confirmed_at — 확정 시각을 말하는 유일한 계약 필드. */
  confirmedAt: string | null;
  /**
   * 확정 정보 입력·수정·삭제 — 계약이 쓰기 경로를 주는 provider 에서만 내려온다.
   * 삭제는 편집기 안의 영역 교체이므로 pane 에 두 번째 입구를 두지 않는다.
   */
  onEdit?: () => void;
}

/**
 * 현재 확정 정보만 보여 준다 — 표는 `ConfirmedResourceTable`, 편집기의 삭제 확인
 * 화면과 같은 표다. 승인 스냅샷과의 비교·Raw 렌즈는 라이브 리뷰에서 제거됐다
 * ("뭘 비교한다는 건지"가 전달되지 않았다). 승인 내역이 필요하면 옆 칸(연동 요청
 * 확인)이 원문까지 가지고 있다.
 */
export function ConfirmPane({ wire, confirmedAt, onEdit }: ConfirmPaneProps): ReactElement {
  const resources = wire?.resource_infos ?? [];
  const empty = resources.length === 0;
  // Step 6·7 과 같은 표가 도메인 타입을 읽는다 — 같은 응답을 같은 매퍼로 넘긴다.
  const structureRows = useMemo(() => (wire ? confirmedIntegrationToConfirmed(wire) : []), [wire]);

  return (
    <div className={paneStyles.pane}>
      <div className={paneStyles.slot1}>
        {/* 정체 슬롯이 없다 — 확정이 어느 승인에 근거하는지는 계약에 없으므로 지어내지
            않고, 말할 수 있는 사실 하나(등록 시각)만 머리의 보조 텍스트로 붙인다. */}
        <p className={paneStyles.head}>
          확정 정보
          <span className={paneStyles.headSub}>
            {empty
              ? '미등록'
              : `리소스 ${resources.length}건${confirmedAt ? ` · ${fmtDateTime(confirmedAt)} 등록` : ''}`}
          </span>
        </p>
        {onEdit && (
          <div className={paneStyles.actions}>
            <PlButton variant="primary" size="sm" onClick={onEdit}>
              {empty ? '확정 정보 입력' : '확정 정보 수정'}
            </PlButton>
          </div>
        )}
      </div>

      {empty ? (
        <div className={cn(paneStyles.bleed, paneStyles.paneEmpty, 'mt-5')}>
          <p className={paneStyles.emptyTitle}>아직 확정된 리소스가 없습니다</p>
          <p className={paneStyles.emptyDesc}>
            {onEdit
              ? '승인된 리소스를 기준으로 확정 정보를 입력하세요.'
              : '승인된 리소스를 기준으로 확정 정보가 등록되면 여기에 표시됩니다.'}
          </p>
        </div>
      ) : (
        <ConfirmedResourceTable resources={structureRows} className="mt-6 pb-6" />
      )}
    </div>
  );
}

// ── ③ 설치 (Terraform) ───────────────────────────────────────────────────────

/**
 * 원본이 없는 pane — 렌즈 토글이 아예 나타나지 않는다. 여기는 정체 슬롯이 있는
 * 유일한 pane 이다(특정할 사실이 셋 있다).
 *
 * TerraformTaskStatusResponse 가 주는 것은 이름·상태·실행 주체뿐이므로 대상과 완료
 * 시각 열은 두지 않는다. 값은 InfraManager 의 DB 기록이고 Cloud SDK 를 부르지 않는다.
 */
export function InstallPane({
  status,
  onOpenInfra,
}: {
  status: TerraformStatusResponse | null;
  onOpenInfra: () => void;
}): ReactElement {
  const tasks = status?.tasks ?? [];
  const applied = tasks.filter((task) => task.state === 'APPLIED').length;
  const overall = metaOf(status?.overall_state);

  return (
    <div className={paneStyles.pane}>
      <div className={paneStyles.slot1}>
        <p className={paneStyles.head}>
          설치 (Terraform)
          <span className={paneStyles.headSub}>
            task {applied} / {tasks.length}
          </span>
        </p>
        {/* 실행은 인프라 작업 탭이 소유한다 — 같은 동작의 두 번째 입구를 만들지 않는다. */}
        <button type="button" onClick={onOpenInfra} className={opsStyles.detailLink}>
          인프라 작업 탭에서 실행
        </button>
      </div>

      <div className={paneStyles.slot2}>
        <Kv label="적용 상태" value={overall.label} />
        <Kv label="최근 확정 시각" value={fmtDateTime(status?.latest_confirmed_at)} />
        <Kv label="마지막 점검" value={fmtDateTime(status?.checked_at)} note="DB 기록" />
      </div>

      {tasks.length === 0 ? (
        <PlEmptyState icon="install" message="실행된 Terraform 작업이 없습니다." className="my-10" />
      ) : (
        <div className={cn(paneStyles.bleed, paneStyles.bleedTop)}>
          <table className={opsStyles.table.base}>
            <thead>
              <tr>
                <th className={cn(opsStyles.table.headCell, 'pl-[30px]')}>Task</th>
                <th className={opsStyles.table.headCell}>상태</th>
                <th className={opsStyles.table.headCell}>실행 주체</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => {
                const meta = metaOf(task.state);
                return (
                  <tr
                    key={`${task.terraform_task_name ?? 'task'}-${index}`}
                    className={opsStyles.table.rowHover}
                  >
                    <td className={cn(opsStyles.table.cell, 'pl-[30px] font-semibold')}>
                      {task.terraform_task_name ?? '—'}
                    </td>
                    <td className={cn(opsStyles.table.cell, 'font-semibold', TONE[meta.tone].text)}>
                      {meta.label}
                    </td>
                    <td className={opsStyles.table.cell}>
                      {SIDE_LABEL[task.terraform_execution_side ?? ''] ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
