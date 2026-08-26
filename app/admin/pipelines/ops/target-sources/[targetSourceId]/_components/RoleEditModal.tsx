'use client';

/**
 * Role 등록/수정 modal — the upsert surface for the AWS role contract.
 * Name-only entry: the ARN is composed from the account id + partition
 * (China → aws-cn), so a whole class of ARN typos can't happen; the composed
 * FULL ARN is what gets sent (AwsAssumeRoleUpsertRequest). Frequently-used
 * names render as vertically stacked chips (ROLE_META.recommended) that fill
 * the input — still editable afterwards. Saving resets the verification
 * verdict until the next verify.
 *
 * 여는 자리가 둘이라 `kinds` 를 받는다 (design-benchmark `ops-header-groups.md`):
 * 헤더의 「계정 정보」 묶음 머리는 그 대상이 가진 주체 전부를 한 폼에 놓고, 스캔 탭의
 * 자격 증명 카드는 **판정이 떨어진 그 하나**만 놓는다 — 거기서 둘을 같이 열면 화면이
 * 지목한 원인이 흐려진다. 폼은 같고 절의 수만 다르다.
 *
 * **이름이 바뀐 절만 PUT 한다.** 안 건드린 Role 까지 쓰면 그 주체의 검증 판정이 이유
 * 없이 초기화되고, 감사 로그에는 바꾼 적 없는 변경이 남는다.
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
  /** 폼에 세울 주체들 — 순서대로 절이 선다. 하나면 그 주체의 이름이 제목이 된다. */
  kinds: readonly RoleKind[];
  /** 표시·초기값의 출처. 없는 kind 는 빈 입력으로 연다. */
  currentArns: Partial<Record<RoleKind, string>>;
  accountId: string;
  isChinaRegion: boolean;
  regionLabel: string;
  /** Fired once per successfully saved kind, with the composed ARN. */
  onSaved: (kind: RoleKind, roleArn: string) => void;
}

export function RoleEditModal({
  open,
  onClose,
  targetSourceId,
  kinds,
  currentArns,
  accountId,
  isChinaRegion,
  regionLabel,
  onSaved,
}: RoleEditModalProps): ReactElement | null {
  const [names, setNames] = useState<Partial<Record<RoleKind, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 부모가 렌더마다 새 리터럴을 만드는 props 라 참조로 걸면 열려 있는 동안 입력이 매
  // 렌더 초기화된다 — 값으로 좁혀 잡는다.
  const kindsKey = kinds.join(',');
  const arnsKey = kinds.map((kind) => currentArns[kind] ?? '').join('|');

  useEffect(() => {
    if (!open) return;
    setNames(
      Object.fromEntries(kinds.map((kind) => [kind, roleNameFromArn(currentArns[kind])])),
    );
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kindsKey, arnsKey]);

  const prefix = awsRoleArnPrefix(accountId, isChinaRegion);
  const nameOf = (kind: RoleKind): string => (names[kind] ?? '').trim();
  const changed = kinds.filter((kind) => nameOf(kind) !== roleNameFromArn(currentArns[kind]));

  const save = async (): Promise<void> => {
    // 계정 ID 없이 조립한 ARN(arn:aws:iam:::role/…)은 라우트 검증에서 반드시 떨어진다 —
    // "잠시 후 다시 시도" 로 오도하지 말고 진짜 원인을 여기서 말한다.
    if (!accountId) {
      setError('AWS 계정 ID가 없어 ARN을 만들 수 없습니다. 대상의 계정 정보를 먼저 등록해 주세요.');
      return;
    }
    for (const kind of changed) {
      const trimmed = nameOf(kind);
      if (!AWS_ROLE_NAME_RE.test(trimmed)) {
        const label = kinds.length > 1 ? `${ROLE_META[kind].title}: ` : '';
        setError(
          trimmed.length > 64
            ? `${label}이름이 너무 깁니다. ${trimmed.length}자를 입력했고 최대 64자입니다.`
            : `${label}영숫자와 + = , . @ - _ 만 쓸 수 있습니다.`,
        );
        return;
      }
    }
    setSaving(true);
    setError(null);
    const done: RoleKind[] = [];
    try {
      for (const kind of changed) {
        const composedArn = `${prefix}${nameOf(kind)}`;
        // Loose schema — a null roleArn on the wire falls back to what we sent.
        const saved = await updateAwsRole(targetSourceId, kind, composedArn);
        onSaved(kind, saved.roleArn ?? composedArn);
        done.push(kind);
      }
      onClose();
    } catch {
      // 앞 절이 이미 저장됐으면 그것부터 말한다 — 다시 눌러도 그 절은 이제 "안 바뀜"이라
      // 건너뛰므로, 무엇이 남았는지 모르면 운영자는 저장이 통째로 실패한 줄 안다.
      const rest = changed.filter((kind) => !done.includes(kind));
      setError(
        done.length > 0
          ? `${done.map((k) => ROLE_META[k].title).join(' · ')}은(는) 저장했지만 ${rest
              .map((k) => ROLE_META[k].title)
              .join(' · ')} 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.`
          : '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        {kinds.length === 1 ? `${ROLE_META[kinds[0]].title} 등록/수정` : 'Role 등록/수정'}
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

      {kinds.map((kind, index) => {
        const meta = ROLE_META[kind];
        const inputId = `ops-role-name-${kind}`;
        const helperId = `ops-role-helper-${kind}`;
        const trimmed = nameOf(kind);
        return (
          <div
            key={kind}
            className={index > 0 ? 'mt-5 border-t border-[var(--pl-border)] pt-4' : undefined}
          >
            <label htmlFor={inputId} className={cn(pipelineStyles.text.subsectionTitle, 'block')}>
              {kinds.length === 1 ? 'Role 이름' : `${meta.title} 이름`}{' '}
              <span className="text-[var(--pl-err-text)]" aria-hidden>
                *
              </span>
            </label>
            <input
              id={inputId}
              value={names[kind] ?? ''}
              onChange={(event) => {
                setNames((prev) => ({ ...prev, [kind]: event.target.value }));
                setError(null);
              }}
              placeholder={meta.sample}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={helperId}
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
                      setNames((prev) => ({ ...prev, [kind]: rec }));
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
            {/* 조립된 ARN — 이 폼이 실제로 보낼 값이라 훑는 글자가 아니라 대조하는
                글자다. faint(#98A2B3)는 흰 면에서 2.58:1 로 AA 아래라 weak 로 세운다. */}
            <p className={cn(pipelineStyles.text.mono, 'mt-2 break-all text-[var(--pl-text-weak)]')}>
              {prefix}
              {trimmed || meta.sample}
            </p>
            <p id={helperId} className={cn(pipelineStyles.text.meta, 'mt-1')}>
              영숫자와 + = , . @ - _ 를 쓸 수 있고 최대 64자입니다.
            </p>
          </div>
        );
      })}

      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[var(--pl-err-text)]">
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
          disabled={saving || changed.length === 0}
        >
          {saving ? '저장 중…' : '저장'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
