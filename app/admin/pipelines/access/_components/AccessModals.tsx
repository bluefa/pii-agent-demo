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
import { errorMessage } from '@/app/admin/pipelines/access/_components/PagedCard';

/**
 * 사유·메시지 입력 상한 — **우리가 정한 값이다.** 계약은 길이를 말하지 않는다(E6).
 * 서버가 상한을 확정하면 그 값으로 맞춘다.
 */
const MAX_TEXT = 1000;
/**
 * 권한 요청 사유만 500 이다(오너 지시 2026-08-14). 이 글은 승인 시트의 고정 높이
 * 파란 칸에서 읽히는데, 1000자면 그 칸을 세 번 넘게 스크롤해야 끝까지 읽힌다 —
 * 읽는 자리가 정해져 있으면 쓰는 칸도 거기에 맞춰야 한다. 승인 메시지·반려 사유는
 * 그대로 1000 이다: 그쪽은 요청자에게 통째로 전달되는 글이라 잘릴 자리가 없다.
 */
const MAX_REASON = 500;
/** 타이핑이 멎고 나서 찾는다. 한 글자마다 쏘면 사람 목록을 훑는 요청이 줄줄이 나간다. */
const SEARCH_DEBOUNCE_MS = 500;

// ── 사용자 피커 (서비스 권한 부여 / 관리자 권한 부여) ─────────────────────────

export interface UserPickerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sub: string;
  /**
   * 후보에서 뺄 사람들의 email. "이미 가진 사람"을 아는 쪽은 화면뿐이고, 제외는
   * 어댑터가 응답에서 직접 수행한다(`searchAccessUsers` 주석의 E4 참고).
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
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 닫힐 때 초기화 — 다음에 열었을 때 지난 선택이 남아 있으면 안 된다.
  useEffect(() => {
    if (open) return;
    setQuery('');
    setDebounced('');
    setPicked([]);
    setUsers(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // 배열은 렌더마다 새 참조라 deps 에 그대로 두면 매 렌더 재조회가 된다. 내용으로 키를
  // 만들고, 요청에 쓰는 배열도 그 키에서 되만든다 — 그래야 deps 와 실제로 보내는 값이
  // 같은 것에서 나온다(둘이 갈리면 키는 그대로인데 값만 바뀌는 창이 생긴다).
  const excludeKey = excludeEmails.join(',');

  // 검색어가 있을 때만 찾는다. 빈 질의로 부르면 사람 디렉터리 전체가 모달을 열자마자
  // 쏟아진다 — 부여할 사람을 고르는 화면이 조직도 열람 창이 되면 안 된다. 찾는 사람을
  // 이미 아는 관리자만 그 사람을 본다.
  useAbortableEffect(
    (signal) => {
      if (!open || !debounced) {
        setUsers(null);
        setError(null);
        return;
      }
      setError(null);
      const exclude = excludeKey ? excludeKey.split(',') : [];
      return searchAccessUsers(debounced, exclude, { signal })
        .then((result) => {
          if (signal.aborted) return;
          setUsers(result);
        })
        .catch((err) => {
          if (signal.aborted) return;
          // 실패를 빈 결과로 그리면 안 된다. 이 검색은 ADMIN 전용이라 403 이 흔한 실패인데,
          // "검색 결과가 없어요"로 보이면 관리자는 있는 계정을 없다고 읽고 물러난다 —
          // 부여로 가는 유일한 길이 조용히 막힌다. 실패는 실패로 말하고 재시도를 준다.
          setError(err);
          setUsers(null);
        });
    },
    [open, debounced, excludeKey, retry],
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
        {!debounced ? (
          // 검색 전에는 아무도 보여주지 않는다 — 위 effect 의 이유와 같다.
          <div className={a.pickerEmpty}>Knox ID 나 이메일로 검색해 주세요</div>
        ) : error != null ? (
          <div className={a.pickerError}>
            <span className="min-w-0 truncate">{errorMessage(error)}</span>
            <PlButton variant="secondary" size="sm" onClick={() => setRetry((n) => n + 1)}>
              재시도
            </PlButton>
          </div>
        ) : users == null ? (
          <div className={a.pickerEmpty} aria-busy="true">
            찾는 중이에요
          </div>
        ) : users.length === 0 ? (
          <div className={a.pickerEmpty}>검색 결과가 없어요</div>
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

// ── 글 한 칸짜리 모달 (승인 · 반려 · 권한 요청) ──────────────────────────────

/**
 * 사유·메시지를 한 칸 받아 제출하는 모달. 셋(승인·반려·권한 요청)이 문구만 다르고
 * 규칙은 같아서 몸통을 하나로 둔다 — 닫을 때 비우기, 제출 중 잠그기, `max` 로 자르기,
 * 그리고 필수 칸이면 비어 있는 동안 CTA 를 잠그기.
 *
 * 셋을 따로 두면 이 규칙 넷이 세 벌로 갈린다. 실제로 갈려 있었다 — 승인만 잘라내기가
 * 빠져 있었다.
 */
interface TextModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sub: string;
  /** 입력 칸 위 라벨. "· 필수"/"· 선택"까지 여기서 적는다. */
  label: string;
  placeholder: string;
  submitLabel: string;
  /** 비어 있으면 제출할 수 없는 칸인지. */
  required?: boolean;
  /** 되돌릴 수 없는 쪽(반려)의 CTA. */
  danger?: boolean;
  /** 입력 상한. 세 모달의 기본은 `MAX_TEXT` 고, 권한 요청 사유만 낮춰 받는다. */
  max?: number;
  eyebrowCtx?: string;
  eyebrowId?: string;
  onSubmit: (text: string) => Promise<void>;
}

function TextModal({
  open,
  onClose,
  title,
  sub,
  label,
  placeholder,
  submitLabel,
  required,
  danger,
  max = MAX_TEXT,
  eyebrowCtx,
  eyebrowId,
  onSubmit,
}: TextModalProps): ReactElement {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { modal } = tqStyles;

  useEffect(() => {
    if (!open) setText('');
  }, [open]);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onSubmit(text.slice(0, max));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TqModal
      open={open}
      onClose={onClose}
      eyebrowCtx={eyebrowCtx}
      eyebrowId={eyebrowId}
      title={title}
      sub={sub}
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton
            variant={danger ? 'dangerSolid' : 'primary'}
            onClick={submit}
            disabled={submitting || (required === true && text.trim().length === 0)}
          >
            {submitLabel}
          </PlButton>
        </>
      }
    >
      <div className={modal.label}>{label}</div>
      <textarea
        className={modal.textarea}
        maxLength={max}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
      />
      <CharCount count={text.length} max={max} />
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
  return (
    <TextModal
      open={open}
      onClose={onClose}
      title="접근 권한 요청 승인"
      sub={`${subject}을 승인해요. 승인하는 즉시 해당 서비스 권한이 부여돼요.`}
      label="승인 메시지 · 선택"
      placeholder="요청자에게 전달할 메시지를 남길 수 있어요"
      submitLabel="승인"
      onSubmit={onSubmit}
    />
  );
}

export function RejectAccessModal({
  open,
  onClose,
  subject,
  onSubmit,
}: VerdictModalProps): ReactElement {
  return (
    <TextModal
      open={open}
      onClose={onClose}
      title="접근 권한 요청 반려"
      sub={`${subject}을 반려해요. 사유는 요청자에게 그대로 전달돼요.`}
      label="반려 사유 · 필수"
      placeholder="요청자가 무엇을 보완해 다시 요청해야 하는지 적어 주세요"
      submitLabel="반려"
      required
      danger
      onSubmit={onSubmit}
    />
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

// ── 담당자 보기 (요청자 측, 읽기 전용) ───────────────────────────────────────

export interface OwnersModalProps {
  open: boolean;
  onClose: () => void;
  serviceCode: string;
  serviceName: string;
  /** 담당자 표시명 = Knox ID. 계약에 사람 이름이 없다. */
  owners: string[];
  /** `owners` 는 잘려 올 수 있고, 이쪽은 언제나 맞는 전체 수다. */
  ownerCount: number;
}

/**
 * 한 서비스의 담당자 — 목록 행의 [담당자 보기] 가 연다(오너 지시 2026-08-17).
 *
 * 행 안에 펼치던 것을 모달로 옮겼다. 행의 둘째 단은 한 줄이라 이름이 넘치면 잘렸는데,
 * 펼쳐서 본 답이 또 잘리면 펼친 의미가 없다. 여기서는 몇 명이든 세로로 선다.
 *
 * 읽기만 하는 모달이라 footer 가 없다 — TqModal 은 그때 머리에 X 를 그린다(닫기 하나만
 * 든 footer 를 두지 않는다).
 *
 * 새로 조회하지 않는다. 이 이름들은 목록 행이 이미 싣고 온 값이고(`/services-page` 의
 * `owners`), 전체를 주는 담당자 조회는 ADMIN 전용이라 요청자는 부를 수 없다.
 */
export function OwnersModal({
  open,
  onClose,
  serviceCode,
  serviceName,
  owners,
  ownerCount,
}: OwnersModalProps): ReactElement {
  const hidden = ownerCount - owners.length;
  return (
    <TqModal
      open={open}
      onClose={onClose}
      eyebrowCtx="담당자"
      eyebrowId={serviceCode}
      title={`${serviceName} 담당자`}
      sub="이 서비스의 접근 권한 요청을 검토하는 사람들이에요."
    >
      <div className={a.pickerList}>
        {owners.map((knoxId) => (
          <div key={knoxId} className={a.ownerRow}>
            <span className={a.pickerName}>{knoxId}</span>
          </div>
        ))}
        {/* 서버가 배열을 잘라 보냈을 때 — 이름을 지어내지 않고 수만 말한다. */}
        {hidden > 0 && (
          <div className={a.pickerEmpty}>여기 없는 담당자가 {hidden}명 더 있어요</div>
        )}
      </div>
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
  return (
    <TextModal
      open={open}
      onClose={onClose}
      eyebrowCtx="접근 권한 요청"
      eyebrowId={serviceCode}
      title={`${serviceName} 접근 권한 요청`}
      sub="관리자가 검토한 뒤 승인하거나 반려해요. 결과는 내 요청 내역에서 확인할 수 있어요."
      label="요청 사유 · 필수"
      placeholder="어떤 업무 때문에 이 서비스 접근이 필요한지 적어 주세요"
      submitLabel="요청"
      required
      max={MAX_REASON}
      onSubmit={onSubmit}
    />
  );
}
