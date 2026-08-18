'use client';

/**
 * 실데이터 여부 변경 — PUT …/does-support-raw/{enabled|disabled}
 * (docs/api/ops-assumed-contracts.md §9).
 *
 * 같은 헤더의 설치 모드 modal 과 같은 radio-card 한 쌍이다: 한 화면에서 여는 두 값
 * 편집기가 서로 다른 문법을 쓸 이유가 없다.
 *
 * 현재 값이 `undefined`(응답에 필드가 없음)면 아무것도 선택하지 않은 채로 연다 —
 * 모르는 값을 "미포함"에 체크해 두면, 그 화면은 운영자가 확인한 적 없는 값을 이미
 * 확인한 값처럼 보여 주게 된다.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { updateTargetSourceDoesSupportRaw } from '@/app/lib/api/ops';

const TITLE_ID = 'ops-raw-data-title';

// 설명은 이 화면이 하는 일까지만 말한다 — 어떤 대상이 실데이터인지는 계약도 이 화면도
// 정하지 않는다 (운영자가 아는 사실을 여기에 적는 것이다).
const OPTIONS = [
  { enabled: true, title: '실데이터 포함', desc: '대상 카드와 운영 헤더에 실데이터 태그가 붙습니다.' },
  { enabled: false, title: '실데이터 미포함', desc: '실데이터 태그가 붙지 않습니다.' },
] as const;

export interface RawDataModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  /** `undefined` = 조회 응답에 값이 없다 (미확인). */
  current: boolean | undefined;
  onSaved: (enabled: boolean) => void;
}

export function RawDataModal({
  open,
  onClose,
  targetSourceId,
  current,
  onSaved,
}: RawDataModalProps): ReactElement | null {
  const [selected, setSelected] = useState<boolean | undefined>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(current);
      setError(null);
    }
  }, [open, current]);

  const save = async (): Promise<void> => {
    if (selected === undefined) return;
    setSaving(true);
    setError(null);
    try {
      await updateTargetSourceDoesSupportRaw(targetSourceId, selected);
      onSaved(selected);
      onClose();
    } catch {
      setError('변경에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>실데이터 여부 변경</h3>
      {current === undefined && (
        <p className="mt-2 text-[14px] text-[var(--pl-text-weak)]">
          지금 값을 읽지 못했습니다. 고른 값으로 새로 설정합니다.
        </p>
      )}
      <div role="radiogroup" aria-labelledby={TITLE_ID} className="mt-4 flex flex-col gap-3">
        {OPTIONS.map((option) => {
          const active = selected === option.enabled;
          return (
            <button
              key={option.title}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(option.enabled)}
              className={cn(
                'flex items-start gap-3 rounded-lg p-4 text-left transition-colors',
                active
                  ? 'border-[1.5px] border-[var(--pl-primary)] bg-[var(--pl-primary-bg)]'
                  : 'border border-[var(--pl-border)] bg-[var(--pl-bg-card)] hover:bg-[var(--pl-gray-50)]',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2',
                  active ? 'border-[var(--pl-primary)]' : 'border-[var(--pl-gray-300)]',
                )}
              >
                {active && <span className="h-2 w-2 rounded-full bg-[var(--pl-primary)]" />}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[16px] font-semibold text-[var(--pl-text-strong)]">{option.title}</span>
                <span className="text-[14px] leading-[1.4] text-[var(--pl-text-weak)]">{option.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[12px] font-medium text-[var(--pl-err-text)]">
          {error}
        </p>
      )}
      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={saving}>
          취소
        </PlButton>
        <PlButton
          variant="primary"
          onClick={() => void save()}
          disabled={saving || selected === undefined || selected === current}
        >
          {saving ? '변경 중…' : '변경'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
