'use client';

/**
 * 「대상 설정」 묶음의 편집 폼 — 설치모드 + 실데이터 여부 (design-benchmark
 * `ops-header-groups.md`, 시안 C).
 *
 * 두 값은 각각 제 모달을 갖고 있었고(InstallModeModal · RawDataModal), 헤더에는 값마다
 * 「수정」이 붙어 있었다. 오너 2026-08-26: "수정 가능한 내역들도 너무 많음". 둘은 같은
 * 질문의 두 항목("이 대상을 어떻게 다루는가")이고 radio-card 문법까지 같았으므로 —
 * 옛 RawDataModal 의 주석이 스스로 "같은 헤더의 설치 모드 modal 과 같은 radio-card 한
 * 쌍"이라고 적어 두었다 — 한 폼으로 합치고 진입을 묶음 머리 하나로 줄인다.
 * PatternFly 의 임계값 그대로다: 필드 하나면 인라인, 여럿이면 섹션 하나가 폼을 연다.
 *
 * **바뀐 것만 PUT 한다.** 두 값은 계약도 엔드포인트도 다르므로(installation-mode ·
 * does-support-raw) 한 번에 저장할 수 없다. 안 건드린 값까지 쓰면 실패했을 때 무엇이
 * 되돌아갔는지 말할 수 없고, 감사 로그에도 바꾼 적 없는 변경이 남는다. 둘 다 바뀌었고
 * 뒤엣것이 실패하면 앞엣것은 이미 저장됐다고 화면이 말한다.
 */
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { updateInstallationMode, updateTargetSourceDoesSupportRaw } from '@/app/lib/api/ops';

const TITLE_ID = 'ops-target-settings-title';
const MODE_ID = 'ops-target-settings-mode';
const RAW_ID = 'ops-target-settings-raw';

const MODE_OPTIONS = [
  { value: true, title: '자동 설치', desc: 'Agent를 자동으로 설치하고 구성합니다. Terraform 실행 권한을 위임합니다.' },
  { value: false, title: '수동 설치', desc: '직접 Agent를 설치하고 구성합니다. 설치 스크립트를 직접 실행합니다.' },
] as const;

// 설명은 이 화면이 하는 일까지만 말한다 — 어떤 대상이 실데이터인지는 계약도 이 화면도
// 정하지 않는다 (운영자가 아는 사실을 여기에 적는 것이다).
const RAW_OPTIONS = [
  { value: true, title: '실데이터 포함', desc: '서비스 운영의 대상 카드에 실데이터 태그가 붙습니다.' },
  { value: false, title: '실데이터 미포함', desc: '대상 카드에 태그가 붙지 않습니다.' },
] as const;

export interface TargetSettingsModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  /** 설치모드는 AWS 만 갖는다 (Terraform 실행 권한 위임) — 없으면 그 절이 통째로 빠진다. */
  showInstallMode: boolean;
  currentGrant: boolean;
  /** `undefined` = 조회 응답에 값이 없다 (미확인). */
  currentRaw: boolean | undefined;
  /** 실제로 저장된 것만 실린다 — 부분 저장이면 성공한 쪽만 온다. */
  onSaved: (next: { grant?: boolean; raw?: boolean }) => void;
}

function RadioCard({
  active,
  title,
  desc,
  onSelect,
}: {
  active: boolean;
  title: string;
  desc: string;
  onSelect: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
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
        <span className="text-[16px] font-semibold text-[var(--pl-text-strong)]">{title}</span>
        <span className="text-[14px] leading-[1.4] text-[var(--pl-text-weak)]">{desc}</span>
      </span>
    </button>
  );
}

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="mt-4">
      <h4 id={id} className={pipelineStyles.text.subsectionTitle}>
        {title}
      </h4>
      {note}
      <div role="radiogroup" aria-labelledby={id} className="mt-2 flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

export function TargetSettingsModal({
  open,
  onClose,
  targetSourceId,
  showInstallMode,
  currentGrant,
  currentRaw,
  onSaved,
}: TargetSettingsModalProps): ReactElement | null {
  const [grant, setGrant] = useState(currentGrant);
  const [raw, setRaw] = useState<boolean | undefined>(currentRaw);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setGrant(currentGrant);
      setRaw(currentRaw);
      setError(null);
    }
  }, [open, currentGrant, currentRaw]);

  const modeChanged = showInstallMode && grant !== currentGrant;
  const rawChanged = raw !== undefined && raw !== currentRaw;

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    const saved: { grant?: boolean; raw?: boolean } = {};
    try {
      if (modeChanged) {
        const result = await updateInstallationMode(targetSourceId, grant);
        saved.grant = result.grant_service_terraform_execution_permission;
      }
      if (rawChanged && raw !== undefined) {
        await updateTargetSourceDoesSupportRaw(targetSourceId, raw);
        saved.raw = raw;
      }
      onSaved(saved);
      onClose();
    } catch {
      // 앞엣것이 이미 저장됐으면 그 사실부터 알린다 — 다시 눌렀을 때 무엇이 남았는지
      // 모르면 운영자는 같은 값을 두 번 쓰거나, 안 바뀐 줄 알고 포기한다.
      if (saved.grant !== undefined) {
        onSaved(saved);
        setError('설치모드는 저장했지만 실데이터 여부 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setError('변경에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        대상 설정 변경
      </h3>

      {showInstallMode && (
        <Section id={MODE_ID} title="설치모드">
          {MODE_OPTIONS.map((option) => (
            <RadioCard
              key={option.title}
              active={grant === option.value}
              title={option.title}
              desc={option.desc}
              onSelect={() => setGrant(option.value)}
            />
          ))}
        </Section>
      )}

      <Section
        id={RAW_ID}
        title="실데이터 여부"
        note={
          // 모르는 값을 "미포함"에 체크해 두면 화면이 확인한 적 없는 값을 확인한 값처럼
          // 보여 준다. 안내도 "못 읽었다"가 아니라 "응답에 없다"라고 적는다.
          currentRaw === undefined ? (
            <p className="mt-1 text-[14px] text-[var(--pl-text-weak)]">
              지금 값이 응답에 없습니다. 고른 값으로 새로 설정합니다.
            </p>
          ) : undefined
        }
      >
        {RAW_OPTIONS.map((option) => (
          <RadioCard
            key={option.title}
            active={raw === option.value}
            title={option.title}
            desc={option.desc}
            onSelect={() => setRaw(option.value)}
          />
        ))}
      </Section>

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
          disabled={saving || (!modeChanged && !rawChanged)}
        >
          {saving ? '변경 중…' : '변경'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
