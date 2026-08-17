/**
 * 확정 정보 탭의 판정 문장 — 도착 즉시 헤드라인이 말하는 한 문장을 고르는 규칙.
 *
 * 판정은 이 탭의 두 사실에서만 나온다: 확정 정보가 등록되어 있는가, 설치가 끝났는가.
 * 승인 스냅샷과의 대조(비교 렌즈)는 라이브 리뷰에서 제거됐다 — "뭘 비교한다는 건지"
 * 가 전달되지 않았다. 승인 축의 사실(반려·대기·요청 없음)은 미등록일 때의 sub 로만
 * 쓰인다: 무엇을 기준으로 등록하게 되는지가 그때의 유일한 질문이기 때문이다.
 *
 * 화면이 단정할 수 없는 것은 여기서도 말하지 않는다: 요청 로드가 끝나기 전의
 * "요청 없음"(모르는 것을 없다고 하지 않는다). 점 규칙은 탭과 같다 — 초록 = 결말
 * 있음 · 회색 = 아직 · 빨강 = API 가 실패/반려라고 말한 것. 경고색은 없다.
 */

export type VerdictDot = 'done' | 'idle' | 'failed';

export interface ConfirmVerdict {
  dot: VerdictDot;
  head: string;
  sub: string;
}

/**
 * 최신 연동 요청의 결말 — `unknown` 은 로드 전/실패라 아직 아무것도 단정할 수 없는 상태.
 *
 * `pending` 은 계약이 대기라고 말한 것만이다. 승인 없이 끝난 요청(취소·연동 불가)은
 * `closed` 다 — 그것을 대기로 부르면 이미 끝난 요청을 아직 처리 중이라고 말하게 된다.
 * `closed.label` 이 없으면 그 상태의 어휘가 레포에 없다는 뜻이고, 그 때는 요청에 대해
 * 아무 말도 하지 않는다.
 */
export type RequestFacet =
  | { kind: 'unknown' }
  | { kind: 'none' }
  | { kind: 'pending'; requestId: number | null }
  | { kind: 'rejected' }
  | { kind: 'closed'; label: string | null }
  | { kind: 'approved'; requestId: number | null; count: number };

export function deriveConfirmVerdict(input: {
  installed: boolean;
  confirmedCount: number;
  request: RequestFacet;
}): ConfirmVerdict {
  const { installed, confirmedCount, request } = input;

  if (installed) {
    return {
      dot: 'done',
      head: '확정과 설치가 끝났습니다',
      sub:
        confirmedCount > 0
          ? `확정한 리소스 ${confirmedCount}건이 인프라에 반영되었습니다.`
          : '확정한 리소스가 인프라에 반영되었습니다.',
    };
  }

  if (confirmedCount > 0) {
    return {
      dot: 'done',
      head: `확정 정보 ${confirmedCount}건이 등록되어 있습니다`,
      sub: '설치(Terraform)는 이 확정 정보를 기준으로 진행됩니다.',
    };
  }

  if (request.kind === 'rejected') {
    return {
      dot: 'failed',
      head: '승인이 반려되어 확정할 기준이 없습니다',
      sub: '재요청을 기다리거나, 필요하면 직접 등록할 수 있습니다.',
    };
  }
  return {
    dot: 'idle',
    head: '확정 정보가 필요합니다',
    sub:
      request.kind === 'approved' && request.requestId != null
        ? `승인 #${request.requestId}에 선택된 ${request.count}건을 기준으로 확정 정보가 등록됩니다.`
        : request.kind === 'pending'
          ? request.requestId != null
            ? `요청 #${request.requestId}이 아직 처리되지 않았습니다 — 처리 결과를 기준으로 확정합니다.`
            : '요청이 아직 처리되지 않았습니다 — 처리 결과를 기준으로 확정합니다.'
          : request.kind === 'none'
            ? '아직 승인 요청이 없습니다 — 승인된 리소스를 기준으로 등록됩니다.'
            : // 승인 없이 끝난 요청 — 반려처럼 빨강으로 올리지는 않는다(취소·연동 불가는
              // 실패가 아니다). 어휘가 없으면 요청 얘기를 빼고 기본 문장으로 돌아간다.
              request.kind === 'closed' && request.label != null
              ? `최신 요청이 ${request.label}로 처리되어 확정할 기준이 없습니다 — 재요청을 기다리거나 직접 등록할 수 있습니다.`
              : '승인된 리소스를 기준으로 확정 정보가 등록됩니다.',
  };
}
