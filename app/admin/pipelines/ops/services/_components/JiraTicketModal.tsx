'use client';

/**
 * Jira Ticket 연결 / 연결 해제 modal — 한 창에 동작 하나.
 *
 * 무엇을 할지는 타일의 ⋮ 드롭다운(JiraTicketMenu)이 이미 고르게 하므로, 이 창은 그 동작의
 * 입력·확인만 담는다. 제목이 지금 하는 일을 말하고, 어느 provider 인지는 본문에서 굵게
 * 짚는다 — 제목에 provider 까지 붙이면 제목이 두 가지를 말한다.
 *
 * 두 동작 모두 "서비스 ↔ 티켓 매핑"만 바꾸고 Jira 의 티켓 자체는 건드리지 않는다
 * (docs/api/jira-tickets.md §1). 해제가 되돌릴 수 있는 작업이라는 사실이 문구와
 * 버튼 톤 양쪽에 드러나야 한다 — EOS 처럼 dangerSolid 로 겁주지 않는다.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { providerLabel } from '@/lib/pipeline/format';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { userErrorText } from '@/app/admin/pipelines/ops/services/_components/errorText';
import {
  addJiraTicketWatcher,
  attachJiraTicket,
  detachJiraTicket,
  type JiraCloudProvider,
} from '@/app/lib/api/ops';

const TITLE_ID = 'ops-jira-ticket-title';
const INPUT_ID = 'ops-jira-issue-key';
const EDGE_SPACE_ID = 'ops-jira-issue-key-space';

/** 입력 경고·요청 실패 문구 — 같은 자리, 같은 톤(err). */
const warnStyle = 'mt-2 text-[12px] font-medium text-[var(--pl-err-text)]';
/** 제목 — 이 창이 무엇을 하는 창인지가 제일 크게 읽혀야 한다(기본 modalTitle 16 → 20). */
const titleStyle = 'mb-3 text-[20px] font-bold leading-[1.25] text-[var(--pl-text-strong)]';
/** 본문에서 짚는 값(provider·티켓 키) — 문장 안에서만 굵게. */
const emphasis = 'font-semibold text-[var(--pl-text-strong)]';
/** 되돌릴 수 있다는 사실이 핵심 — 경고(err)가 아니라 정보(info) 톤. */
const noteStyle =
  'flex items-start gap-2 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-3.5 py-3 text-[14px] leading-[1.6] text-[var(--pl-text-medium)]';

export type JiraTicketAction = 'attach' | 'detach' | 'watcher';

export interface JiraTicketModalProps {
  onClose: () => void;
  serviceCode: string;
  provider: JiraCloudProvider;
  /** ⋮ 드롭다운이 고른 동작. */
  action: JiraTicketAction;
  /** 연결된 티켓 값 — attach 면 입력창의 초기값, detach 면 무엇을 끊는지. */
  issueKey: string | null;
  /** 성공 — 티켓 목록을 다시 읽는다. */
  onDone: () => void;
}

export function JiraTicketModal({
  onClose,
  serviceCode,
  provider,
  action,
  issueKey,
  onDone,
}: JiraTicketModalProps): ReactElement {
  // v5 계약 — issueKey 는 티켓 키 그대로다 (주소는 browseUrl 별도 필드).
  // watcher 모드에서 입력값은 사용자 ID 라 티켓 키를 시드하지 않는다.
  const initialValue = action === 'attach' && issueKey ? issueKey : '';
  const [value, setValue] = useState(initialValue);
  // JiraTicketAttachRequest.validate — 기본은 검증(존재하지 않는 키가 조용히 연결되지 않게).
  const [validate, setValidate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // watcher 성공 상태 — toast 를 쓰지 않고 모달 안에서 상태전이로 알린 뒤 스스로 닫는다.
  const [done, setDone] = useState(false);

  useEffect(() => {
    setValue(initialValue);
    setValidate(true);
    setError(null);
    setDone(false);
  }, [action, provider, initialValue]);

  // 성공 화면을 잠깐 보여주고 1초 안에 닫는다. 데이터 갱신(onDone)은 성공 즉시 이미
  // 일어났으므로, 배경 클릭/ESC 로 먼저 닫아도 잃는 것이 없다.
  // onClose 는 ref 로 든다 — 부모가 인라인 함수를 넘기면 렌더마다 identity 가 바뀌는데,
  // 그때마다 타이머가 리셋되면 부모가 주기 렌더를 도는 동안 성공 화면이 안 닫힌다.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => onCloseRef.current(), 900);
    return () => clearTimeout(timer);
  }, [done]);

  // 앞뒤 공백은 조용히 잘라내지 않는다 — 붙여넣기 사고(줄바꿈·탭)를 그대로 저장하면
  // Jira 에 없는 키로 연결되고, 화면에는 멀쩡한 키로 보여 원인을 못 찾는다. 경고를 띄우고
  // 저장을 막아 사용자가 무엇이 들어갔는지 알게 한다.
  const trimmed = value.trim();
  // allowlist — 입력창을 갖는 동작을 양성으로 나열한다. 새 action 이 생기면 여기에
  // 명시적으로 넣어야 입력 폼이 열린다 (`!== 'detach'` 는 조용히 opt-in 시킨다).
  const isInputAction = action === 'attach' || action === 'watcher';
  const hasEdgeSpace = isInputAction && value !== trimmed;
  const canSubmit = action === 'detach' || (trimmed !== '' && !hasEdgeSpace);

  const ACTION_LABEL: Record<JiraTicketAction, string> = {
    attach: '연결',
    detach: '연결 해제',
    watcher: 'Watcher 추가',
  };

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (action === 'detach') await detachJiraTicket(serviceCode, provider);
      else if (action === 'watcher') await addJiraTicketWatcher(serviceCode, provider, value);
      else await attachJiraTicket(serviceCode, provider, value, validate);
      if (action === 'watcher') {
        // 성공은 모달 안 상태전이로 보여준다 — 목록 갱신은 즉시, 닫기는 effect 가 잠깐 뒤에.
        setDone(true);
        onDone();
        return;
      }
      onDone();
      onClose();
    } catch (err) {
      // 실패해도 모달은 닫지 않는다 — 입력값을 그대로 두고 원인을 이 자리에서 보여준다.
      // (watchers 계약은 에러 코드 enum 이 없다 — 서버 message 를 그대로 싣는 게 전부다.)
      setError(
        userErrorText(err, `${ACTION_LABEL[action]}에 실패했습니다. 잠시 후 다시 시도해 주세요.`),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const label = providerLabel(provider);
  const ticketLabel = issueKey;

  return (
    <ModalShell open onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={titleStyle}>
        {action === 'detach'
          ? 'Jira Ticket 연결 해제'
          : action === 'watcher'
            ? 'Jira Watcher 추가'
            : issueKey
              ? 'Jira Ticket 변경'
              : 'Jira Ticket 연결'}
      </h3>

      {done ? (
        /* 성공 상태 — toast 대신 모달 안 상태전이. 1초 안에 스스로 닫힌다. */
        <div className="flex flex-col items-center gap-1.5 py-8" role="status">
          <span className="text-[var(--pl-primary)]">
            <Icon name="check-circle" size="xl" strokeWidth={2.2} />
          </span>
          <p className="mt-1 text-[16px] font-bold text-[var(--pl-text-strong)]">
            Watcher 등록 완료
          </p>
          <p className={pipelineStyles.text.meta}>
            <span className={cn(pipelineStyles.text.mono, emphasis)}>{value.trim()}</span> 님이 이
            티켓의 Jira 알림을 받습니다.
          </p>
        </div>
      ) : isInputAction ? (
        <>
          <p className={pipelineStyles.modal.desc}>
            {action === 'watcher' ? (
              <>
                <span className={emphasis}>{label}</span> 의 티켓{' '}
                <span className={cn(pipelineStyles.text.mono, emphasis)}>{ticketLabel}</span> 에
                watcher 를 추가합니다. 등록된 사용자는 이 티켓의 Jira 알림을 받습니다.
              </>
            ) : (
              <>
                {serviceCode} 서비스의 <span className={emphasis}>{label}</span> 에 이미 만들어져
                있는 Jira 티켓을 연결합니다. 티켓을 새로 만들지는 않습니다.
                {ticketLabel && (
                  <>
                    {' '}
                    현재 연결:{' '}
                    <span className={cn(pipelineStyles.text.mono, emphasis)}>{ticketLabel}</span>
                  </>
                )}
              </>
            )}
          </p>
          <label htmlFor={INPUT_ID} className={cn(pipelineStyles.text.subsectionTitle, 'block')}>
            {action === 'watcher' ? '사용자 ID' : 'Jira 티켓 키'}
          </label>
          {/* SearchBox 가 아니라 맨 input — 티켓 키는 입력하는 값이지 검색하는 값이 아니고,
              돋보기 아이콘은 자동완성이 붙어 있다고 읽힌다. */}
          <input
            id={INPUT_ID}
            type="text"
            className={opsStyles.credModal.search}
            // 입력하는 값은 티켓 키/사용자 ID 문자열이다 — 주소는 넣지 않는다.
            placeholder={action === 'watcher' ? '예: knox.id' : '예: BDCDIP-12312'}
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={hasEdgeSpace || undefined}
            aria-describedby={hasEdgeSpace ? EDGE_SPACE_ID : undefined}
          />
          {hasEdgeSpace && (
            <p id={EDGE_SPACE_ID} role="alert" className={warnStyle}>
              앞뒤에 공백이 있습니다. 공백을 지운 뒤 저장할 수 있습니다.
            </p>
          )}
          {/* JiraTicketAttachRequest.validate — 계약이 제공하는 옵션을 그대로 노출한다. */}
          {action === 'attach' && (
            <label className="mt-3 flex items-start gap-2 text-[14px] text-[var(--pl-text-medium)]">
              <input
                type="checkbox"
                checked={validate}
                onChange={(event) => setValidate(event.target.checked)}
                className="mt-0.5 accent-[var(--pl-primary)]"
              />
              <span>
                연결 전에 Jira 에서 티켓 존재를 확인
                <span className="block text-[12px] text-[var(--pl-text-weak)]">
                  끄면 존재 확인 없이 입력한 키를 그대로 연결합니다.
                </span>
              </span>
            </label>
          )}
        </>
      ) : (
        <>
          <p className={pipelineStyles.modal.desc}>
            {serviceCode} 서비스의 <span className={emphasis}>{label}</span> 와(과){' '}
            <span className={cn(pipelineStyles.text.mono, emphasis)}>{ticketLabel}</span> 의 연결을
            끊습니다.
          </p>
          <div className={noteStyle}>
            <span className="mt-0.5 flex-none text-[var(--pl-text-weak)]">
              <Icon name="info" size="sm" />
            </span>
            <span>
              <b className="font-semibold text-[var(--pl-text-strong)]">
                Jira 의 티켓은 삭제되지 않습니다.
              </b>{' '}
              이 화면의 연결 정보만 지워지며, 티켓과 그 이력은 Jira 에 그대로 남습니다. 같은 키를
              다시 연결하면 원래대로 돌아갑니다.
            </span>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className={cn(warnStyle, 'mt-3')}>
          {error}
        </p>
      )}

      {!done && (
        <div className={pipelineStyles.modal.foot}>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton
            variant={action === 'detach' ? 'danger' : 'primary'}
            onClick={() => void submit()}
            disabled={submitting || !canSubmit}
          >
            {submitting ? '처리 중…' : ACTION_LABEL[action]}
          </PlButton>
        </div>
      )}
    </ModalShell>
  );
}
