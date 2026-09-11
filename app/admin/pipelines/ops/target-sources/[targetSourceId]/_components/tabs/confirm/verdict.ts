/**
 * 확정 정보 탭의 판정 문장 — 도착 즉시 헤드라인이 말하는 한 문장을 고르는 규칙.
 *
 * 판정은 이 탭의 두 사실에서만 나온다: 확정 정보가 등록되어 있는가, 설치가 끝났는가.
 * 승인 스냅샷과의 대조(비교 렌즈)는 라이브 리뷰에서 제거됐다 — "뭘 비교한다는 건지"
 * 가 전달되지 않았다. 승인 축의 사실(반려·대기·요청 없음)은 미등록일 때의 sub 로만
 * 쓰인다: 확정 정보를 입력하려면 무엇이 먼저 있어야 하는지가 그때의 유일한 질문이기
 * 때문이다.
 *
 * 화면이 단정할 수 없는 것은 여기서도 말하지 않는다: 요청 로드가 끝나기 전의
 * "요청 없음"(모르는 것을 없다고 하지 않는다).
 *
 * Sentence rules (오너 2026-09-11). The reader is an admin who does not infer from context:
 *
 * 1. No clause joined to another with `—` or ` - `. One sentence carries one fact; two facts
 *    are two sentences. A dash-joined head reads as one long label and the second half is the
 *    half that says what to do.
 * 2. No implied-context phrasing (`~을 기준으로 등록됩니다`, `처리 결과를 기준으로 확정합니다`).
 *    Every sub says what the state is and what has to happen next, naming the actor.
 * 3. Nothing says the operator can 직접 등록. The tab blocks both write doors without an
 *    APPROVED request, so that sentence would describe a button that is locked.
 *
 * 상태는 색이 아니라 낱말로 선다 — 헤드라인 왼쪽의 태그(`confirmedStateTag`)가 확정 기록의
 * 상태를 말하고, 점은 사라졌다. 승인과의 차이는 태그를 물들이지 않는다: 그것은 두 대조 행과
 * 판정 열이 이미 지고 있는 사실이고, 차이 자체가 결함은 아니다.
 */
import {
  deriveConfirmedStateTag,
  type ConfirmedStateTag,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedStateTag';

export interface ConfirmVerdict {
  /** 확정 기록의 상태 — 확정 카드의 「상태」 kv 와 같은 규칙에서 나온다. */
  tag: ConfirmedStateTag;
  head: string;
  sub: string;
}

/**
 * 최신 연동 요청의 결말 — `unknown` 은 로드 전/실패라 아직 아무것도 단정할 수 없는 상태.
 *
 * `absent` 는 그것과 다르다: **이 대상에는 요청 축이 없다.** SDU 는 승인 단계 자체가 없어
 * (계약 §0) 요청이 만들어지지 않으므로, 모르는 것도 아니고 아직 없는 것도 아니다. 그래서
 * 판정 문장은 승인을 입에 담지 않는다 — `none` 의 「연동 요청이 없습니다」도, 승인을
 * 기다리라는 말도 그 대상에서는 거짓이다.
 *
 * `pending` 은 계약이 대기라고 말한 것만이다. 승인 없이 끝난 요청(취소·연동 불가)은
 * `closed` 다 — 그것을 대기로 부르면 이미 끝난 요청을 아직 처리 중이라고 말하게 된다.
 * `closed.label` 이 없으면 그 상태의 어휘가 레포에 없다는 뜻이고, 그 때는 요청의 결말에
 * 대해 아무 말도 하지 않는다.
 */
export type RequestFacet =
  | { kind: 'unknown' }
  | { kind: 'absent' }
  | { kind: 'none' }
  | { kind: 'pending' }
  | { kind: 'rejected' }
  | { kind: 'closed'; label: string | null }
  | { kind: 'approved'; count: number };

/** 승인만 있으면 열리는 문 — 미등록 sub 의 둘째 문장은 거의 언제나 이 말이다. */
const AFTER_APPROVAL = '관리자가 승인하면 확정 정보를 입력할 수 있습니다.';
/** 요청 자체가 없거나 승인 없이 끝났다 — 서비스가 먼저 움직여야 한다. */
const AFTER_RESEND = '서비스가 연동 요청을 다시 보내고 관리자가 승인하면 확정 정보를 입력할 수 있습니다.';

export function deriveConfirmVerdict(input: {
  installed: boolean;
  confirmedCount: number;
  request: RequestFacet;
  /**
   * Step 3 (`CONFIRMING`) with a confirmed record already written — the record exists but the
   * pipeline has not accepted it, so it has to be entered again. Computed by the tab, which
   * owns `processStatus`.
   */
  reconfirmNeeded: boolean;
  /**
   * Rows that differ between the approved selection and the confirmed record, or `null` when
   * the two cannot be compared at all (no approved request, a failed load, no approval axis).
   * `null` is not 0: "nothing differs" is a claim this screen must have earned.
   */
  diffCount: number | null;
}): ConfirmVerdict {
  const { installed, confirmedCount, request, reconfirmNeeded, diffCount } = input;
  const tag = deriveConfirmedStateTag({ confirmedCount, reconfirmNeeded });

  if (installed) {
    return {
      tag,
      head: '확정과 설치가 끝났습니다',
      sub:
        confirmedCount > 0
          ? `확정한 리소스 ${confirmedCount}건이 인프라에 반영되었습니다.`
          : '확정한 리소스가 인프라에 반영되었습니다.',
    };
  }

  // Ahead of the plain "등록되어 있습니다": both are true, and only this one says the
  // record on screen is not the one the pipeline will run on.
  if (reconfirmNeeded) {
    return diffCount != null && diffCount > 0
      ? {
          tag,
          head: '확정 정보를 다시 입력해야 합니다',
          sub: `승인 내용과 차이가 ${diffCount}건 있습니다. 차이를 확인한 뒤 재확정하세요. 진행 상태는 아직 3단계(반영 중)입니다.`,
        }
      : {
          tag,
          head:
            diffCount == null
              ? '확정 정보를 다시 입력해야 합니다'
              : '리소스 정보는 전부 일치하지만 확정 정보를 다시 입력해야 합니다',
          sub: '진행 상태가 아직 3단계(반영 중)입니다. 재확정하면 확정 정보가 승인 내용으로 다시 등록됩니다.',
        };
  }

  if (confirmedCount > 0) {
    return {
      tag,
      head: `확정 정보 ${confirmedCount}건이 등록되어 있습니다`,
      // 차이는 결함이 아니다 — 태그는 「등록됨」으로 두고 문장만 그 사실을 덧붙인다.
      // 대조할 수 없으면(`null`) 일치도 차이도 주장하지 않는다.
      sub:
        diffCount == null
          ? '이 확정 정보로 설치(Terraform)를 진행합니다.'
          : diffCount > 0
            ? `승인 내용과 차이가 ${diffCount}건 있습니다.`
            : '승인 내용과 일치합니다.',
    };
  }

  if (request.kind === 'rejected') {
    return {
      tag,
      head: '연동 요청이 반려되었습니다',
      sub: `반려된 요청으로는 확정 정보를 입력할 수 없습니다. ${AFTER_RESEND}`,
    };
  }

  // 축이 없으면 승인을 입에 담지 않는다 — 기준이 될 승인은 이 대상에 생길 수 없다.
  if (request.kind === 'absent') {
    return {
      tag,
      head: '확정 정보가 필요합니다',
      sub: '확정 정보가 아직 등록되지 않았습니다. 관리자가 확정 정보를 입력하면 설치를 진행할 수 있습니다.',
    };
  }

  // 승인이 이미 있다 — 남은 것은 입력뿐이라 승인을 기다리라고 말하면 거짓이다.
  if (request.kind === 'approved') {
    return {
      tag,
      head: '확정 정보를 입력해야 합니다',
      // No request number (owner 2026-09-11): 「#0」 is a puzzle to the reader, and the
      // 연동 요청 정보 tab is where the request itself lives.
      sub: `연동 요청에서 리소스 ${request.count}건이 승인되었습니다. 관리자가 확정 정보를 입력하면 설치를 진행할 수 있습니다.`,
    };
  }

  // 조회가 실패했다 — 승인이 있는지 없는지를 모르므로 승인이 필요하다고 단정하지 않는다.
  if (request.kind === 'unknown') {
    return {
      tag,
      head: '확정 정보가 필요합니다',
      sub: '연동 요청 정보를 불러오지 못했습니다. 승인 여부를 확인한 뒤 확정 정보를 입력할 수 있습니다.',
    };
  }

  return {
    tag,
    head: '연동 요청 승인이 필요합니다',
    sub:
      request.kind === 'pending'
        ? `연동 요청이 승인 대기 중입니다. ${AFTER_APPROVAL}`
        : request.kind === 'none'
          ? `연동 요청이 없습니다. 서비스가 연동 요청을 보내고 ${AFTER_APPROVAL}`
          : // 승인 없이 끝난 요청 — 어휘가 없으면 그 결말을 말하지 않고 다음 조건만 말한다.
            request.label != null
            ? `최신 연동 요청이 ${request.label} 상태입니다. ${AFTER_RESEND}`
            : `아직 승인된 연동 요청이 없습니다. ${AFTER_RESEND}`,
  };
}
