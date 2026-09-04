'use client';

/**
 * 확정 정보 입력기 v2.4 — JSON 초안을 쓰고 서버로 보내는 모달. **편집기는 입력만 한다.**
 *
 * 수정도 삭제도 여기 없다. 오너 지시(2026-09-03 ①): 등록이 있는 동안 이 문은 잠긴다
 * (`ConfirmPane` 의 `blocked={!empty}`) — 고쳐 쓰는 길이 없으므로 이 컴포넌트는 `current`
 * 를 받지 않는다. 지우는 것은 별도 문의 별도 모달(`ConfirmDeleteModal`)이다.
 *
 * **왜 편집 표면이 JSON 인가.** 계약이 요청 본문을 `type: object` 로만 선언한다 — 속성이
 * 하나도 없다(swagger `create{Csp}ConfirmedResource`). 필드 폼을 그리려면 계약에 없는
 * 스키마를 발명해야 하고, 화면이 검사하는 것은 **JSON 으로 파싱되는가** 하나뿐이다.
 *
 * **구성은 한 상자, 두 프레임이다** — `ModalShell variant="editor"` 하나 위에서 상태만
 * 바뀐다. 그 위에 겹치는 것은 나갈 때의 확인창 하나뿐이다(오너 지시 2026-09-04):
 * 저장하지 않은 초안을 들고 나가려 하면 `ConfirmStepModal` 이 되묻는다.
 *
 * ① 입력 프레임 — 머리(제목만) / 다크 편집기 상자(툴바 + textarea·gutter + 상태줄) /
 * 바닥(NLB 스위치 + 취소·입력). 실행 중에는 머리 아래 진행 바 + 편집기 흐림 + 텍스트영역
 * readOnly 로 같은 프레임이 "실행 중"을 말한다 — 별도 로딩 화면이 아니다.
 *
 * ② 결과 프레임 — mutation 이 settle 되면 같은 상자의 내용이 통째로 바뀐다(높이는
 * auto — `!h-auto` 로 입력 프레임의 고정 760 을 되돌린다). 성공은 종점(닫기만),
 * 실패는 [닫기]/[편집으로 돌아가기] 둘이다 — 돌아가면 초안·NLB·마지막 실패 요약이
 * 그대로 남는다. **201 응답 본문은 opaque**(계약이 `type: object` 로만 선언)이므로
 * "등록된 리소스" 목록은 응답이 아니라 **보낸 초안**의 `resource_infos` 로 그린다.
 *
 * 진입 콜은 0이다 — 열기만 해서는 아무것도 조회하지 않는다(오너 지시 2026-09-04).
 * 입력 전에 이 화면이 보내는 요청은 「추천값 불러오기」가 부르는 그 한 번뿐이다.
 */
import { useMemo, useRef, useState, type ReactElement } from 'react';
import { cn, confirmEditorProgressBar } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { DownloadIcon, ReloadIcon } from '@/app/components/ui/icons';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import {
  createConfirmedResources,
  getApprovedRecommendations,
  type ConfirmedResourceProvider,
} from '@/app/lib/api';

/** 서버가 준 말이 있으면 그것을, 없으면 한 줄 폴백 — 원인을 지어내지 않는다. */
const message = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : '알 수 없는 오류가 발생했습니다.';

/** 열릴 때의 뼈대 — 조회 응답의 모양만 빌린다. dirty 판정의 기준이기도 하다. */
const BLANK = `{\n  "resource_infos": []\n}`;

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

/**
 * 계약이 모양을 말하지 않으므로 세어지는 경우에만 센다 — 못 세면 건수 없이 보여 준다.
 *
 * 두 키를 다 본다. **이 숫자가 0건 저장 게이트의 입력**이고, 목이 받는 키가
 * `resource_infos` 와 `resources` 둘이라(lib/bff/mock/confirm.ts) 한 키만 세면 다른 키로
 * 쓴 빈 배열이 게이트를 그냥 통과한다.
 */
export const countOf = (doc: unknown): number | null => {
  if (typeof doc !== 'object' || doc === null) return null;
  const infos: unknown =
    'resource_infos' in doc ? doc.resource_infos
      : 'resources' in doc ? doc.resources
        : undefined;
  return Array.isArray(infos) ? infos.length : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stringField = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' && value ? value : null;
};

/** 「등록된/보낸 리소스」 목록의 한 줄 — **보낸 초안**에서 읽는다(응답 본문이 아니다). */
interface DraftRow {
  key: string;
  name: string;
  type: string | null;
  id: string | null;
}

const draftRowsOf = (doc: unknown): DraftRow[] => {
  if (!isRecord(doc)) return [];
  const infos: unknown = 'resource_infos' in doc ? doc.resource_infos
    : 'resources' in doc ? doc.resources
      : undefined;
  if (!Array.isArray(infos)) return [];
  return infos.map((item, index) => {
    const record = isRecord(item) ? item : {};
    const id = stringField(record, 'resource_id');
    return {
      key: id ?? `row-${index}`,
      name: stringField(record, 'resource_name') ?? '—',
      type: stringField(record, 'database_type') ?? stringField(record, 'resource_type'),
      id,
    };
  });
};

/**
 * 추천값이 **없는 것**인가(부재) 아니면 **못 본 것**인가(실패). 판정은 **status 로** 한다.
 * `code === 'NOT_FOUND'` 로 보면 목에서만 맞는다 — 목이 보내는 `TARGET_SOURCE_NOT_FOUND`
 * 는 `KNOWN_ERROR_CODES` 에 없어서 `statusToCode(404)` 인 `NOT_FOUND` 로 떨어지지만
 * (lib/fetch-json.ts), 업스트림이 허용 목록에 **있는** `CONFIRMED_INTEGRATION_NOT_FOUND`
 * 를 보내면 그 코드가 보존돼 판정이 뒤집힌다. 계약이 부재라고 말하는 것은 404 이고,
 * 코드 문자열은 우리 카탈로그의 사정이다.
 */
export const isRecommendationAbsent = (error: unknown): boolean =>
  error instanceof AppError && error.status === 404;

type RecommendationLoad =
  /** 아직 물어보지 않았다 — 모달이 열린 직후의 자리. */
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; text: string }
  /** 추천할 것이 없다(404). 오류가 아니라 부재다. */
  | { state: 'absent' }
  /** 못 봤다 — 관측한 status 를 들고 있는다. `0` 은 응답이 오지 않았다는 뜻이다. */
  | { state: 'failed'; code: number };

/** 계약이 선언한 reason phrase — 성공(201)과 실패 태그가 함께 쓴다. 계약에 없는 코드에는
 *  아무 말도 붙이지 않는다. */
const REASON_PHRASES: readonly (readonly [number, string])[] = [
  [201, 'Created'],
  [400, 'Bad Request'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [409, 'Conflict'],
  [500, 'Internal Server Error'],
  [501, 'Not Implemented'],
  [502, 'Bad Gateway'],
  [503, 'Service Unavailable'],
];

const phraseOf = (code: number): string | null =>
  REASON_PHRASES.find(([declared]) => declared === code)?.[1] ?? null;

/** 한 번의 실행과 그 응답. */
interface Exchange {
  code: number;
  ok: boolean;
  /** 응답 본문(성공) 또는 ProblemDetails(실패) — pretty JSON 원문. */
  body: string;
  /** **클라이언트가 관측한** 왕복 시간 — 서버 처리 시간이 아니다(BFF 2-hop). */
  ms: number;
  /** **보낸** 초안. 201 본문은 opaque 라 「등록된 리소스」는 이것에서 읽는다. */
  sent: unknown;
}

/**
 * 실패 응답의 본문 — `fetchJson` 이 ProblemDetails 를 `AppError` 로 접으면서 원문을 버리므로,
 * 그 때 읽어 간 필드를 같은 이름으로 되편다(lib/fetch-json.ts `parseErrorResponse`).
 */
const errorExchange = (ms: number, sent: unknown, error: unknown): Exchange =>
  error instanceof AppError
    ? {
        ms,
        sent,
        code: error.status,
        ok: false,
        body: pretty({
          code: error.code,
          detail: error.message,
          retriable: error.retriable,
          requestId: error.requestId,
          timestamp: error.timestamp,
        }),
      }
    : { ms, sent, code: 0, ok: false, body: pretty({ detail: message(error) }) };

const MONO = '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';
/** 목록은 최대 열 줄이다 — 그 아래는 건수 한 줄(ConfirmDeleteModal 과 같은 상한). */
const MAX_ROWS = 10;
/** 이유 한 줄(부재·실패)의 id — 버튼이 `aria-describedby` 로 가리킨다. */
const RECOMMEND_REASON_ID = 'confirm-editor-recommend-reason';

const styles = {
  head: 'flex-none px-6 pb-4 pt-5',
  title: 'text-[20px] font-bold tracking-[-0.02em] text-[var(--pl-text-strong)]',

  progressTrack: 'mx-6 h-[2px] flex-none overflow-hidden rounded-full bg-[var(--pl-gray-100)]',
  progressBar: 'h-full w-[30%] bg-[var(--pl-primary)]',

  /** 다크 편집기 상자 — margin 0 24 24, 이 콘솔에서 유일한 다크 면. */
  box: cn(
    'mx-6 mb-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border',
    'border-[var(--pl-editor-line)] bg-[var(--pl-editor-bg)]',
    'transition-opacity focus-within:border-[var(--pl-primary)] focus-within:shadow-[0_0_0_3px_var(--pl-primary-ring)]',
  ),

  toolbar: 'flex h-11 flex-none items-center border-b border-[var(--pl-editor-line)] bg-[var(--pl-editor-bar)] px-3',
  recommendBtn:
    '!border-[rgba(130,177,255,0.45)] !bg-[rgba(37,99,235,0.16)] !text-[var(--pl-editor-recommend)] !shadow-none enabled:hover:!bg-[rgba(37,99,235,0.24)]', // design-exempt: text on the dark editor surface (--pl-editor-bg), not white
  recommendIcon: 'h-3.5 w-3.5',
  /** 버튼 옆 이유 한 줄 — 자리(레이아웃)는 하나, 색만 갈린다. */
  blockedReason: 'ml-3 min-w-0 truncate text-[12px]',
  blockedReasonWarn: 'text-[var(--pl-editor-warn)]', // design-exempt: text on the dark editor surface (--pl-editor-bar), not white
  blockedReasonErr: 'text-[var(--pl-editor-err)]', // design-exempt: text on the dark editor surface (--pl-editor-bar), not white

  editRow: cn('flex min-h-0 flex-1 pt-4', MONO),
  gutter: 'w-[44px] flex-none select-none overflow-hidden pr-[14px] text-right text-[12px] leading-[22px] tabular-nums text-[var(--pl-editor-gutter)]', // design-exempt: text on the dark editor surface (--pl-editor-bg), not white
  textarea:
    'min-w-0 flex-1 resize-none border-0 bg-transparent pr-4 text-[14px] leading-[22px] text-[var(--pl-editor-text)] outline-none', // design-exempt: text on the dark editor surface (--pl-editor-bg), not white

  statusBar: 'flex h-7 flex-none items-center justify-between gap-3 border-t border-[var(--pl-editor-line)] bg-[var(--pl-editor-bar)] px-3 text-[12px]',
  statusLeft: 'text-[var(--pl-editor-text-muted)]', // design-exempt: text on the dark editor surface (--pl-editor-bar), not white
  statusOk: 'font-semibold text-[var(--pl-editor-ok)]', // design-exempt: text on the dark editor surface (--pl-editor-bar), not white
  statusErr: 'min-w-0 flex-1 truncate text-right font-semibold text-[var(--pl-editor-err)]', // design-exempt: text on the dark editor surface (--pl-editor-bar), not white

  foot: 'flex flex-none items-center justify-between gap-4 border-t border-[var(--pl-border)] px-6 py-4',
  nlbGroup: 'flex items-start gap-3',
  switchInput:
    'relative mt-0.5 h-5 w-9 flex-none cursor-pointer appearance-none rounded-full bg-[var(--pl-gray-300)] transition-colors checked:bg-[var(--pl-primary)] disabled:cursor-not-allowed disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-[var(--pl-white)] after:shadow-[var(--pl-shadow-xs)] after:transition-transform checked:after:translate-x-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-primary-ring)] focus-visible:ring-offset-1',
  nlbTitle: 'cursor-pointer text-[14px] font-semibold text-[var(--pl-text-strong)]',
  nlbDesc: 'mt-0.5 text-[12px] text-[var(--pl-text-weak)]',
  footActions: 'flex flex-none items-center gap-2',

  // ── 결과 프레임 ──────────────────────────────────────────────────────────
  resultWrap: 'px-6 pt-5 pb-6',
  resultTitle: 'text-[20px] font-bold tracking-[-0.02em] text-[var(--pl-text-strong)]',
  resultDesc: 'mt-1.5 text-[12px] text-[var(--pl-text-weak)]',
  kv: 'mt-6 grid grid-cols-3 gap-x-8 gap-y-3.5',
  kvKey: 'text-[12px] text-[var(--pl-text-weak)]',
  kvValue: 'mt-1 text-[14px] font-semibold text-[var(--pl-text-strong)]',
  tag: 'inline-flex flex-none items-center rounded-[6px] px-1.5 py-0.5 text-[12px] font-semibold leading-[1.34]',
  tagOk: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  tagErr: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  section: 'mt-6',
  sectionTitle: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  row: 'flex items-center gap-3 border-b border-[var(--pl-border)] py-[7px] text-[12px]',
  rowName: 'min-w-0 flex-1 truncate text-[var(--pl-text-strong)]',
  rowType: 'flex-none text-[var(--pl-text-weak)]',
  rowId: cn('min-w-0 max-w-[180px] flex-none truncate text-[var(--pl-text-weak)]', MONO),
  more: 'pt-2 text-[12px] text-[var(--pl-text-weak)]',
  disclosure: 'mt-6',
  summary: 'cursor-pointer text-[12px] font-semibold text-[var(--pl-text-weak)]',
  pre: cn(
    'mt-2 max-h-[280px] overflow-auto whitespace-pre rounded-[8px] bg-[var(--pl-gray-50)] p-4 text-[12px] leading-[1.8] text-[var(--pl-text-medium)]',
    MONO,
  ),
  errorCard: 'mt-6 rounded-[8px] border border-[var(--pl-err-border)] bg-[var(--pl-err-bg)] p-4',
  errorLabel: 'text-[12px] font-semibold text-[var(--pl-err-text)]',
  errorBody: cn('mt-2 whitespace-pre-wrap break-all text-[12px] leading-[20px] text-[var(--pl-text-medium)]', MONO),
  resultFoot: 'mt-8 flex justify-end gap-2',
} as const;

export interface ConfirmEditorModalProps {
  onClose: () => void;
  targetSourceId: number;
  provider: ConfirmedResourceProvider;
  onDone: () => void;
}

export function ConfirmEditorModal({
  onClose,
  targetSourceId,
  provider,
  onDone,
}: ConfirmEditorModalProps): ReactElement {
  // 초안은 즉시 열린다 — 추천값을 기다리지 않는다.
  const [draft, setDraft] = useState<string>(BLANK);
  const [recommendation, setRecommendation] = useState<RecommendationLoad>({ state: 'idle' });
  const [armedSwap, setArmedSwap] = useState(false);
  const [applyNlb, setApplyNlb] = useState(false);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  // 실패 뒤 [편집으로 돌아가기] 로 돌아온 흔적 — 초안이 바뀌기 전까지 상태줄에 남는다.
  const [returnedFailure, setReturnedFailure] = useState<Exchange | null>(null);
  // 초안을 버리고 나갈지 되묻는 확인창(모달 위의 모달).
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const parse = useMemo(() => {
    try {
      const doc: unknown = JSON.parse(draft);
      return { ok: true, count: countOf(doc) } as const;
    } catch (parseError) {
      return { ok: false, message: message(parseError) } as const;
    }
  }, [draft]);
  // 셀 수 있는 0건 등록은 삭제와 같은 결말이다 — 삭제에는 게이트(입력 확인 + terraform
  // APPLIED 차단)가 있으므로, 등록이 그 옆의 게이트 없는 문이 되지 않게 여기서 막는다.
  const emptyDraft = parse.ok && parse.count === 0;
  const dirty = draft !== BLANK;

  // NLB 옵션은 계약이 AWS POST 에만 두는 query 라, 다른 provider 에서는 옵션째 없다.
  const showNlb = provider === 'AWS';
  const nlb = showNlb && applyNlb;

  /** 추천값을 부르는 **유일한** 자리 — 조회도 덮어쓰기도 이 누름에서만 일어난다. */
  const loadRecommendation = (): void => {
    // 조회 중이거나 부재로 판명된 뒤에는 버튼이 이미 막혀 있다.
    if (recommendation.state === 'loading' || recommendation.state === 'absent') return;

    if (recommendation.state === 'ready') {
      // 친 글이 있으면 바로 갈아 끼우지 않는다 — 같은 버튼을 한 번 더 눌러야 덮어쓴다
      // (상태줄이 그 대기를 말한다). `!armedSwap` 이 없으면 두 번째 누름도 매번 같은
      // 조건(dirty && draft !== recommendation.text)에 걸려 무장이 절대 풀리지 않는다.
      if (dirty && draft !== recommendation.text && !armedSwap) {
        setArmedSwap(true);
        return;
      }
      setArmedSwap(false);
      setDraft(recommendation.text);
      return;
    }

    // idle·failed — 아직 받아 본 적이 없어 초안과 견줄 글이 없다. 그래서 초안이 있기만
    // 하면 무장한다: ready 보다 한 눈금 보수적이고, 그 대신 헛누름이 콜을 쓰는 것도 막는다.
    if (dirty && !armedSwap) {
      setArmedSwap(true);
      return;
    }
    setRecommendation({ state: 'loading' });
    void getApprovedRecommendations(targetSourceId, provider)
      .then((doc) => {
        const text = pretty(doc);
        setRecommendation({ state: 'ready', text });
        setArmedSwap(false);
        setDraft(text);
      })
      .catch((loadError: unknown) => {
        if (isRecommendationAbsent(loadError)) {
          // 부재면 버튼이 막힌다 — 무장을 남기면 상태줄이 지킬 수 없는 약속을 하게 된다.
          setArmedSwap(false);
          setRecommendation({ state: 'absent' });
          return;
        }
        setRecommendation({
          state: 'failed',
          code: loadError instanceof AppError ? loadError.status : 0,
        });
      });
  };

  const onDraftChange = (value: string): void => {
    setDraft(value);
    if (armedSwap) setArmedSwap(false);
    if (returnedFailure) setReturnedFailure(null);
  };

  /** 부모 갱신은 **닫을 때** 한 번이다. */
  const closeAndSync = (): void => {
    if (exchange?.ok) onDone();
    onClose();
  };

  /**
   * 닫는 문 셋(취소·ESC·오버레이)이 이 함수 하나로 모이므로 여기서만 막으면 된다.
   * 오탈자가 아니라 오클릭을 막는 장치다 — 확인은 다른 자리의 다른 버튼을 누르게 한다.
   * 성공한 뒤에는 잃을 초안이 없어 묻지 않는다.
   */
  const requestClose = (): void => {
    if (busy) return;
    // 확인창이 서 있는 동안에도 편집기의 ESC 핸들러는 살아 있다 — 여기서 되돌리지 않으면
    // ESC 가 방금 띄운 확인창을 한 번 더 무장시킨다.
    if (leaveConfirm) return;
    if (dirty && !exchange?.ok) {
      setLeaveConfirm(true);
      return;
    }
    closeAndSync();
  };

  // 왕복 시간은 렌더에 쓰이지 않으므로 state 가 아니라 ref 다.
  const startedAt = useRef(0);
  const elapsed = (): number => Date.now() - startedAt.current;

  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = useMemo(() => draft.split('\n').length, [draft]);

  // AGENTS §6 — mutation 흐름은 useApiMutation/useApiAction. 성공이든 실패든 결과는 결과
  // 프레임이 받으므로 전역 토스트로 흘리지 않는다. 성공 status 는 내부 라우트가 고정한다
  // — POST 201 (app/api/v1/target-sources/[targetSourceId]/confirmed-resources/route.ts).
  const saveMutation = useApiMutation(
    (body: unknown) => createConfirmedResources(targetSourceId, provider, body, nlb),
    {
      onSuccess: (result, sent) =>
        setExchange({ sent, ms: elapsed(), code: 201, ok: true, body: pretty(result ?? {}) }),
      onError: (mutationError, sent) =>
        setExchange(errorExchange(elapsed(), sent, mutationError)),
    },
  );
  const busy = saveMutation.loading;
  const recommendBlocked =
    busy || recommendation.state === 'loading' || recommendation.state === 'absent';
  // 버튼 옆에서 이유를 말한다 — 「추천값 불러오기」가 회색인 이유도, 눌렀는데 아무 일도
  // 일어나지 않은 이유도 화면에 없으면 고장으로 읽힌다. 지나가는 상태(저장 중·조회 중)는
  // 말하지 않는다.
  //
  // 부재는 사실이라 주황, 실패는 오류라 빨강 — 자리는 같고 색과 말이 갈린다. 실패는
  // 물어본 사람에게만 보이므로 토스트로 띄우지 않는다.
  const recommendReason: { text: string; tone: 'warn' | 'err' } | null =
    recommendation.state === 'absent'
      ? { text: '연동 승인 정보가 존재하지 않습니다.', tone: 'warn' }
      : recommendation.state === 'failed'
        ? {
            // 결과 프레임의 실패 태그와 같은 말 — 계약에 없는 코드에는 phrase 를 붙이지 않는다.
            text: `추천값을 불러오지 못했습니다 · ${
              recommendation.code > 0
                ? `${recommendation.code} ${phraseOf(recommendation.code) ?? ''}`.trim()
                : '응답 없음'
            }`,
            tone: 'err',
          }
        : null;

  const save = (): void => {
    let body: unknown;
    try {
      body = JSON.parse(draft);
    } catch {
      // 버튼이 이미 막혀 있어 실행 경로에서는 닿지 않는다.
      return;
    }
    setExchange(null);
    setReturnedFailure(null);
    startedAt.current = Date.now();
    void saveMutation.mutate(body);
  };

  const returnToEditor = (): void => {
    setReturnedFailure(exchange);
    setExchange(null);
  };

  const sentCount = exchange ? countOf(exchange.sent) : null;
  const statusCode = (code: number): string => (code > 0 ? String(code) : '응답 없음');

  return (
    <>
      <ModalShell
        open
        onClose={requestClose}
        variant="editor"
        labelledBy="confirm-editor-title"
        className={exchange ? '!h-auto' : undefined}
      >
        {exchange ? (
          exchange.ok ? (
            // ── 결과 — 성공 ──────────────────────────────────────────────────
            <div className={styles.resultWrap} role="status" aria-live="polite">
              <h2 id="confirm-editor-title" className={styles.resultTitle}>
                확정 정보를 입력했습니다
              </h2>
              <div className={styles.kv}>
                <div className="min-w-0">
                  <p className={styles.kvKey}>서버 응답</p>
                  <p className={cn(styles.kvValue, 'flex')}>
                    <span className={cn(styles.tag, styles.tagOk)}>
                      {exchange.code} {phraseOf(exchange.code)}
                    </span>
                  </p>
                </div>
                <div className="min-w-0">
                  <p className={styles.kvKey}>소요</p>
                  <p className={styles.kvValue}>{exchange.ms} ms</p>
                </div>
                <div className="min-w-0">
                  <p className={styles.kvKey}>등록 리소스</p>
                  <p className={styles.kvValue}>{sentCount != null ? `${sentCount}건` : '—'}</p>
                </div>
              </div>
              <ResourceRows title="등록된 리소스" sent={exchange.sent} />
              <details className={styles.disclosure}>
                <summary className={styles.summary}>서버 응답 본문 보기</summary>
                <pre className={styles.pre}>{exchange.body}</pre>
              </details>
              <div className={styles.resultFoot}>
                <PlButton variant="primary" onClick={closeAndSync}>
                  닫기
                </PlButton>
              </div>
            </div>
          ) : (
            // ── 결과 — 실패 ──────────────────────────────────────────────────
            <div className={styles.resultWrap} role="alert" aria-live="assertive">
              <h2 id="confirm-editor-title" className={styles.resultTitle}>
                입력하지 못했습니다
              </h2>
              <p className={styles.resultDesc}>
                {exchange.code > 0
                  ? '서버가 본문을 거절했습니다. 편집으로 돌아가 고친 뒤 다시 입력하세요.'
                  : '응답을 받지 못했습니다. 편집으로 돌아가 다시 입력하세요.'}
              </p>
              <div className={styles.kv}>
                <div className="min-w-0">
                  <p className={styles.kvKey}>서버 응답</p>
                  <p className={cn(styles.kvValue, 'flex')}>
                    <span className={cn(styles.tag, styles.tagErr)}>
                      {exchange.code > 0 ? `${exchange.code} ${phraseOf(exchange.code) ?? ''}`.trim() : '응답 없음'}
                    </span>
                  </p>
                </div>
                <div className="min-w-0">
                  <p className={styles.kvKey}>소요</p>
                  <p className={styles.kvValue}>{exchange.ms} ms</p>
                </div>
                <div className="min-w-0">
                  <p className={styles.kvKey}>보낸 리소스</p>
                  <p className={styles.kvValue}>{sentCount != null ? `${sentCount}건` : '—'}</p>
                </div>
              </div>
              <div className={styles.errorCard}>
                <p className={styles.errorLabel}>서버 응답 본문</p>
                <p className={styles.errorBody}>{exchange.body}</p>
              </div>
              <div className={styles.resultFoot}>
                <PlButton variant="secondary" onClick={requestClose}>
                  닫기
                </PlButton>
                <PlButton variant="primary" onClick={returnToEditor}>
                  편집으로 돌아가기
                </PlButton>
              </div>
            </div>
          )
        ) : (
          <>
            {/* ① 머리 — 제목만. */}
            <div className={styles.head}>
              <h2 id="confirm-editor-title" className={styles.title}>
                확정 정보 입력
              </h2>
            </div>

            {busy && (
              <div className={styles.progressTrack}>
                <div className={cn(styles.progressBar, confirmEditorProgressBar)} />
              </div>
            )}

            {/* 다크 편집기 상자 — 툴바 + textarea·gutter + 상태줄. */}
            <div className={styles.box}>
              <div className={styles.toolbar}>
                <PlButton
                  size="sm"
                  // blocked 얼굴은 variant 를 통째로 대체한다(PlButton) — 그 위에 `!` 강제
                  // 클래스를 얹으면 "막혔다"는 신호가 파란 글자에 도로 덮인다. 그래서
                  // blocked 일 때는 이 스타일을 아예 건너뛴다.
                  className={recommendBlocked ? undefined : styles.recommendBtn}
                  onClick={loadRecommendation}
                  blocked={recommendBlocked}
                  aria-describedby={recommendReason ? RECOMMEND_REASON_ID : undefined}
                >
                  {recommendation.state === 'failed' ? (
                    <ReloadIcon className={styles.recommendIcon} />
                  ) : (
                    <DownloadIcon className={styles.recommendIcon} />
                  )}
                  {recommendation.state === 'failed' ? '다시 확인' : '추천값 불러오기'}
                </PlButton>
                {recommendReason && (
                  <span
                    id={RECOMMEND_REASON_ID}
                    role="status"
                    className={cn(
                      styles.blockedReason,
                      recommendReason.tone === 'err'
                        ? styles.blockedReasonErr
                        : styles.blockedReasonWarn,
                    )}
                  >
                    {recommendReason.text}
                  </span>
                )}
              </div>

              <div className={styles.editRow}>
                <div ref={gutterRef} className={styles.gutter} aria-hidden="true">
                  {Array.from({ length: lineCount }, (_, index) => (
                    <div key={index}>{index + 1}</div>
                  ))}
                </div>
                <textarea
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onScroll={(event) => {
                    if (gutterRef.current) {
                      gutterRef.current.scrollTop = event.currentTarget.scrollTop;
                    }
                  }}
                  readOnly={busy}
                  spellCheck={false}
                  wrap="off"
                  className={cn(styles.textarea, busy && 'opacity-75')}
                  aria-label="확정 정보 JSON 초안"
                />
              </div>

              <div className={styles.statusBar}>
                <span className={styles.statusLeft}>{lineCount}줄</span>
                {armedSwap ? (
                  <span className={styles.statusErr}>
                    다시 누르면 지금 초안을 추천값으로 덮어씁니다 — 적은 내용은 사라집니다.
                  </span>
                ) : returnedFailure ? (
                  <span className={styles.statusErr}>
                    지난 응답 {statusCode(returnedFailure.code)}
                    {returnedFailure.code > 0 && phraseOf(returnedFailure.code)
                      ? ` · ${phraseOf(returnedFailure.code)}`
                      : ''}
                  </span>
                ) : !parse.ok ? (
                  <span className={styles.statusErr}>JSON 파싱 실패 — {parse.message}</span>
                ) : emptyDraft ? (
                  <span className={styles.statusErr}>
                    리소스 0건 — 작성하거나 추천값을 불러오세요
                  </span>
                ) : (
                  <span className={styles.statusOk}>
                    유효한 JSON{parse.count != null ? ` · 리소스 ${parse.count}건` : ''}
                  </span>
                )}
              </div>
            </div>

            {/* ⑤ 바닥 — 요청 옵션(NLB) + 취소·입력. */}
            <div className={styles.foot}>
              {showNlb ? (
                <div className={styles.nlbGroup}>
                  <input
                    id="confirm-editor-nlb"
                    type="checkbox"
                    role="switch"
                    checked={applyNlb}
                    disabled={busy}
                    onChange={(event) => setApplyNlb(event.target.checked)}
                    className={styles.switchInput}
                  />
                  <label htmlFor="confirm-editor-nlb" className="min-w-0 cursor-pointer">
                    <span className={cn(styles.nlbTitle, 'block')}>NLB 보안 그룹 적용</span>
                    <span className={cn(styles.nlbDesc, 'block')}>
                      적용하면 요청에 applyNLBSecurityGroup=true 가 실립니다
                    </span>
                  </label>
                </div>
              ) : (
                <span />
              )}
              <div className={styles.footActions}>
                <PlButton variant="dangerMuted" onClick={requestClose} disabled={busy}>
                  취소
                </PlButton>
                <PlButton variant="primary" onClick={save} disabled={busy || !parse.ok || emptyDraft || !dirty}>
                  {busy && <LoadingSpinner size="sm" />}
                  {busy ? '입력하는 중' : '입력'}
                </PlButton>
              </div>
            </div>
          </>
        )}
      </ModalShell>
      <ConfirmStepModal
        open={leaveConfirm}
        onClose={() => setLeaveConfirm(false)}
        onConfirm={closeAndSync}
        size="sm"
        tone="warning"
        title="작성 중인 내용이 있습니다"
        description="닫으면 작성한 내용이 사라집니다. 확정 정보는 아직 입력되지 않았습니다."
        cancelLabel="계속 작성"
        confirmLabel="닫기"
      />
    </>
  );
}

/** 「등록된/보낸 리소스」 목록 — 보낸 초안에서 읽는다. 열 줄에서 끊는다. */
function ResourceRows({ title, sent }: { title: string; sent: unknown }): ReactElement | null {
  const rows = useMemo(() => draftRowsOf(sent), [sent]);
  if (rows.length === 0) return null;
  const hidden = rows.length - MAX_ROWS;

  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>{title}</p>
      <div className="mt-2">
        {rows.slice(0, MAX_ROWS).map((row) => (
          <div key={row.key} className={styles.row}>
            <span className={styles.rowName}>{row.name}</span>
            {row.type && <span className={styles.rowType}>{row.type}</span>}
            {row.id && <span className={styles.rowId}>{row.id}</span>}
          </div>
        ))}
        {hidden > 0 && <p className={styles.more}>외 {hidden}건</p>}
      </div>
    </div>
  );
}
