'use client';

/**
 * TC Pod 로그 뷰어 — Terraform Job 로그 뷰어(JobViewer)의 셸을 그대로 입는다:
 * ModalShell · 기본 720×572 · 우하단 드래그 그립 · 어두운 로그 패널. 본문만 다르다 —
 * ANSI 텍스트 대신 severity + content 구조화 리스트(StackDriver 캡처본).
 *
 * 캡처본이라 새로고침이 없다 — 헤더의 캡처 도장이 "이 시점의 전부"라고 말한다
 * (완료 시점 캡처: entries.list 쿼터 60/min 이 프로젝트 공유라 조회 시점 재조회를
 * 하지 않는다). severity 필터는 클라이언트 — 응답이 리스트로 한 번에 온다.
 *
 * severity 접기 — 9종을 4색으로: ERROR·CRITICAL·ALERT·EMERGENCY → 적색 /
 * WARNING → 호박색 / NOTICE·INFO → 중립 / DEBUG·DEFAULT → faint. 라벨 열은 없다 —
 * 색이 콘텐츠 줄 전체에 실리고(Terraform 로그의 ANSI 문법과 같은 방식), 위의 필터
 * 칩이 같은 색을 입어 범례를 겸한다(오너 2026-08-19). 같은 색을 나눠 쓰는 severity
 * (ERROR/CRITICAL 등)의 정확한 낱말은 행 hover title 로 남는다. 행 틴트는 금지.
 *
 * 행 문법은 StackDriver 그대로 — 글리프 · 시각 · 본문 (오너 2026-08-20). 바닥과 줄 색은
 * 위 그대로 두고 앞의 두 칸만 가져온 것이다: 로그를 읽는 사람은 "몇 시에 무엇이"를 왼쪽에서
 * 세로로 훑고, 그 뒤에야 문장을 읽는다. 시각은 밀리초까지(같은 초에 여러 줄이 찍힌다),
 * 날짜는 헤더의 캡처 도장이 이미 말하므로 줄에서 뺀다. 캡처본이 시각을 안 주면 그 칸은
 * 통째로 빠진다 — 자리만 잡고 '-' 를 세우지 않는다.
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
import { fmtDateTime, fmtTimeMs } from '@/lib/pipeline/format';
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

/** 한 줄 — 글리프·시각·본문이 한 줄에 서고, 가리키면 그 줄만 밝아진다(StackDriver 행). */
const LOG_ROW =
  'flex items-start gap-2 -mx-2 rounded-[4px] px-2 py-[3px] hover:bg-[var(--pl-gray-700)]';

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
  const visible: TcPodLogEntry[] = filter ? entries.filter((e) => e.severity === filter) : entries;

  const dark = phase === 'ok' && entries.length > 0;
  // 캡처본이 시각을 하나도 안 주면 시각 칸 자체를 세우지 않는다(빈 칸 = 없는 사실).
  const hasTime = entries.some((entry) => entry.timestamp);
  const copyText = visible
    .map((entry) =>
      [entry.timestamp ? fmtTimeMs(entry.timestamp) : null, entry.severity, entry.content]
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
        <div className={j.vEmptyTitle}>로그 캡처본이 없습니다</div>
        <div className={j.vEmptyDesc}>
          이 pod 의 로그가 저장되지 않았습니다. 최신 실행이 아니거나, 완료 시점 캡처가 아직
          없는 pod 입니다.
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
        <div className={j.vEmptyTitle}>캡처된 로그가 비어 있습니다</div>
        <div className={j.vEmptyDesc}>
          pod 는 종결됐지만 캡처본에 로그 줄이 없습니다. 캡처 시각과 실행 결과는 유효합니다.
        </div>
      </div>
    );
  } else {
    body = (
      <div className={j.logBody} tabIndex={0} role="region" aria-label="Pod 로그">
        <div className={cn(j.logPre, 'flex flex-col')}>
          {visible.map((entry, index) => (
            <div
              key={index}
              className={cn(LOG_ROW, SEVERITY_TONE[entry.severity] ?? j.logAnsi.gray)}
              title={entry.severity}
            >
              <SeverityGlyph severity={entry.severity} />
              {hasTime && (
                <span className="flex-none tabular-nums opacity-70">
                  {fmtTimeMs(entry.timestamp)}
                </span>
              )}
              <span className="min-w-0 flex-1">{entry.content}</span>
            </div>
          ))}
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
          {/* 캡처 도장 — 이 본문이 "언제의 전부"인지. 새로고침 버튼은 없다. */}
          {log?.capturedAt && <div className={j.vStamp}>{fmtDateTime(log.capturedAt)} 캡처</div>}
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
