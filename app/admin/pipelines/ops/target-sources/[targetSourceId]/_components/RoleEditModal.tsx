'use client';

/**
 * Role 등록/수정 modal — the upsert surface for the AWS role contract.
 * Name-only entry: the ARN is composed from the account id + partition
 * (China → aws-cn), so a whole class of ARN typos can't happen; the composed
 * FULL ARN is what gets sent (AwsAssumeRoleUpsertRequest). Frequently-used
 * names render as vertically stacked chips (ROLE_META.recommended) that fill
 * the input — still editable afterwards. Saving resets the verification
 * verdict until the next verify.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { AWS_ROLE_NAME_RE, awsRoleArnPrefix } from '@/lib/constants/aws-role';
import { updateAwsRole } from '@/app/lib/api/ops';
import { ROLE_META, type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';

const TITLE_ID = 'ops-role-edit-title';

/** Extracts the role name from an existing ARN for the initial input value. */
const roleNameFromArn = (arn: string | undefined): string => arn?.split(':role/')[1] ?? '';

export interface RoleEditModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  kind: RoleKind;
  currentArn?: string;
  accountId: string;
  isChinaRegion: boolean;
  regionLabel: string;
  /** Fired with the composed ARN after a successful save. */
  onSaved: (kind: RoleKind, roleArn: string) => void;
}

export function RoleEditModal({
  open,
  onClose,
  targetSourceId,
  kind,
  currentArn,
  accountId,
  isChinaRegion,
  regionLabel,
  onSaved,
}: RoleEditModalProps): ReactElement | null {
  const meta = ROLE_META[kind];
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(roleNameFromArn(currentArn));
      setError(null);
    }
  }, [open, currentArn]);

  const prefix = awsRoleArnPrefix(accountId, isChinaRegion);
  const trimmed = name.trim();

  const save = async (): Promise<void> => {
    // 계정 ID 없이 조립한 ARN(arn:aws:iam:::role/…)은 라우트 검증에서 반드시 떨어진다 —
    // "잠시 후 다시 시도" 로 오도하지 말고 진짜 원인을 여기서 말한다.
    if (!accountId) {
      setError('AWS 계정 ID가 없어 ARN을 만들 수 없습니다. 대상의 계정 정보를 먼저 등록해 주세요.');
      return;
    }
    if (!AWS_ROLE_NAME_RE.test(trimmed)) {
      setError(
        trimmed.length > 64
          ? `이름이 너무 깁니다. ${trimmed.length}자를 입력했고 최대 64자입니다.`
          : '영숫자와 + = , . @ - _ 만 쓸 수 있습니다.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const composedArn = `${prefix}${trimmed}`;
      const saved = await updateAwsRole(targetSourceId, kind, composedArn);
      // Loose schema — a null roleArn on the wire falls back to what we sent.
      onSaved(kind, saved.roleArn ?? composedArn);
      onClose();
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        {meta.title} 등록/수정
      </h3>
      <p className={pipelineStyles.modal.desc}>
        Role 이름만 입력하면 아래 계정 정보로 ARN을 만듭니다. 등록된 Role이 없으면 새로
        만들고, 이미 있으면 갱신합니다{' '}
        <span className="font-semibold text-[var(--pl-primary)]">(Upsert)</span>.
      </p>
      <div className="mb-3 flex items-center gap-2 text-[12px]">
        <span className="text-[var(--pl-text-faint)]">AWS 계정</span>
        <span className="font-medium text-[var(--pl-text-medium)]">{accountId}</span>
        <span className="text-[var(--pl-text-faint)]">·</span>
        <span className="inline-flex items-center rounded bg-[var(--pl-primary-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pl-primary)]">
          {regionLabel}
        </span>
      </div>

      <label htmlFor="ops-role-name" className={cn(pipelineStyles.text.subsectionTitle, 'block')}>
        Role 이름 <span className="text-[var(--pl-err-text)]" aria-hidden>*</span>
      </label>
      <input
        id="ops-role-name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        placeholder={meta.sample}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby="ops-role-helper"
        className={cn(pipelineStyles.input, 'mt-2 w-full [font-family:var(--pl-font-mono)]')}
      />
      {/* 자주 쓰는 이름 — 한 줄에 늘어놓지 않고 세로로 쌓는다 (추가돼도 행이 안 깨진다). */}
      {meta.recommended.length > 0 && (
        <div className="mt-2 flex flex-col items-start gap-1.5">
          {meta.recommended.map((rec) => (
            <button
              key={rec}
              type="button"
              onClick={() => {
                setName(rec);
                setError(null);
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-semibold [font-family:var(--pl-font-mono)]',
                trimmed === rec
                  ? 'border-[var(--pl-primary)] bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]'
                  : 'border-[var(--pl-border-strong)] bg-[var(--pl-gray-50)] text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-100)]',
              )}
            >
              {rec}
            </button>
          ))}
          <p className={pipelineStyles.text.meta}>
            자주 쓰는 이름 — 누르면 채워지고, 이어서 고칠 수 있습니다.
          </p>
        </div>
      )}
      <p className={cn(pipelineStyles.text.mono, 'mt-2 break-all text-[var(--pl-text-faint)]')}>
        {prefix}
        {trimmed || meta.sample}
      </p>
      <p id="ops-role-helper" className={cn(pipelineStyles.text.meta, 'mt-1')}>
        영숫자와 + = , . @ - _ 를 쓸 수 있고 최대 64자입니다.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[var(--pl-err-text)]">
          {error}
        </p>
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={saving}>
          취소
        </PlButton>
        <PlButton variant="primary" onClick={() => void save()} disabled={saving || !trimmed}>
          {saving ? '저장 중…' : '저장'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
