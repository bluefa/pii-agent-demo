'use client';

/**
 * 확정 정보 편집기 — 입력·수정·삭제를 한 평면에서 처리하는 모달. **편집기는 편집만 한다.**
 *
 * **왜 편집 표면이 JSON 인가.** 계약이 요청 본문을 `type: object` 로만 선언한다 — 속성이
 * 하나도 없다(swagger `create{Csp}ConfirmedResource`). 필드 폼을 그리려면 계약에 없는
 * 스키마를 발명해야 하고, 그러면 BFF 가 받는 것과 화면이 보여 주는 것이 갈라진다.
 * 화면이 검사하는 것은 **JSON 으로 파싱되는가** 하나뿐이고, 그 외의 판정은 서버가 한다.
 *
 * **왜 대조가 없는가.** 첫 판에는 기준 문서와의 diff·승인 리소스 레일이 이 안에 있었고,
 * pane 쪽에는 비교 렌즈가 있었다. 둘 다 "무엇과 무엇을 비교하는지 모르겠다"는 사용자
 * 판정으로 걷어냈다 — 편집기는 편집만 하고, pane 은 현재 확정 정보만 보여 준다. 그래서
 * 추천값도 초안에 **자동으로 스미지 않는다**: 보이는 버튼([추천값 불러오기])이 유일한
 * 통로고, 버튼 없이도 편집은 언제나 가능하다.
 *
 * **레이아웃은 API 클라이언트를 따른다(Postman·Insomnia·Hoppscotch), 어휘는 Swagger 를
 * 따른다.** Swagger UI 자체는 세로 1단이라 응답이 요청 **아래**로 밀려 둘 다 반씩 잘린다 —
 * 배치는 좌우 분할을 쓰고, 이름표(Parameters / Request body / Server response / status
 * 배지 / 초기화=Clear)만 Swagger 에서 가져온다.
 *
 * 구성은 네 구역이다: ① 머리(판정 문장 + CTA) ② 요청 줄(method + 실제로 때리는 URL —
 * 전폭) ③ 요청 pane(Parameters 표 + Request body 편집기) ④ 응답 pane. ③|④ 는 좌우로
 * 나뉘고 **응답 칸은 실행 전에도 자리를 지킨다** — 어디에 결과가 뜰지가 누르기 전에
 * 보여야 두 JSON 이 대조되는 화면이라는 것을 알 수 있다.
 *
 * `applyNLBSecurityGroup` 은 계약상 query 파라미터다 — 그래서 바닥 체크박스가 아니라
 * ③의 Parameters 행이고, 켜면 ②의 URL 에 `&applyNLBSecurityGroup=true` 가 실제로 붙는다.
 *
 * **모달 안에 모달을 열지 않는다** — 탭 → pane → 모달이 이미 3단이라 삭제 확인도, 미저장
 * 이탈 확인도, 초안 덮어쓰기 확인도 같은 평면의 영역 교체다.
 *
 * **왜 실행 후에 닫지 않는가.** 이 화면이 보내는 본문은 계약이 검사해 주지 않는 opaque
 * JSON 이라, 서버가 그것을 어떻게 받았는지는 응답을 봐야만 안다. 그래서 닫는 것도 지우는
 * 것도 사용자가 누른다. 뒤 화면 갱신(`onDone`)은 그래서 **닫을 때** 한 번이다 —
 * 이유는 `closeAndSync`.
 *
 * 진입 콜은 1회(추천값 유무 확인)다. 현재 확정·terraform 은 부모 탭이 이미 들고 있다.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { useApiAction, useApiMutation } from '@/app/hooks/useApiMutation';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { metaOf } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import { ConfirmedResourceTable } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmedResourceTable';
import { confirmedIntegrationToConfirmed } from '@/lib/resource-catalog';
import type { ConfirmedResource } from '@/lib/types/resources';
import {
  confirmedResourcePath,
  createConfirmedResources,
  deleteConfirmedResources,
  getApprovedRecommendations,
  getTerraformStatus,
  type ConfirmedIntegrationResponse,
  type ConfirmedResourceProvider,
  type TerraformStatusResponse,
} from '@/app/lib/api';

/** 서버가 준 말이 있으면 그것을, 없으면 한 줄 폴백 — 원인을 지어내지 않는다. */
const message = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : '알 수 없는 오류가 발생했습니다.';

/** 확정도 없이 열렸을 때의 뼈대 — 조회 응답의 모양만 빌린다. */
const BLANK = `{\n  "resource_infos": []\n}`;

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

/**
 * 계약이 모양을 말하지 않으므로 세어지는 경우에만 센다 — 못 세면 건수 없이 보여 준다.
 *
 * 두 키를 다 본다. **이 숫자가 0건 저장 게이트의 입력**이고(`emptyDraft`), 목이 받는 키가
 * `resource_infos` 와 `resources` 둘이라(lib/bff/mock/confirm.ts) 한 키만 세면 다른 키로
 * 쓴 빈 배열이 게이트를 그냥 통과한다. 실측: 확정 10건인 대상에 `{"resources": []}` 를
 * 저장하면 201 이 오고 조회가 404 가 된다 — 삭제와 같은 결말인데 삭제의 게이트(대상 id
 * 입력 + Terraform APPLIED 차단)를 하나도 지나지 않는다.
 */
export const countOf = (doc: unknown): number | null => {
  if (typeof doc !== 'object' || doc === null) return null;
  const infos: unknown =
    'resource_infos' in doc ? doc.resource_infos
      : 'resources' in doc ? doc.resources
        : undefined;
  return Array.isArray(infos) ? infos.length : null;
};

type RecommendationLoad =
  | { state: 'loading' }
  | { state: 'ready'; text: string; count: number | null }
  /** 추천할 것이 없다(404). 오류가 아니라 부재다. */
  | { state: 'absent' }
  | { state: 'failed' };

interface GateLoad {
  state: 'loading' | 'ready' | 'failed';
  overallState: string | null;
}

/**
 * 계약이 이 두 오퍼레이션에 선언한 응답. 실패 8종은 둘이 같고 성공 코드만 갈린다
 * (swagger `create{Csp}ConfirmedResource` 201 / `delete{Csp}ConfirmedResource` 200).
 * 두 곳이 이 표를 쓴다: 실행 전 응답 칸(Swagger UI 의 Responses)과, 응답이 온 뒤
 * 코드 옆의 reason phrase. **계약에 없는 코드에는 아무 말도 붙이지 않는다.**
 */
const FAILURES = [
  [400, 'Bad Request'],
  [403, 'Forbidden'],
  [404, 'Not Found'],
  [409, 'Conflict'],
  [500, 'Internal Server Error'],
  [501, 'Not Implemented'],
  [502, 'Bad Gateway'],
  [503, 'Service Unavailable'],
] as const;

const DECLARED: Readonly<Record<'POST' | 'DELETE', readonly (readonly [number, string])[]>> = {
  POST: [[201, 'Created'], ...FAILURES],
  DELETE: [[200, 'OK'], ...FAILURES],
};

/** 키(`"x":`)만 집는다 — 파서가 아니다. 나머지는 원문으로 흘린다. */
const JSON_KEY = /("(?:[^"\\]|\\.)*")(\s*:)/g;

/**
 * JSON 한 줄에 **계조 두 단**을 준다: 키는 한 단 낮추고 값은 본문 색 그대로.
 *
 * 신택스 색(파랑·초록·주황)은 쓰지 않는다. 응답면이 요청면과 같은 계열의 밝은 면이라,
 * 색을 얹으면 두 칸이 서로 닮아져 **좌우 대조의 기준이 사라진다** — 응답은 색이 아니라
 * 면(--pl-gray-50)과 status 알약으로 구분된다.
 *
 * 매치되지 않은 조각은 그대로 이어 붙이므로 **글자를 하나도 잃지 않는다** — 초안이 아직
 * JSON 이 아닐 수 있고, 그 때도 원문은 보여야 한다.
 */
const colorize = (line: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let at = 0;
  for (const match of line.matchAll(JSON_KEY)) {
    const [text, quoted, colon] = match;
    if (match.index > at) out.push(line.slice(at, match.index));
    out.push(
      <span key={match.index} className={styles.synKey}>
        {quoted}
      </span>,
    );
    out.push(colon);
    at = match.index + text.length;
  }
  if (at < line.length) out.push(line.slice(at));
  return out;
};

/** 한 번의 실행과 그 응답. 실행 전에는 없다. */
interface Exchange {
  op: 'POST' | 'DELETE';
  /** 그 실행이 등록이었는지 저장이었는지 — 응답과 함께 굳는다. */
  did: '등록' | '저장' | '삭제';
  /**
   * **보낸** URL. ②의 줄은 지금 설정을 따라 살아 움직이므로(체크박스를 끄면 query 가
   * 빠진다), 이 응답이 어느 URL 에서 왔는지는 실행 시점에 굳혀 둔다.
   */
  url: string;
  /** HTTP status. 응답이 오지 않았으면(네트워크·타임아웃) 0. */
  code: number;
  ok: boolean;
  body: string;
  /**
   * **클라이언트가 관측한** 왕복 시간. 서버 처리 시간이 아니다 — 계약은 그것을 주지 않고,
   * 이 요청은 내부 라우트를 한 번 더 거친다(BFF 2-hop). 그래서 숫자만 적고 해석은 하지 않는다.
   */
  ms: number;
}

/**
 * 실패 응답의 본문 — `fetchJson` 이 ProblemDetails 를 `AppError` 로 접으면서 원문을 버리므로,
 * 그 때 읽어 간 필드를 같은 이름으로 되편다(lib/fetch-json.ts `parseErrorResponse`).
 * 없는 필드는 `JSON.stringify` 가 떨어뜨리므로 서버가 준 것만 남는다.
 */
const errorExchange = (
  op: Exchange['op'],
  did: Exchange['did'],
  url: string,
  ms: number,
  error: unknown,
): Exchange =>
  error instanceof AppError
    ? {
        op,
        did,
        url,
        ms,
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
    : { op, did, url, ms, code: 0, ok: false, body: pretty({ detail: message(error) }) };

/** 계약이 선언한 코드면 그 description 을, 아니면 아무 말도 하지 않는다. */
const phraseOf = (op: Exchange['op'], code: number): string | null =>
  DECLARED[op].find(([declared]) => declared === code)?.[1] ?? null;

/**
 * 크기는 세 단뿐이다: **16 제목 / 14 데이터 / 12 라벨·메타.**
 *
 * 직전 판은 31개 자리 중 27개가 12px 이라(라이브 DOM 텍스트 노드 54/57) 섹션 제목·열 머리·
 * 파라미터명·값·코드·응답 코드가 크기 하나를 나눠 쓰고 무게만으로 갈렸다 — design-guide §3
 * 의 "인접 계층은 레버 2개 이상"이 성립하지 않았고, 가장 큰 글자가 데이터가 아니라 상태
 * 문장(14)이라 계층이 뒤집혀 있었다.
 *
 * 값의 출처: 제목 16 = admin-pipeline-style-guide §1(다이얼로그 전용) · 섹션 제목 14/600 =
 * Carbon `heading-compact-01`·Geist 램프 하한·Swagger `Parameters` · 데이터 14 = Cloudscape
 * `body medium`·GitHub·Swagger 응답 코드 셀 · 라벨 12 = Carbon `label-01` · 코드 14/20 =
 * Carbon `code-02`(leading 20px 은 그대로 두고 크기만 올린다).
 *
 * 간격은 세트 {4,8,12,16,24} 밖으로 나가지 않는다 — 직전 판은 2·3·6·10·14·18px 이 14곳이었고
 * 한 자리는 0px(설명문↔표 머리)이라 계층이 아니라 충돌이었다.
 */
const styles = {
  /** ① 머리 — 위 여백 > 아래 여백(여백 7원칙 ②: 제목은 아래 내용에 소속된다). */
  head: 'flex-none border-b border-[var(--pl-border)] px-6 pb-3 pt-4',
  headTop: 'flex items-start justify-between gap-6',
  title: 'text-[16px] font-bold tracking-[-0.02em] text-[var(--pl-text-strong)]',
  chip: 'ml-2 align-middle text-[12px] font-medium text-[var(--pl-text-weak)]',
  /** 판정 문장은 메타다 — 데이터(14)보다 커서는 안 된다. */
  verdict: 'mt-1 flex items-center gap-2 text-[12px] text-[var(--pl-text-medium)]',
  dot: 'h-2 w-2 flex-none rounded-full',
  why: 'text-[var(--pl-text-weak)]',
  acts: 'flex flex-none items-center gap-2',
  /**
   * ② 요청 줄 — method + 실제로 때리는 URL + **그 URL 을 보내는 버튼**. 레퍼런스가 예외
   * 없이 한 줄에 두는 조합이다(Postman·Insomnia·Hoppscotch·Bruno): 위의 Parameters 를
   * 만지면 이 URL 이 바뀌므로, 바뀐 URL 을 보내는 버튼이 같은 줄에 있어야 원인과 결과가
   * 붙는다. 머리에 남는 것은 요청이 아니라 **모달**에 대한 동작이다(닫기·취소·모드 전환).
   */
  urlBar:
    'flex flex-none items-center gap-3 border-b border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-6 py-2',
  /**
   * 배지는 **솔리드 + 폭 고정**이다. 직전 판은 `--pl-ok-bg` 를 `--pl-gray-50` 위에 얹어 면
   * 대비가 **1.02:1** — 색이 있는데 배지로 읽히지 않았다(옅은 칩은 ΔE 가 아니라 극성으로
   * 검사한다). 폭도 가변이라 POST↔DELETE 를 오갈 때 경로 시작점이 흔들렸다.
   * 64px = "DELETE" 6자(12/700)가 좌우 8px 패딩과 들어가는 최소 8배수.
   */
  method:
    'w-16 flex-none rounded-[var(--pl-r-badge)] py-1 text-center text-[12px] font-bold tracking-[0.04em] text-[var(--pl-white)] [font-family:var(--pl-font-mono)]', // design-exempt: solid badge fill — 흰 글자가 --pl-ok-text 에서 5.42:1 / --pl-err-text 에서 6.57:1
  methodPost: 'bg-[var(--pl-ok-text)]',
  methodDelete: 'bg-[var(--pl-err-text)]',
  url: 'min-w-0 flex-1 truncate text-[14px] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
  /**
   * ③ | ④ 요청과 응답을 좌우로 나눈다. 두 칸 다 `min-w-0` — 없으면 긴 JSON 한 줄이
   * 자기 열을 넓혀 옆 칸을 밀어낸다.
   *
   * 표면은 세 등급이다: 설정(--pl-gray-50) → 입력(흰) → **출력(--pl-gray-50)**. 출력이
   * 설정과 같은 등급인 것은 의도다 — 둘 다 만질 수 없는 면이고, 만질 수 있는 것은 가운데
   * 흰 편집기 하나다. 대신 설정과 출력이 분할선에서 맞닿으므로 ④가 `border-l` 을 진다.
   */
  split: 'flex min-h-0 flex-1',
  reqCol: 'flex min-w-0 flex-1 flex-col',
  /** ③ 설정 블록 — URL 줄과 같은 면이라 하나로 읽힌다. 안쪽 구역은 선이 아니라 여백이
   *  나눈다: 다섯 줄을 다 1px 선으로 나누면 다섯 층이 같은 무게가 된다. */
  reqChrome: 'flex-none border-b border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-6 pb-2 pt-3',
  secTitle: 'flex-none text-[14px] font-semibold text-[var(--pl-text-strong)]',
  secMeta: 'flex-none text-[12px] text-[var(--pl-text-weak)]',
  secStatus: 'min-w-0 flex-1 truncate text-right text-[12px] text-[var(--pl-text-weak)]',
  secOk: 'font-semibold text-[var(--pl-ok-text)]',
  /**
   * ③-a Parameters — 두 열이다: 이름과 값. `In · Type` 열은 뺐다. `path`·`query` 는 ②의 URL
   * 이 이미 보여 주고(경로에 박혔는지 `?` 뒤에 붙는지), `boolean` 은 값 자리의 체크박스가
   * 그 자체로 말한다 — 세 번째 열이 하는 일이 없었다.
   *
   * 이름 열 폭은 직전 판의 190px 그대로다 — 14px 승격 뒤에도 `applyNLBSecurityGroup`(21자)이
   * 수납되므로 새 값을 정할 이유가 없다. 남는 폭은 값 열이 받는다.
   */
  pCol1: 'w-[190px] flex-none',
  pCol2: 'min-w-0 flex-1',
  paramHead:
    'flex items-center gap-4 border-b border-[var(--pl-gray-300)] pb-1 text-[12px] text-[var(--pl-text-weak)]',
  paramRow: 'flex items-center gap-4 border-b border-[var(--pl-gray-200)] py-2 last:border-b-0',
  paramName:
    'truncate text-[14px] font-semibold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  paramCheck:
    'flex cursor-pointer items-center gap-2 text-[14px] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
  /** ③-b Request body 이름표 + 불러오기 — 같은 면 위 두 줄이라 선 없이 한 구역이다.
   *  초안 덮어쓰기 확인도 아래 줄이 받는다(영역 교체). */
  bodyLabel: 'flex items-center gap-2',
  bar: 'mt-2 flex min-h-[32px] items-center gap-3',
  barMeta: 'text-[12px] text-[var(--pl-gray-600)]',
  barWarn: 'min-w-0 flex-1 text-[12px] font-semibold text-[var(--pl-warn-text)]',
  /**
   * ③-c 편집기 — 줄 번호는 형제 칸이다. 위 패딩을 **감싸는 쪽**이 지는 것이 중요하다:
   * textarea 의 `padding-top` 은 스크롤과 함께 걷혀 올라가므로, 양쪽에 각각 주면 스크롤한
   * 뒤 14px 어긋난다. 가로는 textarea 안에서만 스크롤되고 줄 번호는 움직일 것이 없다.
   */
  body: 'flex min-h-0 flex-1 flex-col',
  editWrap: 'flex min-h-0 flex-1 pt-4',
  editNos:
    'w-[60px] flex-none select-none overflow-hidden pr-4 text-right text-[14px] leading-[20px] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]',
  editor:
    'min-w-0 flex-1 resize-none border-0 bg-transparent pr-6 text-[14px] leading-[20px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)] focus:outline-none',
  /**
   * ④ 응답 — **밝은 면**이다. 앞 판은 여기가 `--pl-gray-800` 이었는데, 그 면이 모달 바닥까지
   * 내려가 왼쪽 절반은 흰색 / 오른쪽 절반은 그 다크인 바닥이 되고 radius 12px 이 두 색에
   * 걸쳐 깎였다 — 카드가 아니라 "창 두 개를 붙인 것"으로 읽혔다. 게다가 선언 응답표 아래
   * 480×192 가 검은 공백으로 남아, 같은 면적의 흰 공백보다 무겁게 앉았다.
   *
   * 그래서 다크를 버리고 `--pl-gray-50` 으로 내린다. 이 레포에 선례가 있다: 같은 탭의
   * Raw 렌즈(`paneStyles.raw`)가 이미 `--pl-gray-50` 코드 면이다. 판정은 표면이 아니라
   * **솔리드 status 알약**이 혼자 진다(Insomnia) — 그 대가로 알약이 실패하면 구분이 없으니
   * 알약은 옅은 틴트가 아니라 솔리드여야 한다.
   */
  resCol:
    'flex min-w-0 flex-1 flex-col border-l border-[var(--pl-border)] bg-[var(--pl-gray-50)]',
  resHead:
    'flex min-h-[40px] flex-none items-center gap-2 border-b border-[var(--pl-gray-300)] bg-[var(--pl-gray-100)] px-6 py-2',
  resTitle: 'flex-none text-[14px] font-semibold text-[var(--pl-text-strong)]',
  resMeta:
    'ml-auto flex-none text-[12px] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]',
  resCode:
    'flex-none rounded-[var(--pl-r-badge)] px-2 py-1 text-[12px] font-bold text-[var(--pl-white)] [font-family:var(--pl-font-mono)]', // design-exempt: solid pill fill — 흰 글자가 --pl-ok-text 에서 5.42:1 / --pl-err-text 에서 6.57:1
  resCodeOk: 'bg-[var(--pl-ok-text)]',
  resCodeErr: 'bg-[var(--pl-err-text)]',
  /** 응답이 온 URL 이 지금 설정과 갈라졌을 때만 나오는 줄. */
  staleUrl: 'min-w-0 flex-1 truncate text-right text-[12px] text-[var(--pl-warn-text)]',
  /** ④-a 응답 본문 — 읽기 전용이라 gutter 를 그냥 얹을 수 있다. 계조는 두 단(`colorize`). */
  resBody: 'min-h-0 flex-1 overflow-auto py-4',
  codeRow: 'grid grid-cols-[60px_1fr]',
  codeNo:
    'select-none pr-4 text-right text-[14px] leading-[20px] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]',
  codeText:
    'whitespace-pre pr-6 text-[14px] leading-[20px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  /** 키만 한 단 낮춘다 — 색이 아니라 계조다. */
  synKey: 'text-[var(--pl-text-medium)]',
  /**
   * ④-b 실행 전 — **칸을 비우지 않는다.** 채우는 재료는 계약이 이 오퍼레이션에 선언한
   * 응답 코드다(Swagger UI 의 Responses, 발명이 아니다). 안내 문단은 없다: 앞 판은 머리의
   * "아직 실행하지 않았습니다" 와 문단이 같은 사실을 두 번 말했고, 그 문단(62px·3줄)이 아래
   * 표 아홉 줄보다 무거웠다. 문단이 하던 말은 머리의 메타 한 줄로 옮겼다.
   */
  declWrap: 'min-h-0 flex-1 overflow-auto px-6 pb-4',
  declHead:
    'flex items-center gap-4 border-b border-[var(--pl-gray-300)] pb-1 pt-4 text-[12px] text-[var(--pl-text-weak)]',
  declRow: 'flex items-center gap-4 border-b border-[var(--pl-gray-200)] py-2 last:border-b-0',
  declCode: 'w-[52px] flex-none text-[14px] font-bold [font-family:var(--pl-font-mono)]',
  declDesc: 'min-w-0 flex-1 truncate text-[14px] text-[var(--pl-text-medium)]',
  /** 성공 코드만 색을 갖는다 — 실패는 아홉 줄 중 여덟이라 색으로 세면 표가 경고판이 된다.
   *  판정은 응답이 온 뒤 알약이 낸다. */
  declOk: 'text-[var(--pl-ok-text)]',
  /** ⑤ 바닥 — 이탈 확인과 오류만 받는다. 말할 것이 없으면 줄 자체가 없다. */
  foot: 'flex flex-none items-center justify-between gap-4 border-t border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-6 py-2',
  footGroup: 'flex items-center gap-4 text-[12px] text-[var(--pl-gray-600)]',
  errText: 'font-semibold text-[var(--pl-err-text)]',
  /**
   * 삭제 영역 — 표는 구조 렌즈와 같은 것을 쓰고, 좌우 여백만 여기서 준다.
   * 목록만 스크롤하고 확인 입력은 바닥에 고정한다: 삭제 버튼을 여는 유일한 컨트롤이
   * 스크롤 아래에 있으면 버튼이 왜 꺼져 있는지 보이지 않는다.
   */
  del: 'flex min-h-0 flex-1 flex-col',
  delHead: 'flex-none px-8 pt-7',
  delTitle: 'text-[16px] font-bold text-[var(--pl-text-strong)]',
  delDesc: 'mt-2 max-w-[76ch] text-[14px] leading-[1.4] text-[var(--pl-text-medium)]',
  delList: 'min-h-0 flex-1 overflow-y-auto',
  delConfirm: 'flex flex-none items-end gap-3 border-t border-[var(--pl-border)] px-8 py-4',
  delLabel: 'text-[12px] font-semibold text-[var(--pl-text-medium)]',
} as const;

export interface ConfirmEditorModalProps {
  onClose: () => void;
  targetSourceId: number;
  provider: ConfirmedResourceProvider;
  /** 현재 등록된 확정 — null 이면 생성. 부모가 이미 들고 있다(진입 0콜). */
  current: ConfirmedIntegrationResponse | null;
  /** 삭제 게이트의 초기값 — 확인 화면에 들어갈 때 한 번 다시 조회한다. */
  terraform: TerraformStatusResponse | null;
  /** 삭제가 막혔을 때의 유일한 출구. */
  onOpenInfra: () => void;
  onDone: () => void;
}

export function ConfirmEditorModal({
  onClose,
  targetSourceId,
  provider,
  current,
  terraform,
  onOpenInfra,
  onDone,
}: ConfirmEditorModalProps): ReactElement {
  const currentText = useMemo(
    () => (current && (current.resource_infos?.length ?? 0) > 0 ? pretty(current) : null),
    [current],
  );

  // 초안은 즉시 열린다 — 추천값을 기다리지 않는다. 편집이 어떤 조회에도 볼모잡히지
  // 않는 것이 이 화면의 규칙이다.
  const [draft, setDraft] = useState<string>(() => currentText ?? BLANK);
  const [recommendation, setRecommendation] = useState<RecommendationLoad>({ state: 'loading' });
  const [armedSwap, setArmedSwap] = useState(false);
  const [applyNlb, setApplyNlb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [mode, setMode] = useState<'edit' | 'delete'>('edit');
  const [gate, setGate] = useState<GateLoad>({
    state: 'ready',
    overallState: terraform?.overall_state ?? null,
  });
  const [typed, setTyped] = useState('');
  const [exchange, setExchange] = useState<Exchange | null>(null);
  // 마운트 시점의 초안 — dirty 판정의 기준. 렌더에서 읽으므로 ref 가 아니라 state 다
  // (마운트가 곧 열림이라 재설정할 일이 없고, setter 는 그래서 버린다).
  const [initialDraft] = useState(draft);

  // 진입 1콜 — 초안에 넣기 위해서가 아니라 **버튼 옆에 유무를 적기 위해** 미리 본다.
  // 부재(404)는 실패가 아니고, 실패해도 편집·저장은 그대로 간다.
  const fetchRecommendation = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      getApprovedRecommendations(targetSourceId, provider, { signal })
        .then((doc) => {
          if (signal?.aborted) return;
          setRecommendation({ state: 'ready', text: pretty(doc), count: countOf(doc) });
        })
        .catch((loadError: unknown) => {
          if (signal?.aborted) return;
          const absent = loadError instanceof AppError && loadError.code === 'NOT_FOUND';
          setRecommendation({ state: absent ? 'absent' : 'failed' });
        }),
    [targetSourceId, provider],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchRecommendation(controller.signal);
    return () => controller.abort();
  }, [fetchRecommendation]);

  const parse = useMemo(() => {
    try {
      const doc: unknown = JSON.parse(draft);
      return { ok: true, count: countOf(doc) } as const;
    } catch (parseError) {
      return { ok: false, message: message(parseError) } as const;
    }
  }, [draft]);
  // 셀 수 있는 0건 저장은 삭제와 같은 결말이다 — 삭제에는 게이트(입력 확인 + terraform
  // APPLIED 차단)가 있으므로, 저장이 그 옆의 게이트 없는 문이 되지 않게 여기서 막는다.
  const emptyDraft = parse.ok && parse.count === 0;

  const dirty = draft !== initialDraft;
  const creating = currentText == null;
  const did: Exchange['did'] = creating ? '등록' : '저장';

  // ② 가 적는 URL 은 **보내는 쪽과 같은 빌더**에서 나온다 — NLB 를 켜면 여기에 query 가
  // 붙고, 그것이 곧 fetch 가 때리는 경로다. DELETE 에는 그 파라미터가 계약에 없다.
  const nlb = provider === 'AWS' && applyNlb;
  const requestUrl = confirmedResourcePath(targetSourceId, provider, mode === 'edit' && nlb);

  // 정할 수 있는 파라미터가 하나라도 있는가. `applyNLBSecurityGroup` 이 유일하고 계약이
  // AWS POST 에만 두므로, 다른 provider·삭제 모드에서는 Parameters 구역째 없다.
  const hasParams = provider === 'AWS' && mode === 'edit';

  const loadRecommendation = (): void => {
    if (recommendation.state === 'failed') {
      setRecommendation({ state: 'loading' });
      void fetchRecommendation();
      return;
    }
    if (recommendation.state !== 'ready') return;
    // 친 글이 있으면 바로 갈아 끼우지 않는다 — 확인은 같은 바 안의 영역 교체다.
    if (dirty && draft !== recommendation.text) {
      setArmedSwap(true);
      return;
    }
    setDraft(recommendation.text);
  };

  /**
   * 부모 갱신은 **닫을 때** 한 번이다. `onDone` 은 탭의 세 로드를 다시 돌리고, 탭은 로딩
   * 동안 스켈레톤으로 조기 반환하면서 이 모달째 언마운트한다(ConfirmTab `booting`) —
   * 실행 직후에 부르면 방금 그린 응답이 그 자리에서 사라진다.
   */
  const closeAndSync = (): void => {
    if (exchange?.ok) onDone();
    onClose();
  };

  const requestClose = (): void => {
    // 실행이 성공했으면 초안은 이미 서버로 갔다 — 이탈 확인은 보내지 않은 편집에만 묻는다.
    if (mode === 'edit' && dirty && !exchange?.ok) {
      setLeaving(true);
      return;
    }
    closeAndSync();
  };

  // 왕복 시간은 렌더에 쓰이지 않으므로 state 가 아니라 ref 다 — 눌린 시각을 적어 두고
  // 응답 콜백에서 뺀다. 성공·실패가 같은 값을 봐야 하므로 mutation 안이 아니라 밖에 둔다.
  const startedAt = useRef(0);
  const elapsed = (): number => Date.now() - startedAt.current;

  // 편집기 줄 번호 — textarea 는 자기 안에서 스크롤하므로 형제인 gutter 를 따라오게 한다.
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = useMemo(() => draft.split('\n').length, [draft]);

  // AGENTS §6 — mutation 흐름은 useApiMutation/useApiAction. 성공이든 실패든 결과는 응답
  // 블록이 받으므로(setExchange) 전역 토스트로 흘리지 않는다. 성공 status 는 내부 라우트가
  // 고정한다 — POST 201 / DELETE 200
  // (app/api/v1/target-sources/[targetSourceId]/confirmed-resources/route.ts).
  const saveMutation = useApiMutation(
    (body: unknown) => createConfirmedResources(targetSourceId, provider, body, applyNlb),
    {
      onSuccess: (result) =>
        setExchange({
          op: 'POST',
          did,
          url: requestUrl,
          ms: elapsed(),
          code: 201,
          ok: true,
          body: pretty(result ?? {}),
        }),
      onError: (mutationError) =>
        setExchange(errorExchange('POST', did, requestUrl, elapsed(), mutationError)),
    },
  );
  const removeAction = useApiAction(() => deleteConfirmedResources(targetSourceId, provider), {
    onSuccess: (result) =>
      setExchange({
        op: 'DELETE',
        did: '삭제',
        url: requestUrl,
        ms: elapsed(),
        code: 200,
        ok: true,
        body: pretty(result ?? {}),
      }),
    onError: (mutationError) =>
      setExchange(errorExchange('DELETE', '삭제', requestUrl, elapsed(), mutationError)),
  });
  const busy = saveMutation.loading || removeAction.loading;

  const save = (): void => {
    let body: unknown;
    try {
      body = JSON.parse(draft);
    } catch (parseError) {
      setError(`JSON 을 읽을 수 없습니다 — ${message(parseError)}`);
      return;
    }
    if (countOf(body) === 0) {
      setError(
        creating
          ? '리소스 0건은 등록할 수 없습니다 — 직접 작성하거나 추천값을 불러오세요.'
          : '리소스 0건은 저장할 수 없습니다 — 확정을 비우려면 삭제를 사용하세요.',
      );
      return;
    }
    setError(null);
    setExchange(null);
    // 실행은 이탈의 반대다 — 띄워 둔 이탈 확인이 있으면 그것부터 거둔다.
    setLeaving(false);
    startedAt.current = Date.now();
    void saveMutation.mutate(body);
  };

  const openDelete = (): void => {
    setMode('delete');
    setError(null);
    setExchange(null);
    setTyped('');
    setArmedSwap(false);
    // 편집에서 띄워 둔 이탈 확인은 편집의 것이다 — 거두지 않으면 삭제 화면 바닥에
    // "저장하지 않은 편집이 있습니다 / 계속 편집" 이 남고, 그 버튼이 삭제 화면에서 아무
    // 것도 하지 않는다.
    setLeaving(false);
    // 모달이 오래 열려 있을 수 있으므로 게이트만 최신값으로 다시 본다.
    setGate((prev) => ({ ...prev, state: 'loading' }));
    void getTerraformStatus(targetSourceId)
      .then((status) => setGate({ state: 'ready', overallState: status.overall_state ?? null }))
      .catch(() => setGate({ state: 'failed', overallState: null }));
  };

  /**
   * 삭제 화면에서 편집으로 — **삭제의 응답을 두고 오지 않는다.** 두고 오면 판정 문장이
   * "삭제하지 못했습니다 · 다시 실행하세요" 인데 실행 버튼은 POST 저장이라, 문장이 가리키는
   * 동작과 누를 수 있는 동작이 어긋난다. 보낸 URL 경고도 이걸 못 잡는다 — NLB 를 끈 상태의
   * DELETE 와 POST 는 URL 이 글자까지 같다.
   */
  const backToEdit = (): void => {
    setMode('edit');
    setExchange(null);
    setError(null);
  };

  const remove = (): void => {
    setError(null);
    setExchange(null);
    setLeaving(false);
    startedAt.current = Date.now();
    void removeAction.execute();
  };

  const confirmedCount = current?.resource_infos?.length ?? 0;
  // 삭제 확인이 그리는 표는 확정 pane 의 구조 렌즈와 같은 것이다 — 같은 응답을 같은
  // 매퍼로 넘긴다.
  const deleteRows = useMemo(
    () => (current ? confirmedIntegrationToConfirmed(current) : []),
    [current],
  );
  const applied = gate.overallState === 'APPLIED';
  const deleteReady = !applied && typed.trim() === String(targetSourceId) && gate.state === 'ready';

  // 삭제가 성공하면 지울 것이 남아 있지 않다 — 요청 칸을 접고 응답만 남긴다. 그 한 칸을
  // "오른쪽" 이라고 부르면 거짓이 되므로, 판정 문장도 같은 값을 본다.
  const showReq = !(mode === 'delete' && exchange?.ok);

  const verdict = exchange
    ? exchange.ok
      ? {
          tone: 'ok' as const,
          head: `확정 정보를 ${exchange.did}했습니다`,
          why: showReq ? '오른쪽이 서버가 돌려준 응답입니다' : '아래가 서버가 돌려준 응답입니다',
        }
      : {
          tone: 'err' as const,
          head: `${exchange.did}하지 못했습니다`,
          why: '오른쪽 응답을 확인하고 다시 실행하세요',
        }
    : mode === 'delete'
      ? { tone: 'err' as const, head: '확정 정보를 삭제합니다', why: '되돌릴 수 없습니다' }
      : creating
        ? {
            tone: 'idle' as const,
            head: '확정 정보를 새로 등록합니다',
            why: dirty ? '등록하면 이 초안이 확정 정보가 됩니다' : '직접 작성하거나 추천값을 불러오세요',
          }
        : {
            tone: 'ok' as const,
            head: '등록된 확정 정보를 고치고 있습니다',
            why: dirty
              ? `저장하면 ${confirmedCount}건이 이 초안으로 바뀝니다`
              : '아직 바뀐 내용이 없습니다',
          };

  const recommendationMeta =
    recommendation.state === 'loading'
      ? '추천값 확인 중…'
      : recommendation.state === 'ready'
        ? recommendation.count != null
          ? `추천 ${recommendation.count}건`
          : '추천값 준비됨'
        : recommendation.state === 'absent'
          ? '불러올 추천값이 없습니다'
          : '추천값을 확인하지 못했습니다';

  return (
    <ModalShell open onClose={requestClose} variant="editor" labelledBy="confirm-editor-title">
      {/* ① 머리 */}
      <div className={styles.head}>
        <div className={styles.headTop}>
          <div className="min-w-0">
            <h2 id="confirm-editor-title" className={styles.title}>
              확정 정보
              <span className={styles.chip}>
                {provider} · Target Source #{targetSourceId}
              </span>
            </h2>
            <p className={styles.verdict}>
              <span
                className={cn(
                  styles.dot,
                  verdict.tone === 'err'
                    ? 'bg-[var(--pl-err)]'
                    : verdict.tone === 'ok'
                      ? 'bg-[var(--pl-ok)]'
                      : 'bg-[var(--pl-gray-300)]',
                )}
              />
              {verdict.head}
              <span className={styles.why}>· {verdict.why}</span>
            </p>
          </div>
          {/* 머리는 **모달**에 대한 동작만 받는다 — 요청을 보내는 버튼은 ②의 URL 줄로 갔다.
              성공은 종점이다: 이 모달은 실행 뒤에 서버를 다시 읽지 않으므로, 편집으로
              돌려보내면 CTA 가 실행 전 상태("등록", 삭제 없음)로 되살아나 거짓말을 한다.
              되돌아가는 문은 [닫기] 하나고, 다시 하려면 새 모달이다. 실패는 서버를 바꾸지
              않았으니 [초기화](Swagger 의 Clear)로 응답만 걷고 그 자리에서 고쳐 재실행한다. */}
          <div className={styles.acts}>
            {exchange?.ok ? (
              <PlButton variant="primary" onClick={closeAndSync}>
                닫기
              </PlButton>
            ) : (
              <>
                {exchange && (
                  <PlButton variant="secondary" onClick={() => setExchange(null)} disabled={busy}>
                    초기화
                  </PlButton>
                )}
                {mode === 'edit' ? (
                  <>
                    {/* 케밥 대신 보이는 버튼 — 항목이 하나뿐인 메뉴는 감출 이유가 없다. */}
                    {!creating && (
                      <PlButton variant="danger" onClick={openDelete} disabled={busy}>
                        삭제
                      </PlButton>
                    )}
                    <PlButton variant="secondary" onClick={requestClose} disabled={busy}>
                      취소
                    </PlButton>
                  </>
                ) : (
                  <PlButton variant="secondary" onClick={backToEdit} disabled={busy}>
                    편집으로 돌아가기
                  </PlButton>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ② 요청 줄 — 이 화면이 실제로 때리는 URL 과, **그 URL 을 보내는 버튼**. Parameters 를
          만지면 URL 이 바뀌므로, 바뀐 URL 을 보내는 버튼이 같은 줄에 있어야 원인과 결과가
          붙는다(Postman·Insomnia·Hoppscotch·Bruno 가 공통으로 하는 것). */}
      <div className={styles.urlBar}>
        <span
          className={cn(
            styles.method,
            mode === 'delete' ? styles.methodDelete : styles.methodPost,
          )}
        >
          {mode === 'delete' ? 'DELETE' : 'POST'}
        </span>
        <span className={styles.url}>{requestUrl}</span>
        {/* 실행이 성공했으면 보낼 것이 남아 있지 않다 — 버튼째 빠진다. */}
        {!exchange?.ok
          && (mode === 'edit' ? (
            <PlButton
              variant="primary"
              onClick={save}
              disabled={busy || !parse.ok || emptyDraft || (creating && !dirty)}
            >
              {busy ? `${did} 중…` : did}
            </PlButton>
          ) : applied ? (
            <PlButton variant="primary" onClick={onOpenInfra}>
              인프라 철거로 이동
            </PlButton>
          ) : (
            <PlButton
              variant="dangerSolid"
              onClick={remove}
              disabled={busy || !deleteReady}
            >
              {busy ? '삭제 중…' : '삭제'}
            </PlButton>
          ))}
      </div>

      {/* ③ | ④ 요청 | 응답 — 응답 칸은 실행 전에도 자리를 지킨다. 무엇을 보내서 이
          응답이 왔는지가 같은 눈높이에 있어야 두 JSON 이 대조된다. */}
      <div className={styles.split}>
        {showReq && (
          <div className={styles.reqCol}>
            {/* ③ 설정 블록 — URL 줄과 같은 면이라 하나로 읽힌다. 안쪽 구역은 1px 선이
                아니라 여백이 나눈다: 다섯 줄을 다 선으로 나누면 다섯 층이 같은 무게가 된다. */}
            <div className={styles.reqChrome}>
              {/* ③-a Parameters — 계약이 선언한 것 중 **사용자가 정할 수 있는 것만.**
                  `targetSourceId` 는 path 에 박혀 바꿀 수 없고 ②의 URL 과 머리의 칩이 이미
                  두 번 말하므로 행을 두지 않는다. 그래서 정할 것이 없는 provider·모드에서는
                  구역째 없다 — 빈 표는 "여기서 뭘 정하는가"에 답하지 않는다. */}
              {hasParams && (
                <>
                  <div className={cn(styles.secTitle, 'mb-2')}>Parameters</div>
                  <div className={styles.paramHead}>
                    <span className={styles.pCol1}>Name</span>
                    <span className={styles.pCol2}>Value</span>
                  </div>
                  {/* 계약이 AWS POST path 에만 두는 파라미터 — 삭제에는 없다. */}
                  <div className={styles.paramRow}>
                    <span className={cn(styles.pCol1, styles.paramName)}>
                      applyNLBSecurityGroup
                    </span>
                    <label className={cn(styles.pCol2, styles.paramCheck)}>
                      <input
                        type="checkbox"
                        checked={applyNlb}
                        disabled={busy || exchange?.ok === true}
                        onChange={(event) => setApplyNlb(event.target.checked)}
                      />
                      {String(applyNlb)}
                    </label>
                  </div>
                </>
              )}

              {/* ③-b Request body 이름표 — 파싱 판정은 본문의 성질이므로 이 줄이 진다.
                  Parameters 가 없으면 이 줄이 구역의 첫 줄이라 위 여백을 지지 않는다. */}
              {mode === 'edit' && (
                <div className={cn(styles.bodyLabel, hasParams && 'mt-4')}>
                  <span className={styles.secTitle}>Request body</span>
                  <span className={styles.secMeta}>application/json</span>
                  <span
                    className={cn(
                      styles.secStatus,
                      !parse.ok || (emptyDraft && !creating)
                        ? styles.errText
                        : parse.ok && !emptyDraft
                          ? styles.secOk
                          : undefined,
                    )}
                    title={parse.ok ? undefined : parse.message}
                  >
                    {!parse.ok
                      ? `JSON 파싱 실패 — ${parse.message}`
                      : emptyDraft
                        ? creating
                          ? '리소스 0건 — 작성하거나 추천값을 불러오세요'
                          : '리소스 0건 — 비우려면 삭제를 사용하세요'
                        : parse.count != null
                          ? `파싱 정상 · ${parse.count}건`
                          : '파싱 정상'}
                  </span>
                </div>
              )}

              {/* ③-c 불러오기 줄 — 삭제 화면에는 불러올 초안이 없고, 실행이 끝난 평면은
                  결과를 보는 자리지 초안을 갈아 끼우는 자리가 아니다. 초안 덮어쓰기 확인도
                  이 줄이 받는다(영역 교체). */}
              {mode === 'edit' && !exchange?.ok && (
                <div className={styles.bar}>
                  {armedSwap ? (
                    <>
                      <span className={styles.barWarn}>
                        지금 적은 초안을 추천값으로 덮어씁니다 — 적은 내용은 사라집니다.
                      </span>
                      <div className={styles.acts}>
                        <PlButton
                          variant="secondary"
                          onClick={() => setArmedSwap(false)}
                        >
                          유지
                        </PlButton>
                        <PlButton
                          variant="danger"
                          onClick={() => {
                            if (recommendation.state === 'ready') setDraft(recommendation.text);
                            setArmedSwap(false);
                          }}
                        >
                          덮어쓰기
                        </PlButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <PlButton
                        variant="secondary"
                        onClick={loadRecommendation}
                        disabled={
                          busy
                          || recommendation.state === 'loading'
                          || recommendation.state === 'absent'
                        }
                      >
                        {recommendation.state === 'failed' ? '다시 확인' : '추천값 불러오기'}
                      </PlButton>
                      <span className={styles.barMeta}>{recommendationMeta}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ③-d 요청 본문 */}
            <div className={styles.body}>
              {mode === 'delete' ? (
                <DeletePanel
                  targetSourceId={targetSourceId}
                  count={confirmedCount}
                  resources={deleteRows}
                  gate={gate}
                  typed={typed}
                  onTyped={setTyped}
                />
              ) : (
                /* 서버로 가는 것은 여기 적힌 원문 그대로다 — 숨은 변환이 없다. 실행이
                   성공하면 읽기 전용이다: 성공은 종점이라, 고쳐도 보낼 문이 없다.
                   gutter 는 textarea 의 형제라 같이 스크롤되지 않는다 — 세로 위치만
                   따라가게 한다(가로는 줄 번호가 움직일 것이 없다). */
                <div className={styles.editWrap}>
                  <div ref={gutterRef} className={styles.editNos} aria-hidden="true">
                    {Array.from({ length: lineCount }, (_, index) => (
                      <div key={index}>{index + 1}</div>
                    ))}
                  </div>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onScroll={(event) => {
                      if (gutterRef.current) {
                        gutterRef.current.scrollTop = event.currentTarget.scrollTop;
                      }
                    }}
                    readOnly={exchange?.ok === true}
                    spellCheck={false}
                    wrap="off"
                    className={styles.editor}
                    aria-label="확정 정보 JSON 초안"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ④ 응답 — 편집에서는 실행 전에도 칸이 있다. 어디에 결과가 뜰지가 누르기 전에
            보여야 이 화면이 두 JSON 을 대조하는 자리라는 것을 알 수 있다. 삭제는 다르다:
            작성할 본문이 없고 왼쪽이 리소스 표라, 절반으로 접으면 무엇이 지워지는지가
            잘린다 — 돌려받을 것이 생긴 뒤에 칸을 연다. */}
        {(mode === 'edit' || exchange) && (
          <div className={styles.resCol}>
            <div className={styles.resHead}>
              <span className={styles.resTitle}>Server response</span>
              {exchange ? (
                <>
                  <span
                    className={cn(
                      styles.resCode,
                      exchange.ok ? styles.resCodeOk : styles.resCodeErr,
                    )}
                  >
                    {exchange.code > 0 ? exchange.code : '—'}
                  </span>
                  {/* ②는 지금 설정을, 이것은 **보낸** URL 을 말한다. 성공 뒤에는 파라미터가
                      얼어 둘이 갈라질 수 없으므로, 실패 뒤에 다시 만졌을 때만 말한다 —
                      같은 URL 을 두 줄에 적어 두면 잘린 꼬리가 서로를 흉내 낸다. */}
                  {exchange.url !== requestUrl ? (
                    <span className={styles.staleUrl} title={`${exchange.op} ${exchange.url}`}>
                      보낸 URL 이 지금 설정과 다릅니다
                    </span>
                  ) : (
                    /* reason phrase 는 계약의 description 이고, ms 는 **클라이언트가 관측한**
                       왕복이다 — 서버 처리 시간이라고 말하지 않는다. */
                    <span className={styles.resMeta}>
                      {[phraseOf(exchange.op, exchange.code), `${exchange.ms} ms`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </>
              ) : (
                /* 실행 전 상태와 아래 표가 무엇인지를 **한 줄**이 말한다 — 앞 판은 이 말을
                   여기와 표 위 문단에서 두 번 했다. */
                <span className={styles.resMeta}>
                  아직 실행하지 않았습니다 · 계약이 선언한 응답 {DECLARED.POST.length}종
                </span>
              )}
            </div>
            {exchange ? (
              <div className={styles.resBody}>
                {exchange.body.split('\n').map((line, index) => (
                  <div key={index} className={styles.codeRow}>
                    <span className={styles.codeNo}>{index + 1}</span>
                    <span className={styles.codeText}>{colorize(line)}</span>
                  </div>
                ))}
              </div>
            ) : (
              /* 여기는 편집에서만 온다 — 삭제는 응답이 생긴 뒤에야 이 칸을 연다.
                 **칸을 비우지 않는다.** 지난 판은 두 줄만 두어 이 자리가 상시 공백이었다.
                 채우는 것은 계약이 이 오퍼레이션에 선언한 응답 코드다 — 발명이 아니다. */
              <div className={styles.declWrap}>
                <div className={styles.declHead}>
                  <span className={styles.declCode}>Code</span>
                  <span className="min-w-0 flex-1">Description</span>
                </div>
                {DECLARED.POST.map(([code, description]) => (
                  <div key={code} className={styles.declRow}>
                    {/* 성공 코드만 색을 갖는다 — 아홉 줄 중 여덟이 실패라, 실패에 색을 주면
                        표가 목록이 아니라 경고판이 된다. 판정은 응답이 온 뒤 알약이 낸다. */}
                    <span
                      className={cn(styles.declCode, code < 300 ? styles.declOk : styles.declDesc)}
                    >
                      {code}
                    </span>
                    <span className={styles.declDesc}>{description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ⑤ 바닥 — 이탈 확인과 오류만 받는다. 말할 것이 없으면 줄 자체가 없다: 파싱 판정은
          Request body 이름표로, NLB 는 Parameters 로 각자 제 구역에 갔다. */}
      {(leaving || error) && (
        <div className={styles.foot}>
          {leaving ? (
            <>
              <span className={styles.footGroup}>저장하지 않은 편집이 있습니다.</span>
              <div className={styles.acts}>
                <PlButton variant="secondary" onClick={() => setLeaving(false)}>
                  계속 편집
                </PlButton>
                <PlButton variant="danger" onClick={closeAndSync}>
                  버리고 닫기
                </PlButton>
              </div>
            </>
          ) : (
            <span className={cn(styles.footGroup, styles.errText)}>{error}</span>
          )}
        </div>
      )}
    </ModalShell>
  );
}

// ── 삭제 ────────────────────────────────────────────────────────────────────

function DeletePanel({
  targetSourceId,
  count,
  resources,
  gate,
  typed,
  onTyped,
}: {
  targetSourceId: number;
  count: number;
  /** 지워질 리소스 — 확정 pane 의 구조 렌즈와 **같은 표**로 그린다. */
  resources: readonly ConfirmedResource[];
  gate: GateLoad;
  typed: string;
  onTyped: (next: string) => void;
}): ReactElement {
  const applied = gate.overallState === 'APPLIED';

  return (
    <div className={styles.del}>
      <div className={styles.delHead}>
        <h3 className={styles.delTitle}>확정된 리소스 {count}건이 지워집니다</h3>
        {/* Terraform 은 상태만 말한다 — "철거할 인프라가 없다" 는 NEVER_APPLIED 에서만
            사실이고, 그 밖의 상태에서 같은 말을 하면 계약에 없는 것을 단정하는 것이 된다. */}
        <p className={styles.delDesc}>
          삭제하면 재승인 절차를 처음부터 다시 진행해야 합니다.
          {gate.state === 'loading'
            ? ' Terraform 상태를 확인하는 중입니다.'
            : gate.state === 'failed'
              ? ' Terraform 상태를 불러오지 못했습니다.'
              : applied
                ? ' Terraform 이 인프라를 올린 상태라 확정 정보만 지울 수 없습니다 — 철거가 먼저입니다.'
                : gate.overallState === 'NEVER_APPLIED'
                  ? ' Terraform 은 아직 적용된 적이 없어 철거할 인프라가 없습니다.'
                  : ` Terraform 은 ${metaOf(gate.overallState).label} 상태입니다.`}
        </p>
      </div>

      {/* 무엇이 지워지는지는 조회 화면과 같은 문법으로 읽혀야 한다 — 검색·필터·페이지가
          그대로 붙으므로 600건이어도 "내 DB 가 이 목록에 있나" 를 확인할 수 있다. */}
      <div className={styles.delList}>
        <ConfirmedResourceTable resources={resources} className="mt-5 pb-6" />
      </div>

      <div className={styles.delConfirm}>
        <div className="min-w-0 flex-1">
          <label className={styles.delLabel} htmlFor="confirm-delete-typed">
            확인을 위해 <b>{targetSourceId}</b> 을(를) 입력하세요.
          </label>
          <input
            id="confirm-delete-typed"
            value={typed}
            onChange={(event) => onTyped(event.target.value)}
            disabled={applied || gate.state !== 'ready'}
            placeholder="Target Source ID"
            className={cn(pipelineStyles.input, 'mt-2 w-full max-w-[280px]')}
          />
        </div>
      </div>
    </div>
  );
}
