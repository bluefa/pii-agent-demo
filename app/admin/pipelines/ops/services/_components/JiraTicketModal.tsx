'use client';

/**
 * Jira Ticket 연결 관리 modal — CloudProvider 가 키다. 타일의 ⋮ 가 여는 유일한 창구라
 * 메뉴(할 수 있는 일 목록) → 실행(입력/확인) 두 단계를 한 다이얼로그 안에서 처리한다.
 * 드롭다운 대신 모달인 이유: 연결/해제는 "Jira 티켓을 지우는 게 아니다"라는 설명이
 * 함께 읽혀야 하는 동작이고, 그 문구는 팝오버에 들어갈 분량이 아니다.
 *
 * 두 동작 모두 "서비스 ↔ 티켓 매핑"만 바꾸고 Jira 의 티켓 자체는 건드리지 않는다
 * (docs/api/jira-tickets.md §1). 해제가 되돌릴 수 있는 작업이라는 사실이 문구와
 * 버튼 톤 양쪽에 드러나야 한다 — EOS 처럼 dangerSolid 로 겁주지 않는다.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { providerLabel } from '@/lib/pipeline/format';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { jiraTicketLink } from '@/app/admin/pipelines/ops/services/_components/jiraLink';
import {
  attachJiraTicket,
  detachJiraTicket,
  type JiraCloudProvider,
} from '@/app/lib/api/ops';

const TITLE_ID = 'ops-jira-ticket-title';
const INPUT_ID = 'ops-jira-issue-key';

/** 메뉴 → 실행. 뒤로 가면 메뉴로 돌아온다. */
type View = 'menu' | 'attach' | 'detach';

const menuStyles = {
  state:
    'flex items-center justify-between gap-3 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-3.5 py-3',
  list: 'mt-3 flex flex-col',
  /** 메뉴 행 — 카드가 아니라 목록. 구분선 하나로 나누고 hover 만 칠한다. */
  row: 'flex w-full items-center gap-3 border-t border-[var(--pl-gray-100)] px-2 py-3 text-left cursor-pointer hover:bg-[var(--pl-gray-50)] first:border-t-0',
  rowIcon: 'flex-none text-[var(--pl-text-weak)]',
  rowIconDanger: 'flex-none text-[var(--pl-err-text)]',
  label: 'block text-[14px] font-semibold text-[var(--pl-text-strong)]',
  labelDanger: 'block text-[14px] font-semibold text-[var(--pl-err-text)]',
  desc: 'mt-0.5 block text-[12px] leading-[1.4] text-[var(--pl-text-weak)]',
  chev: 'flex-none text-[var(--pl-text-faint)]',
  /** 되돌릴 수 있다는 사실이 핵심 — 경고(err)가 아니라 정보(info) 톤. */
  note:
    'flex items-start gap-2 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-3.5 py-3 text-[14px] leading-[1.6] text-[var(--pl-text-medium)]',
} as const;

export interface JiraTicketModalProps {
  onClose: () => void;
  serviceCode: string;
  provider: JiraCloudProvider;
  /** 연결된 티켓 키 — 있으면 변경·해제 메뉴, 없으면 연결만. */
  issueKey: string | null;
  /** 성공 — 티켓 목록을 다시 읽는다. */
  onDone: () => void;
}

export function JiraTicketModal({
  onClose,
  serviceCode,
  provider,
  issueKey,
  onDone,
}: JiraTicketModalProps): ReactElement {
  const [view, setView] = useState<View>('menu');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setView('menu');
    setValue('');
    setError(null);
  }, [provider, issueKey]);

  const submit = async (): Promise<void> => {
    const trimmed = value.trim();
    if (view === 'attach' && !trimmed) {
      setError('Jira 티켓 키를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (view === 'detach') await detachJiraTicket(serviceCode, provider);
      else await attachJiraTicket(serviceCode, provider, trimmed);
      onDone();
      onClose();
    } catch (err) {
      setError(
        err instanceof AppError && err.isUserFacing
          ? err.message
          : `${view === 'detach' ? '연결 해제' : '연결'}에 실패했습니다. 잠시 후 다시 시도해 주세요.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goto = (next: View): void => {
    setValue(next === 'attach' ? (issueKey ?? '') : '');
    setError(null);
    setView(next);
  };

  const title =
    view === 'menu'
      ? `Jira Ticket 연결 관리: ${providerLabel(provider)}`
      : view === 'detach'
        ? `Jira Ticket 연결 해제: ${providerLabel(provider)}`
        : `${issueKey ? '티켓 키 변경' : '티켓 연결'}: ${providerLabel(provider)}`;

  return (
    <ModalShell open onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        {title}
      </h3>

      {view === 'menu' && (
        <>
          <p className={pipelineStyles.modal.desc}>
            {serviceCode} · {providerLabel(provider)} 에 연결된 Jira 티켓입니다. 아래 동작은 모두 이
            화면의 연결 정보만 바꿉니다.
          </p>
          <div className={menuStyles.state}>
            <ProvTag provider={provider} />
            {issueKey ? (
              // 값이 티켓 주소로 오면 그대로 찍을 수 없다(모달 폭을 넘긴다) — 타일과 같은
              // 표시값(티켓 키)으로 줄인다. 입력창에는 원본을 그대로 둔다.
              <span className={cn(pipelineStyles.text.mono, 'font-semibold text-[14px]')}>
                {jiraTicketLink(issueKey).label}
              </span>
            ) : (
              <span className="text-[14px] text-[var(--pl-text-weak)]">연결된 티켓 없음</span>
            )}
          </div>
          <div className={menuStyles.list}>
            <MenuRow
              icon="link"
              label={issueKey ? '티켓 키 변경' : '티켓 연결'}
              desc={
                issueKey
                  ? '다른 티켓 키로 바꿔 연결합니다. 이전 티켓은 Jira 에 그대로 남습니다.'
                  : '이미 만들어져 있는 Jira 티켓의 키를 이 provider 에 매핑합니다.'
              }
              onClick={() => goto('attach')}
            />
            {issueKey && (
              <MenuRow
                icon="ban"
                danger
                label="연결 해제"
                desc="이 화면의 연결만 끊습니다. Jira 의 티켓은 삭제되지 않습니다."
                onClick={() => goto('detach')}
              />
            )}
          </div>
          <div className={pipelineStyles.modal.foot}>
            <PlButton variant="secondary" onClick={onClose}>
              닫기
            </PlButton>
          </div>
        </>
      )}

      {view === 'attach' && (
        <>
          <p className={pipelineStyles.modal.desc}>
            이미 만들어져 있는 Jira 티켓을 {serviceCode} · {providerLabel(provider)} 에 연결합니다.
            티켓을 새로 만들지는 않습니다.
          </p>
          <label htmlFor={INPUT_ID} className={cn(pipelineStyles.text.subsectionTitle, 'block')}>
            Jira 티켓 키
          </label>
          {/* SearchBox 가 아니라 맨 input — 티켓 키는 입력하는 값이지 검색하는 값이 아니고,
              돋보기 아이콘은 자동완성이 붙어 있다고 읽힌다. */}
          <input
            id={INPUT_ID}
            type="text"
            className={opsStyles.credModal.search}
            // 입력하는 값은 티켓 키 문자열이다 — 주소는 넣지 않는다(조회 응답에만 실린다).
            placeholder="예: BDCDIP-12312"
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </>
      )}

      {view === 'detach' && (
        <>
          <p className={pipelineStyles.modal.desc}>
            <span className={pipelineStyles.text.mono}>
              {issueKey ? jiraTicketLink(issueKey).label : ''}
            </span>{' '}
            와(과) {serviceCode} · {providerLabel(provider)} 의 연결을 끊습니다.
          </p>
          <div className={menuStyles.note}>
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
        <p role="alert" className="mt-3 text-[12px] font-medium text-[var(--pl-err-text)]">
          {error}
        </p>
      )}

      {view !== 'menu' && (
        <div className={pipelineStyles.modal.foot}>
          <PlButton variant="secondary" onClick={() => goto('menu')} disabled={submitting}>
            뒤로
          </PlButton>
          <PlButton
            variant={view === 'detach' ? 'danger' : 'primary'}
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? '처리 중…' : view === 'detach' ? '연결 해제' : '연결'}
          </PlButton>
        </div>
      )}
    </ModalShell>
  );
}

function MenuRow({
  icon,
  label,
  desc,
  danger,
  onClick,
}: {
  icon: IconName;
  label: string;
  desc: string;
  danger?: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <button type="button" className={menuStyles.row} onClick={onClick}>
      <span className={danger ? menuStyles.rowIconDanger : menuStyles.rowIcon}>
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={danger ? menuStyles.labelDanger : menuStyles.label}>{label}</span>
        <span className={menuStyles.desc}>{desc}</span>
      </span>
      <span className={menuStyles.chev}>
        <Icon name="chev-r" size="sm" />
      </span>
    </button>
  );
}
