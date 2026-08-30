'use client';

/**
 * BDC 구축 완료 확인 — 관리자가 「BDC 쪽 리소스 구축이 끝났다」고 단언하기 전에 서는 창
 * (요청서 `docs/bff-api/requests/2026-08-30-sdu-bdc-completion.md`).
 *
 * 이 창이 하는 일은 둘이다.
 *
 * 1. **세 항목을 관리자가 직접 체크한다.** 서버로 가는 값은 `completed` 하나뿐이고 항목별
 *    저장은 없다 — 세 체크는 계약의 필드가 아니라 이 화면의 절차다.
 * 2. **각 항목 옆에 콘솔이 이미 아는 상태를 적는다.** 판정은 「연동 현황」 카드가 쓰는 것과
 *    같은 함수(`statusRows` 의 `scanRow`·`confirmRow`)에서 나온다 — 같은 사실을 두 화면이
 *    다른 낱말로 부르면 관리자는 어느 쪽을 믿을지 모른다.
 *
 * ⛔ 상태 줄에는 **글리프가 없다.** 이 창에서 체크 표시는 관리자가 찍는 것 하나뿐이어야
 * 하고, 콘솔이 읽지 못한 항목(Glue)이 초록 체크로 보일 자리를 아예 만들지 않는다.
 * 못 읽은 것은 못 읽었다고 한 줄로 말한다.
 */
import { useState, type ReactElement } from 'react';
import type { z } from 'zod';

import { cn } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import type { schemas } from '@/lib/generated/install-v1';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { getLatestScanJob } from '@/app/lib/api/scan';
import { getTerraformStatus, type TerraformStatusResponse } from '@/app/lib/api';
import { putSduBdcCompletion } from '@/app/lib/api/sdu';
import { metaOf } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import {
  confirmRow,
  scanRow,
  type RowMark,
  type Settled,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/status/statusRows';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

/** 계약 §9 — SDU 의 Terraform 작업은 이 둘뿐이고 둘 다 BDC 주체다. */
const SDU_TASK_NAMES = ['SDU_BDC_SERVICE_COMMON', 'SDU_BDC_SERVICE'] as const;

/**
 * 판정만 색을 갖는다 — 「연동 현황」 카드의 `VALUE_INK` 와 같은 눈금이다. 그 파일에서 꺼내
 * 오지 않는 이유는 그것이 Server Component 라 `@/lib/bff/client` 를 지고 있기 때문이다:
 * 여기서 import 하면 브라우저 번들이 BFF 어댑터를 통째로 끌어온다.
 */
const STATE_INK: Record<RowMark, string> = {
  ok: 'text-[var(--pl-text-strong)]',
  err: 'text-[var(--pl-err-text)]',
  warn: 'text-[var(--pl-warn-text)]',
  run: 'text-[var(--pl-text-medium)]',
  idle: 'text-[var(--pl-text-weak)]',
  unknown: 'text-[var(--pl-text-weak)]',
};

const QUESTION = 'text-[16px] font-semibold leading-[1.5] text-[var(--pl-text-strong)]';
const ITEM_ROW = 'flex cursor-pointer items-start gap-2.5';
const ITEM_NAME = 'text-[14px] font-medium leading-[1.5] text-[var(--pl-text-strong)]';
const ITEM_STATE = 'mt-1 pl-[26px] text-[12px] leading-[1.5]';
const CHECKBOX = 'mt-[3px] h-4 w-4 flex-none accent-[var(--pl-primary)]';

/** 한 줄로 접은 콘솔의 답 — 아직 읽는 중이면 `null` 이 아니라 「확인 중」이다. */
interface KnownState {
  text: string;
  mark: RowMark;
}

interface Item {
  key: string;
  label: string;
  /** 콘솔이 이 항목에 대해 아는 것. 모르는 항목은 `null` 이고, 그 자리는 아래 한 줄이 갖는다. */
  known: KnownState | null;
}

/** 콘솔이 읽을 수 없는 항목이 쓰는 문장. 빈 자리도, 가짜 체크도 두지 않는다. */
const UNKNOWABLE = '이 콘솔이 확인할 수 없는 항목입니다 — 직접 확인한 내용만 체크하세요.';

const LOADING: KnownState = { text: '확인 중…', mark: 'unknown' };

/** Terraform 작업 톤 → 행 마크. 두 작업 중 나쁜 쪽이 줄의 톤을 정한다. */
const TASK_MARK: Record<string, RowMark> = { off: 'idle', info: 'run', ok: 'ok', err: 'err' };

const terraformState = (terraform: Settled<TerraformStatusResponse> | null): KnownState => {
  if (!terraform) return LOADING;
  if (!terraform.ok) return { text: '조회 실패', mark: 'unknown' };

  const tasks = terraform.value.tasks ?? [];
  // 두 작업이 통째로 없으면 「미적용」 둘을 적는 대신 인프라 행과 같은 말을 쓴다 —
  // 운영자에게는 하나의 사실이다: 이 대상에서 Terraform 이 아직 한 번도 돌지 않았다.
  if (tasks.length === 0) return { text: '인프라 작업 기록 없음', mark: 'idle' };

  const rows = SDU_TASK_NAMES.map((name) => {
    const task = tasks.find((candidate) => candidate.terraform_task_name === name);
    return { name, meta: metaOf(task?.state) };
  });
  const marks = rows.map((row) => TASK_MARK[row.meta.tone] ?? 'unknown');
  const mark: RowMark = marks.includes('err')
    ? 'err'
    : marks.includes('run')
      ? 'run'
      : marks.every((value) => value === 'ok')
        ? 'ok'
        : 'idle';
  return { text: rows.map((row) => `${row.name} ${row.meta.label}`).join(' · '), mark };
};

const scanState = (
  scan: Settled<ScanJob | null> | null,
  terraform: Settled<TerraformStatusResponse> | null,
): KnownState => {
  if (!scan || !terraform) return LOADING;
  const found = scanRow(scan);
  const confirmed = confirmRow(terraform);
  return {
    text: [found.value, found.sub, confirmed.value].filter(Boolean).join(' · '),
    // 스캔이 끝났어도 확정이 없으면 줄은 초록이 아니다 — 이 항목은 둘 다여야 참이다.
    mark: found.mark === 'ok' ? confirmed.mark : found.mark,
  };
};

export interface SduBdcCompleteModalProps {
  targetSourceId: number;
  open: boolean;
  onClose: () => void;
  /** 단언이 저장됐다 — 부르는 쪽이 upload 와 process-status 를 **다시 읽는다**. */
  onCompleted: () => void;
}

export function SduBdcCompleteModal({
  targetSourceId,
  open,
  onClose,
  onCompleted,
}: SduBdcCompleteModalProps): ReactElement {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [scan, setScan] = useState<Settled<ScanJob | null> | null>(null);
  const [terraform, setTerraform] = useState<Settled<TerraformStatusResponse> | null>(null);

  // 창을 열 때 읽는다. 이 조회들은 「연동 현황」 카드가 서버에서 하는 것이라 브라우저에는
  // 아직 값이 없고, 단언 직전의 화면은 **지금** 무엇이 참인지를 말해야 한다.
  useAbortableEffect(
    (signal) => {
      if (!open) return;
      setScan(null);
      setTerraform(null);
      const latest = getLatestScanJob(targetSourceId, { signal })
        // 404 는 「아직 안 돌았다」이지 거절이 아니다 — 이 둘을 하나로 접으면 멀쩡한 대상이
        // 고장 난 것으로 읽힌다 (`statusRows` 규칙 1).
        .then((job) => ({ ok: true, value: job }) as const)
        .catch((error: unknown) =>
          error instanceof AppError && error.status === 404
            ? ({ ok: true, value: null } as const)
            : ({ ok: false } as const),
        )
        .then((settled) => !signal.aborted && setScan(settled));
      const tf = getTerraformStatus(targetSourceId)
        .then((value) => ({ ok: true, value }) as const)
        .catch(() => ({ ok: false }) as const)
        .then((settled) => !signal.aborted && setTerraform(settled));
      return Promise.all([latest, tf]).then(() => undefined);
    },
    [open, targetSourceId],
  );

  const toast = usePlToast();
  const { mutate, loading } = useApiMutation<void, void>(
    () => putSduBdcCompletion(targetSourceId, true),
    {
      onSuccess: () => {
        setChecked({});
        toast.show('BDC 구축을 완료로 처리했습니다.');
        onCompleted();
      },
      // 두 문장 다 이 화면의 것이다 (ADR-008) — 상류 메시지는 UI 문구가 아니다.
      onError: () => toast.show('BDC 구축 완료 처리에 실패했습니다.'),
    },
  );

  const items: Item[] = [
    { key: 'glue', label: 'Glue 설정 확인', known: null },
    { key: 'scan', label: 'Scan & 확정', known: scanState(scan, terraform) },
    { key: 'terraform', label: 'Terraform 동작', known: terraformState(terraform) },
  ];
  const allChecked = items.every((item) => checked[item.key] === true);

  return (
    <ConfirmStepModal
      open={open}
      onClose={onClose}
      onConfirm={() => void mutate()}
      title="BDC 구축 완료로 처리할까요?"
      description="완료로 처리하면 이 Target Source는 6단계(연결 확인 완료)로 넘어갑니다."
      confirmLabel="완료 처리"
      size="md"
      isPending={loading}
      confirmDisabled={!allChecked}
    >
      <p className={QUESTION}>세 가지를 모두 확인하셨나요?</p>
      <ul className="mt-4 flex flex-col gap-3.5">
        {items.map((item) => (
          <li key={item.key}>
            <label className={ITEM_ROW}>
              <input
                type="checkbox"
                className={CHECKBOX}
                checked={checked[item.key] === true}
                disabled={loading}
                onChange={(event) =>
                  setChecked((previous) => ({ ...previous, [item.key]: event.target.checked }))
                }
              />
              <span className={ITEM_NAME}>{item.label}</span>
            </label>
            <p
              className={cn(
                ITEM_STATE,
                item.known ? STATE_INK[item.known.mark] : 'text-[var(--pl-text-weak)]',
              )}
            >
              {item.known ? item.known.text : UNKNOWABLE}
            </p>
          </li>
        ))}
      </ul>
    </ConfirmStepModal>
  );
}
