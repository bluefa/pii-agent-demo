'use client';

/**
 * TC Pod 로그 뷰어 — Terraform Job 로그 뷰어(JobViewer)의 셸을 그대로 입는다:
 * ModalShell · 기본 720×572 · 우하단 드래그 그립 · 어두운 로그 패널. 본문만 다르다 —
 * ANSI 텍스트 대신 severity + content 구조화 리스트(`GET /install/v1/logs/{podId}`).
 *
 * 본문은 열 때 한 번 읽고 끝난다 — 새로고침 버튼이 없다. severity 필터는 클라이언트 —
 * 응답이 리스트로 한 번에 온다.
 *
 * severity 접기 — 9종을 4색으로: ERROR·CRITICAL·ALERT·EMERGENCY → 적색 /
 * WARNING → 호박색 / NOTICE·INFO → 중립 / DEBUG·DEFAULT → faint. 라벨 열은 없다 —
 * 색이 콘텐츠 줄 전체에 실리고(Terraform 로그의 ANSI 문법과 같은 방식), 위의 필터
 * 칩이 같은 색을 입어 범례를 겸한다(오너 2026-08-19). 같은 색을 나눠 쓰는 severity
 * (ERROR/CRITICAL 등)의 정확한 낱말은 행 hover title 로 남는다. 행 틴트는 금지.
 *
 * 행 문법은 StackDriver 그대로 — 화살표 · 글리프 · 시각 · 본문이 한 줄에 선다. 로그를
 * 읽는 사람은 "몇 시에 무엇이"를 왼쪽에서 세로로 훑고, 그 뒤에야 문장을 읽는다.
 *
 * 시각은 **날짜까지** 줄에 싣는다 (오너 2026-08-26). 종전에는 "한 pod 은 몇 분 안에
 * 끝난다"를 근거로 날짜를 뺐지만, Cloud Logging 의 행은 언제나 날짜를 달고 있고 — 복사해
 * 붙인 한 줄이 어느 날 것인지 그 줄 혼자 말할 수 있어야 한다. 밀리초는 그대로 둔다:
 * 한 pod 의 줄들은 같은 초 안에 여러 개 찍히고, 초에서 자르면 순서가 시각으로 설명되지
 * 않는다. 응답이 시각을 하나도 안 주면 그 칸은 통째로 빠진다 — 자리만 잡고 '-' 를 세우지
 * 않는다.
 *
 * 행마다 흰 stroke (오너 2026-08-26). 종전에는 행의 경계가 hover 때만 나타나서, 여러 줄
 * 트레이스를 펴 놓으면 어디서 한 행이 끝나고 다음 행이 시작하는지 바닥 색만으로는 읽히지
 * 않았다. 이제 어두운 패널 위에 흰색 20% 윤곽이 상시로 각 행을 감싼다 — 칠이 아니라 선이라
 * severity 색(줄 전체가 입는다)을 흐리지 않는다.
 *
 * 한 줄은 한 행 — 접힘이 기본 (오너 2026-08-25). 종전에는 본문이 그대로 감겨서, 스택
 * 트레이스 한 건이 화면을 통째로 먹고 그 아래 줄들이 지면 밖으로 밀렸다. 이제 접힌 행은
 * 무슨 일이 있어도 정확히 한 줄(`truncate`)이라 "몇 건이 어떤 순서로 찍혔나"가 먼저 읽히고,
 * 필요한 줄만 눌러서 편다 — StackDriver 가 행 앞 화살표로 상세를 여는 것과 같은 문법이다.
 * ⚠️ 펴기가 더하는 사실은 이제 **본문 전문 하나뿐**이다 — 종전의 `severity · 날짜 시각`
 * 꼬리표는 오너가 걷어냈고(2026-08-26), 시각은 접힌 줄이 이미 날짜까지 싣는다. 그래서
 * 안 잘리는 짧은 줄에서는 펴도 화살표 회전 말고는 픽셀이 안 바뀐다 — Cloud Logging 도
 * 모든 행에 같은 화살표를 세우므로 그 균일한 왼쪽 홈통을 따랐다. severity 원문 낱말은
 * 색을 나눠 쓰는 ERROR/CRITICAL 을 가르기 위해 행 hover title 로 남는다.
 */
import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import { cn } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { fmtDate, fmtTimeMs } from '@/lib/pipeline/format';
import { j } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import {
  resizeFromDrag,
  type ViewerSize,
} from '@/app/admin/pipelines/_detail/JobViewer';
import {
  getTestConnectionPodLog,
  type TcPodLog,
  type TcPodLogEntry,
} from '@/app/lib/api/task-queue-tc';

const DEFAULT_SIZE: ViewerSize = { w: j.viewerBaseSize.width, h: j.viewerBaseSize.height };

/** StackDriver LogSeverity → 라벨 글자 색 (4색 접기). 목록 밖의 값은 중립. */
const SEVERITY_TONE: Readonly<Record<string, string>> = {
  EMERGENCY: j.logAnsi.red,
  ALERT: j.logAnsi.red,
  CRITICAL: j.logAnsi.red,
  ERROR: j.logAnsi.red,
  WARNING: j.logAnsi.yellow,
  NOTICE: 'text-[var(--pl-chrome-item)]', // design-exempt: line on the dark log panel
  INFO: 'text-[var(--pl-chrome-item)]', // design-exempt: line on the dark log panel
  DEBUG: j.logAnsi.gray,
  DEFAULT: j.logAnsi.gray,
};

/**
 * 행 맨 앞 글리프 — 4색 접기와 같은 갈래. 색은 줄이 이미 입고 있으므로 여기서는 모양만
 * 고른다(글리프는 currentColor). DEBUG·DEFAULT 는 아이콘 없이 점 — Cloud Logging 도
 * 기본 severity 에는 표식을 세우지 않는다.
 */
const SEVERITY_GLYPH: Readonly<Record<string, IconName>> = {
  EMERGENCY: 'x-circle',
  ALERT: 'x-circle',
  CRITICAL: 'x-circle',
  ERROR: 'x-circle',
  WARNING: 'warn-tri',
  NOTICE: 'info',
  INFO: 'info',
};

/**
 * 한 줄 — 화살표·글리프·시각·본문이 한 줄에 서고, 흰 stroke 가 그 줄을 감싼다(StackDriver
 * 행). 행 전체가 디스클로저 머리다: 가리키면 밝아지고 누르면 펴진다. group 은 이름을 달아
 * 둔다 — 맨몸 group 은 바깥 group 의 hover 까지 받는다.
 *
 * 윤곽은 `border` 가 아니라 `ring` 이다 — border 는 border-box 안에서 본문을 1px 씩 밀어
 * 시각 칸과 본문의 세로줄을 흐트러뜨린다(ring 은 레이아웃 밖에 그려진다).
 *
 * 포커스 표식은 이 행이 따로 그리지 않는다 — 전역 `*:focus-visible` 아웃라인
 * (globals.css)이 이미 모든 초점 대상에 같은 표식을 세우고, 그 규칙은 cascade layer
 * 밖이라 Tailwind 의 `outline-none` 으로는 못 끈다(.ec2-search-field 주석 참조). 행마다
 * 링을 하나 더 얹으면 굵기가 다른 고리 두 개가 겹친다.
 */
const LOG_ROW =
  'group/logrow flex cursor-pointer items-start gap-2 rounded-[4px] px-2 py-1 ring-1 ring-inset ring-white/20 hover:bg-[var(--pl-gray-700)] hover:ring-white/40';

/** 필터 칩의 정렬 순서 — 심한 쪽 먼저. 0건 severity 칩은 그리지 않는다. */
const SEVERITY_ORDER: readonly string[] = [
  'EMERGENCY',
  'ALERT',
  'CRITICAL',
  'ERROR',
  'WARNING',
  'NOTICE',
  'INFO',
  'DEBUG',
  'DEFAULT',
];

/**
 * 행의 시각 칸 — `YYYY-MM-DD HH:mm:ss.SSS`. 시각 칸이 서는 건 캡처본에 시각이 하나라도
 * 있을 때뿐이고, 그 안에서 시각이 빠진 낱줄만 '-' 를 받는다.
 */
const stamp = (iso: string | null | undefined): string =>
  iso ? `${fmtDate(iso)} ${fmtTimeMs(iso)}` : '-';

type Phase = 'loading' | 'ok' | 'notfound' | 'error';

export interface TcPodLogModalProps {
  targetSourceId: number;
  podId: string;
  /** 이 pod 가 검사한 리소스 — 헤더 부제. */
  resourceLabel: string;
  onClose: () => void;
}

export function TcPodLogModal({
  targetSourceId,
  podId,
  resourceLabel,
  onClose,
}: TcPodLogModalProps): ReactElement {
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [phase, setPhase] = useState<Phase>('loading');
  const [log, setLog] = useState<TcPodLog | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  // 펴진 행 — 키는 필터 전 원본 인덱스다. 필터를 바꿔도 같은 줄이 같은 상태로 남는다.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  // Tab 이 멈추는 행 하나(roving tabindex). 같은 키.
  const [rovingRow, setRovingRow] = useState(0);

  // 모달은 pod 하나당 한 번 마운트된다(닫아야 다른 pod 를 연다) — 초기 상태가 곧
  // loading 이라 effect 안에서 동기 setState 로 되돌릴 일이 없다.
  useEffect(() => {
    let alive = true;
    getTestConnectionPodLog(targetSourceId, podId)
      .then((data) => {
        if (!alive) return;
        setLog(data);
        setPhase('ok');
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setPhase(error instanceof AppError && error.status === 404 ? 'notfound' : 'error');
      });
    return () => {
      alive = false;
    };
  }, [targetSourceId, podId]);

  // Drag-resize from the corner grip — JobViewer 와 같은 이유로 리스너는 window 에.
  const startResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const from = { x: event.clientX, y: event.clientY, ...size };
    const onMove = (move: PointerEvent): void => {
      setSize(
        resizeFromDrag(
          from,
          move.clientX - from.x,
          move.clientY - from.y,
          window.innerWidth,
          window.innerHeight,
        ),
      );
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const entries = log?.entries ?? [];
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.severity, (counts.get(entry.severity) ?? 0) + 1);
  // 응답에만 있는 미지의 severity 도 칩을 받는다 — 목록 순서 뒤에 원문 그대로.
  const chipKeys = [
    ...SEVERITY_ORDER.filter((key) => (counts.get(key) ?? 0) > 0),
    ...[...counts.keys()].filter((key) => !SEVERITY_ORDER.includes(key)),
  ];
  const rows: { entry: TcPodLogEntry; index: number }[] = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !filter || entry.severity === filter);
  const visible: TcPodLogEntry[] = rows.map((row) => row.entry);

  const toggleRow = (index: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  };

  /**
   * Tab 은 목록 전체에서 한 번만 멈춘다 — 행 위아래는 방향키로 옮긴다(roving tabindex).
   * 행마다 `tabIndex={0}` 을 주면 300줄짜리 캡처본이 ModalShell 의 포커스 트랩 안에
   * 300개의 정거장을 만들고, 트랩은 Tab 마다 후보를 다시 훑으므로 그 비용이 O(N) 로
   * 붙는다. 필터가 그 행을 걷어냈으면 보이는 첫 행이 대신 선다 — 정거장이 0개가 되면
   * 로그가 키보드에서 아예 사라진다.
   */
  const rovingIndex = rows.some((row) => row.index === rovingRow) ? rovingRow : rows[0]?.index;

  const moveFocus = (from: EventTarget & HTMLElement, delta: number): boolean => {
    const sibling = delta < 0 ? from.previousElementSibling : from.nextElementSibling;
    if (!(sibling instanceof HTMLElement) || sibling.getAttribute('role') !== 'button') return false;
    sibling.focus();
    return true;
  };

  const dark = phase === 'ok' && entries.length > 0;
  // 캡처본이 시각을 하나도 안 주면 시각 칸 자체를 세우지 않는다(빈 칸 = 없는 사실).
  const hasTime = entries.some((entry) => entry.timestamp);
  const copyText = visible
    .map((entry) =>
      [entry.timestamp ? stamp(entry.timestamp) : null, entry.severity, entry.content]
        .filter(Boolean)
        .join('\t'),
    )
    .join('\n');

  let body: ReactElement;
  if (phase === 'loading') {
    body = <div className={j.vLoading}>로그를 불러오는 중…</div>;
  } else if (phase === 'notfound') {
    body = (
      <div className={j.vEmpty}>
        <Icon name="warn-tri" size="lg" className={j.vEmptyIcon} />
        <div className={j.vEmptyTitle}>로그가 없습니다</div>
        <div className={j.vEmptyDesc}>
          이 pod 의 로그를 찾지 못했습니다. 최신 실행이 아니거나, 아직 종결되지 않은 pod
          입니다.
        </div>
      </div>
    );
  } else if (phase === 'error') {
    body = (
      <div className={j.vEmpty}>
        <Icon name="warn-tri" size="lg" className={j.vEmptyIcon} />
        <div className={j.vEmptyTitle}>로그를 불러오지 못했습니다</div>
        <div className={j.vEmptyDesc}>잠시 후 다시 시도해 주세요.</div>
      </div>
    );
  } else if (entries.length === 0) {
    body = (
      <div className={j.vEmpty}>
        <Icon name="warn-tri" size="lg" className={j.vEmptyIcon} />
        <div className={j.vEmptyTitle}>로그가 비어 있습니다</div>
        <div className={j.vEmptyDesc}>
          pod 는 종결됐지만 남은 로그 줄이 없습니다. 실행 결과는 유효합니다.
        </div>
      </div>
    );
  } else {
    body = (
      <div className={j.logBody} tabIndex={0} role="region" aria-label="Pod 로그">
        {/* pt — 전역 포커스 아웃라인은 행 박스 **바깥**으로 2px 떨어져 2px 두께로 그려진다.
            `j.logBody` 는 padding-top 이 0 이라 첫 행이 스크롤 경계에 붙고, 그 4px 이
            잘린다. 여기서만 위를 띄운다(공유 셸은 건드리지 않는다). */}
        <div className={cn(j.logPre, 'flex flex-col gap-1 pt-1.5')}>
          {rows.map(({ entry, index }) => {
            const open = expanded.has(index);
            return (
              <div
                key={index}
                role="button"
                tabIndex={index === rovingIndex ? 0 : -1}
                aria-expanded={open}
                onFocus={() => setRovingRow(index)}
                onClick={() => {
                  // 드래그로 본문을 긁는 중이면 그 손짓은 선택이지 펴기가 아니다. 키보드
                  // 활성화는 이 문을 지나지 않는다 — 긁어 둔 선택이 살아 있다고 해서
                  // Enter 가 먹히지 않으면, 아무 말 없이 안 열린다.
                  if (window.getSelection()?.isCollapsed === false) return;
                  toggleRow(index);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    // 목록 끝에서는 키를 삼키지 않는다 — 마지막 행이 펴져 있으면 그 아래로
                    // 더 스크롤할 지면이 남아 있고, 방향키가 유일한 손잡이다.
                    if (moveFocus(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1)) {
                      event.preventDefault();
                    }
                    return;
                  }
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  // 누르고 있는 Space 의 auto-repeat 로 행이 깜빡이지 않게 — 진짜 버튼도
                  // 한 번만 활성화된다.
                  if (event.repeat) return;
                  toggleRow(index);
                }}
                className={cn(LOG_ROW, SEVERITY_TONE[entry.severity] ?? j.logAnsi.gray)}
                title={entry.severity}
              >
                <Icon
                  name="chev-r"
                  size={12}
                  className={cn(
                    'mt-[4px] flex-none transition-transform group-hover/logrow:opacity-100',
                    open ? 'rotate-90 opacity-100' : 'opacity-40',
                  )}
                />
                <SeverityGlyph severity={entry.severity} />
                {hasTime && (
                  <span className="flex-none tabular-nums opacity-70">{stamp(entry.timestamp)}</span>
                )}
                <div
                  className={cn(
                    'min-w-0 flex-1',
                    open ? 'whitespace-pre-wrap break-all' : 'truncate',
                  )}
                >
                  {entry.content}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <span className={j.logAnsi.gray}>이 severity 의 로그가 없습니다.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy="tc-pod-log-title"
      className={j.viewer}
      style={{ width: size.w, height: size.h }}
    >
      <div className={j.vHead}>
        <div className="min-w-0">
          <div className={j.vTitle} id="tc-pod-log-title">
            Pod 로그
            <span className={cn(j.vJid, '[font-family:var(--pl-font-mono)] text-[14px] font-medium text-[var(--pl-text-medium)]')}>
              {podId}
            </span>
          </div>
          <div className={j.vSub}>{resourceLabel}</div>
        </div>
        <button type="button" className={j.vClose} onClick={onClose} aria-label="닫기" title="닫기 (Esc)">
          <Icon name="x" size="lg" />
        </button>
      </div>

      <div className={cn(j.panel, dark && j.panelDark)}>
        <div className={j.strip}>
          {/* severity 범례 겸 필터 — 칩이 본문 줄과 같은 색을 입어 "이 색 = 이 severity"
              를 말하고, 누르면 재조회 없이 거른다. 0건 칩은 없다. */}
          {dark && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="severity 범례·필터">
              <SeverityChip
                label={`전체 ${entries.length}`}
                active={filter === null}
                onClick={() => setFilter(null)}
              />
              {chipKeys.map((key) => (
                <SeverityChip
                  key={key}
                  label={`${key} ${counts.get(key) ?? 0}`}
                  tone={SEVERITY_TONE[key] ?? j.logAnsi.gray}
                  active={filter === key}
                  onClick={() => setFilter(filter === key ? null : key)}
                />
              ))}
            </div>
          )}
          <span className={j.toolbarGrow} />
          <PlButton
            variant={dark ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => void navigator.clipboard?.writeText(copyText)}
            disabled={!copyText}
          >
            복사
          </PlButton>
        </div>
        {body}
      </div>

      <div
        className={cn(j.grip, dark ? j.gripTone.dark : j.gripTone.light)}
        onPointerDown={startResize}
        onDoubleClick={() => setSize(DEFAULT_SIZE)}
        title="드래그해서 크기 조절 (더블클릭: 기본 크기)"
        aria-hidden
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden>
          <path d="M14 6 6 14M14 11l-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </ModalShell>
  );
}

/**
 * severity 글리프 — 아이콘은 severity 갈래를, 색은 줄에서 물려받는다. 목록 밖(DEBUG·
 * DEFAULT·미지)은 점 하나로, 자리는 지키되 눈을 끌지 않는다.
 */
function SeverityGlyph({ severity }: { severity: string }): ReactElement {
  const name = SEVERITY_GLYPH[severity];
  if (!name) {
    return (
      <span
        className="mt-[7px] h-[3px] w-[3px] flex-none rounded-full bg-current opacity-70"
        aria-hidden
      />
    );
  }
  return <Icon name={name} size={14} className="mt-[2px] flex-none" />;
}

/**
 * 어두운 패널 위의 필터 칩 — 12px, 활성은 밝은 면, 비활성은 윤곽선만. `tone` 이 있으면
 * 칩 글자가 본문 줄과 같은 severity 색을 입는다 — 범례가 따로 필요 없도록. 전체 칩은
 * tone 없이 중립.
 */
function SeverityChip({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone?: string;
  active: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium tabular-nums transition-colors',
        active
          ? 'bg-[var(--pl-gray-600)]' // design-exempt: chip on the dark log panel
          : 'border border-[var(--pl-gray-600)] opacity-80 hover:opacity-100', // design-exempt: chip on the dark log panel
        tone ?? 'text-[var(--pl-chrome-item)]', // design-exempt: chip on the dark log panel
      )}
    >
      {label}
    </button>
  );
}
