'use client';

/**
 * 접근 권한 화면의 모달들 — 전부 TqModal 크롬 위에 올린다(연동 요청 승인/반려와 같은
 * 문법). 사유가 필수인 모달은 비어 있는 동안 CTA 가 눌리지 않는다.
 *
 * 각 모달은 제출을 부모에게 넘기고 성공/실패는 부모가 토스트로 말한다 — 여기서
 * 에러를 삼키면 실패한 쓰기가 조용히 닫히는 모달이 된다.
 */
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { CharCount } from '@/app/admin/pipelines/queue/_components/bits';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { searchAccessUsers, type AccessUser } from '@/app/lib/api/access';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';

/** 계약 maxLength — 사유/메시지 모두 1,000자. */
const MAX_TEXT = 1000;
const SEARCH_DEBOUNCE_MS = 300;

// ── 사용자 피커 (서비스 권한 부여 / 관리자 권한 부여) ─────────────────────────

export interface UserPickerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sub: string;
  /**
   * 후보에서 뺄 사람들의 email. 계약의 `/users/search` 가 `excludeEmails` 를 받으므로
   * "이미 가진 사람"을 아는 쪽(화면)이 넘긴다 — 서버는 그 맥락을 모른다.
   */
  excludeEmails: string[];
  submitLabel: string;
  /** 선택한 사람들의 **email** — 계약의 식별 키다. */
  onSubmit: (emails: string[]) => Promise<void>;
}

export function UserPickerModal({
  open,
  onClose,
  title,
  sub,
  excludeEmails,
  submitLabel,
  onSubmit,
}: UserPickerModalProps): ReactElement {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [users, setUsers] = useState<AccessUser[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 닫힐 때 초기화 — 다음에 열었을 때 지난 선택이 남아 있으면 안 된다.
  useEffect(() => {
    if (open) return;
    setQuery('');
    setDebounced('');
    setPicked([]);
    setUsers(null);
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // 배열은 렌더마다 새 참조라 deps 에 그대로 두면 매 렌더 재조회가 된다. 내용으로 키를
  // 만들고, 요청에 쓰는 배열도 그 키에서 되만든다 — 그래야 deps 와 실제로 보내는 값이
  // 같은 것에서 나온다(둘이 갈리면 키는 그대로인데 값만 바뀌는 창이 생긴다).
  const excludeKey = excludeEmails.join(',');

  useAbortableEffect(
    (signal) => {
      if (!open) return;
      const exclude = excludeKey ? excludeKey.split(',') : [];
      return searchAccessUsers(debounced || undefined, exclude, { signal })
        .then((result) => {
          if (signal.aborted) return;
          setUsers(result);
        })
        .catch(() => {
          if (signal.aborted) return;
          setUsers([]);
        });
    },
    [open, debounced, excludeKey],
  );

  const toggle = (email: string): void =>
    setPicked((prev) =>
      prev.includes(email) ? prev.filter((picked) => picked !== email) : [...prev, email],
    );

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onSubmit(picked);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TqModal
      open={open}
      onClose={onClose}
      title={title}
      sub={sub}
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton
            variant="primary"
            onClick={submit}
            disabled={picked.length === 0 || submitting}
          >
            {submitLabel}
          </PlButton>
        </>
      }
    >
      <div className={a.pickerSearch}>
        <SearchBox
          wrapClassName="block w-full"
          placeholder="Knox ID · 이메일 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="사용자 검색"
        />
      </div>
      <div className={a.pickerList}>
        {users == null ? (
          <div className={a.pickerEmpty} aria-busy="true">
            불러오는 중이에요
          </div>
        ) : users.length === 0 ? (
          <div className={a.pickerEmpty}>
            {debounced ? '검색 결과가 없어요' : '추가할 수 있는 사용자가 없어요'}
          </div>
        ) : (
          users.map((user) => (
            <label key={user.email} className={a.pickerRow}>
              <input
                type="checkbox"
                className={a.checkbox}
                checked={picked.includes(user.email)}
                onChange={() => toggle(user.email)}
              />
              <span className={a.pickerName}>{user.knoxId}</span>
              <span className={a.pickerEmail}>{user.email}</span>
            </label>
          ))
        )}
      </div>
      <div className={a.pickerCount}>{picked.length}명 선택됨</div>
    </TqModal>
  );
}

// ── 승인 / 반려 ──────────────────────────────────────────────────────────────

export interface VerdictModalProps {
  open: boolean;
  onClose: () => void;
  /** "김철수님의 AWS 접근 요청" 처럼 무엇을 결정하는지. */
  subject: string;
  onSubmit: (text: string) => Promise<void>;
}

export function ApproveAccessModal({
  open,
  onClose,
  subject,
  onSubmit,
}: VerdictModalProps): ReactElement {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { modal } = tqStyles;

  useEffect(() => {
    if (!open) setMessage('');
  }, [open]);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onSubmit(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TqModal
      open={open}
      onClose={onClose}
      title="접근 권한 요청 승인"
      sub={`${subject}을 승인해요. 승인하는 즉시 해당 서비스 권한이 부여돼요.`}
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton variant="primary" onClick={submit} disabled={submitting}>
            승인
          </PlButton>
        </>
      }
    >
      <div className={modal.label}>승인 메시지 · 선택</div>
      <textarea
        className={modal.textarea}
        maxLength={MAX_TEXT}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="요청자에게 전달할 메시지를 남길 수 있어요"
      />
      <CharCount count={message.length} max={MAX_TEXT} />
    </TqModal>
  );
}

export function RejectAccessModal({
  open,
  onClose,
  subject,
  onSubmit,
}: VerdictModalProps): ReactElement {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { modal } = tqStyles;

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onSubmit(reason.slice(0, MAX_TEXT));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TqModal
      open={open}
      onClose={onClose}
      title="접근 권한 요청 반려"
      sub={`${subject}을 반려해요. 사유는 요청자에게 그대로 전달돼요.`}
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton
            variant="dangerSolid"
            onClick={submit}
            disabled={reason.trim().length === 0 || submitting}
          >
            반려
          </PlButton>
        </>
      }
    >
      <div className={modal.label}>반려 사유 · 필수</div>
      <textarea
        className={modal.textarea}
        maxLength={MAX_TEXT}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="요청자가 무엇을 보완해 다시 요청해야 하는지 적어 주세요"
      />
      <CharCount count={reason.length} max={MAX_TEXT} />
    </TqModal>
  );
}

// ── 해제 / 회수 확인 ─────────────────────────────────────────────────────────

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sub: string;
  confirmLabel: string;
  children?: ReactNode;
  onConfirm: () => Promise<void>;
}

export function ConfirmDangerModal({
  open,
  onClose,
  title,
  sub,
  confirmLabel,
  children,
  onConfirm,
}: ConfirmModalProps): ReactElement {
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TqModal
      open={open}
      onClose={onClose}
      title={title}
      sub={sub}
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton variant="dangerSolid" onClick={submit} disabled={submitting}>
            {confirmLabel}
          </PlButton>
        </>
      }
    >
      {children}
    </TqModal>
  );
}

// ── 권한 요청 (요청자 측) ────────────────────────────────────────────────────

export interface RequestAccessModalProps {
  open: boolean;
  onClose: () => void;
  serviceCode: string;
  serviceName: string;
  onSubmit: (reason: string) => Promise<void>;
}

export function RequestAccessModal({
  open,
  onClose,
  serviceCode,
  serviceName,
  onSubmit,
}: RequestAccessModalProps): ReactElement {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { modal } = tqStyles;

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onSubmit(reason.slice(0, MAX_TEXT));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TqModal
      open={open}
      onClose={onClose}
      eyebrowCtx="접근 권한 요청"
      eyebrowId={serviceCode}
      title={`${serviceName} 접근 권한 요청`}
      sub="관리자가 검토한 뒤 승인하거나 반려해요. 결과는 내 요청 내역에서 확인할 수 있어요."
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton
            variant="primary"
            onClick={submit}
            disabled={reason.trim().length === 0 || submitting}
          >
            요청
          </PlButton>
        </>
      }
    >
      <div className={modal.label}>요청 사유 · 필수</div>
      <textarea
        className={modal.textarea}
        maxLength={MAX_TEXT}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="어떤 업무 때문에 이 서비스 접근이 필요한지 적어 주세요"
      />
      <CharCount count={reason.length} max={MAX_TEXT} />
    </TqModal>
  );
}
