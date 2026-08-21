'use client';

/**
 * DAG 상세 모달 — 주간 보드의 DAG 셀에서 연다. 셋을 한 화면에 둔다: 이름 전문(열에서는
 * 가운데를 접어 보여 준다), 그 DAG 의 현재 상태, Airflow 주소.
 *
 *  - 상태는 이미 받아 둔 dag-status 행 그대로다 — 모달이 다시 조회하지 않는다. 같은
 *    값을 두 곳에서 계산하면 보드와 모달이 서로 다른 말을 하는 날이 온다.
 *  - 조회하는 건 주소 하나뿐(assumed §11). 못 얻는 경우가 있으므로 3상태다:
 *    조회 중 · 주소 · 확인 불가. **재시도는 조회가 실패했을 때만** — 업스트림이 이미
 *    "없다"고 답한 것을 다시 물어도 답은 같다(실패와 빈 결과는 다른 사실이다).
 *  - 패널 위에 겹치는 2단 레이어다. 이 모달이 열려 있는 동안 패널의 Esc 는 꺼진다
 *    (ApprovalTab 이 closeOnEsc 로 넘긴다) — 그러지 않으면 Esc 한 번에 둘 다 닫힌다.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { getAirflowHost } from '@/app/lib/api/ops';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TcPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { DayStrip } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DbWeeklyBoard';
import {
  agentDisplayName,
  type DagDbRow,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

/** 주소 조회 — 'loaded' 의 빈 url 은 "업스트림이 주소를 주지 않았다"는 사실이다. */
type HostFetch = { phase: 'loading' } | { phase: 'failed' } | { phase: 'loaded'; url: string };

const UNAVAILABLE = 'DAG 주소 확인 불가';

function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="mt-4">
      <p className="text-[12px] font-medium text-[var(--pl-text-weak)]">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function DagDetailBody({ row, timezone }: { row: DagDbRow; timezone: string }): ReactElement {
  const [host, setHost] = useState<HostFetch>({ phase: 'loading' });
  const [reload, setReload] = useState(0);
  const { db } = row;

  useAbortableEffect(
    (signal) => {
      setHost({ phase: 'loading' });
      return getAirflowHost(db.databaseUri, { signal })
        .then((url) => {
          if (signal.aborted) return;
          setHost({ phase: 'loaded', url: (url ?? '').trim() });
        })
        .catch(() => {
          if (signal.aborted) return;
          setHost({ phase: 'failed' });
        });
    },
    [db.databaseUri, reload],
  );

  const url = host.phase === 'loaded' ? host.url : '';

  return (
    <>
      <h3 id="dag-detail-title" className="text-[16px] font-bold text-[var(--pl-text-strong)]">
        DAG
      </h3>
      {/* 어느 행에서 열었는지 — 보드의 정체성 두 줄을 한 줄로 접어 싣는다. */}
      <p className="mt-1 text-[12px] text-[var(--pl-text-weak)]">
        {db.databaseName ?? db.databaseUri}
        {db.schemaName && ` · ${db.schemaName}`}
        {` · ${agentDisplayName(row.resourceId)}`}
      </p>

      <Field label="이름">
        {db.dagName ? (
          <div className="flex items-start gap-1.5">
            {/* 열에서는 접히는 이름이 여기서는 전문이다 — 300자까지 오므로 줄바꿈. */}
            <p className="min-w-0 flex-1 break-all font-mono text-[14px] text-[var(--pl-text-strong)]">
              {db.dagName}
            </p>
            <CopyButton value={db.dagName} label="DAG 이름 복사" className="flex-none" />
          </div>
        ) : (
          // 이름이 없어도 열 수 있다 — 주소는 databaseUri 로 묻기 때문이다.
          <p className="text-[14px] text-[var(--pl-text-weak)]">실행 기록 없음</p>
        )}
      </Field>

      <Field label={`현재 상태 (최근 7일 · ${timezone})`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {db.succeededThisWeek ? (
            <TcPill tone="ok" label="최근 7일 성공" />
          ) : (
            <TcPill tone="err" label="최근 7일 성공 없음" />
          )}
          <DayStrip row={row} />
          <span className="text-[12px] text-[var(--pl-text-weak)]">
            마지막 성공{' '}
            <b className="font-medium tabular-nums text-[var(--pl-text-medium)]">
              {db.lastSuccessAt ? fmtDateTime(db.lastSuccessAt) : '없음'}
            </b>
          </span>
        </div>
      </Field>

      <Field label="주소">
        {host.phase === 'loading' ? (
          <span className={cn(opsStyles.skeletonBar, 'block h-5 w-[320px]')} aria-hidden />
        ) : url ? (
          <div className="flex items-start gap-1.5">
            <p className="min-w-0 flex-1 break-all font-mono text-[14px] text-[var(--pl-text-medium)]">
              {url}
            </p>
            <CopyButton value={url} label="DAG 주소 복사" className="flex-none" />
          </div>
        ) : (
          <p className="text-[14px] text-[var(--pl-text-weak)]">{UNAVAILABLE}</p>
        )}
      </Field>

      {(url || host.phase === 'failed') && (
        <div className="mt-5 flex justify-end border-t border-[var(--pl-gray-100)] pt-4">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                pipelineStyles.button.base,
                pipelineStyles.button.md,
                pipelineStyles.button.primary,
              )}
            >
              Airflow에서 열기
              <Icon name="arrow-ur" size="sm" />
            </a>
          ) : (
            // 조회 자체가 실패한 경우에만 — 빈 답을 다시 물어도 답은 같다.
            <PlButton onClick={() => setReload((k) => k + 1)}>다시 시도</PlButton>
          )}
        </div>
      )}
    </>
  );
}

export interface DagDetailModalProps {
  /** 열린 행 — null 이면 닫힌 상태(매 오픈이 새 마운트라 조회도 매번 새로 한다). */
  row: DagDbRow | null;
  timezone: string;
  onClose: () => void;
}

export function DagDetailModal({ row, timezone, onClose }: DagDetailModalProps): ReactElement {
  return (
    <ModalShell open={row !== null} onClose={onClose} variant="task" labelledBy="dag-detail-title">
      {row && <DagDetailBody row={row} timezone={timezone} />}
    </ModalShell>
  );
}
