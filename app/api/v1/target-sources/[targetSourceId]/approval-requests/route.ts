import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { ApprovalSelectionInput, resolveApprovalInput } from '@/app/api/_lib/approval-input';
import { schemas } from '@/lib/generated/install-v1';

// POST …/approval-requests → ApprovalRequestSummaryDto (swagger 1022; 200, not 201).
//
// 브라우저는 선택만 보낸다(ApprovalSelectionInput). 리소스가 무엇인지는 서버가 상류에서
// 다시 읽어 조립하고, 상류로 나가는 본문만 계약 모양(ApprovalRequestInputDto)이다 —
// 좁아진 것은 브라우저↔프론트 서버 경계뿐이라 계약은 그대로다.
// 왜 이렇게 하는지는 `app/api/_lib/approval-input.ts` 머리말.
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const rawBody = await request.json().catch(() => ({}));
  const selection = ApprovalSelectionInput.safeParse(rawBody);
  if (!selection.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: '연동 대상 정보를 읽지 못했습니다.',
        status: 400,
        detail: selection.error.issues[0]?.message ?? '요청 형식이 올바르지 않습니다.',
        instance: requestId,
      },
      { status: 400, headers: { 'content-type': 'application/problem+json' } },
    );
  }

  // provider 는 본문이 아니라 대상 자원에서 읽는다 — 본문이 스스로 IDC 라고 주장하면
  // 수기 입력 갈래(대조할 집합이 없는 갈래)를 클라이언트가 고르는 셈이 된다.
  const detail = schemas.TargetSourceDetail.parse(await bff.targetSources.get(parsed.value));
  const resolved = await resolveApprovalInput(
    parsed.value,
    detail.cloud_provider ?? '',
    selection.data,
  );
  if (!resolved.ok) {
    // 확인 모달은 문장을 에러 **코드**로 고른다(ADR-008). 코드 없이 409 만 주면
    // `fetchJson` 이 status 로 접어 CONFLICT 로 만들고, 화면은 "이미 진행 중인 승인 요청이
    // 있어요" + 다시 요청하기를 낸다 — 같은 본문을 다시 보내 같은 409 를 받는 고리다.
    // 이 409 는 새로고침이 고치는 실패라 제 코드를 달아 보낸다.
    if (resolved.failure.status === 409) {
      return problemResponse(
        createProblem('CONFLICT_STALE_TARGET_LIST', resolved.failure.message, requestId),
      );
    }
    return NextResponse.json(
      {
        type: 'about:blank',
        title: '연동 대상을 확인하지 못했습니다.',
        status: resolved.failure.status,
        detail: resolved.failure.message,
        instance: requestId,
      },
      {
        status: resolved.failure.status,
        headers: { 'content-type': 'application/problem+json' },
      },
    );
  }

  const data = await bff.confirm.createApprovalRequest(parsed.value, resolved.value);

  return NextResponse.json(schemas.ApprovalRequestSummaryDto.parse(data), { status: 200 });
});
