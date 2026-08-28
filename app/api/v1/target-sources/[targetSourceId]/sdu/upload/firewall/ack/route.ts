import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import type { SduAckRequestWire } from '@/lib/types/sdu';

// ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §5.
// PUT …/sdu/upload/firewall/ack { confirmed } → 204 — 방화벽 결재 확인.
//
// 어느 확인인지는 **경로가 말한다.** 본문의 판별자로 두 확인을 한 핸들러에 모으면 경로가
// 무엇을 쓰는지 말하지 않게 된다 — 이 저장소가 쓰기를 가르는 방식은 경로다
// (approval-requests/{approve|reject}, support-raw-data/{enabled|disabled}).
//
// `confirmed: false` is a first-class value, not a missing answer: the gates only block
// forward, so every finished block keeps a way back.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as SduAckRequestWire | null;
  if (typeof body?.confirmed !== 'boolean') {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'confirmed는 boolean이어야 합니다.', requestId),
    );
  }

  await bff.sdu.putFirewallAck(parsed.value, body);
  return new NextResponse(null, { status: 204 });
});
