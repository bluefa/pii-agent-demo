/**
 * 확정 정보 삭제 모달의 갈림길 — Terraform 게이트 하나가 화면 넷을 가른다.
 *
 * 순수 함수로 빼 두는 이유는 이 판정이 **한 줄짜리 규칙인데 되돌리기 쉬워서**다:
 * 막는 상태는 `APPLIED` **하나뿐**이다. 「적용 중」·「삭제 중」·「적용 실패」까지 막는
 * 것이 안전해 보이지만, 그것은 계약이 말하지 않은 것을 단정하는 일이고 확정 정보를
 * 영영 지울 수 없는 상태를 만든다. 규칙을 넓히려면 이 파일의 테스트가 먼저 깨진다.
 */
import { metaOf } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';

export type GateState = { state: 'loading' | 'ready' | 'failed'; overallState: string | null };

/**
 * `checking` 조회 중 · `blocked` 인프라가 올라가 있음 · `allowed` 지울 수 있음 ·
 * `unknown` 상태를 못 읽음(사용자가 직접 확인해야 한다).
 */
export type DeleteVariant = 'checking' | 'blocked' | 'allowed' | 'unknown';

export function deleteVariantOf(gate: GateState): DeleteVariant {
  if (gate.state === 'loading') return 'checking';
  if (gate.state === 'failed') return 'unknown';
  return gate.overallState === 'APPLIED' ? 'blocked' : 'allowed';
}

/**
 * Terraform 이 지금 무엇인지 한 문장으로. **상태만 말한다** — "철거할 인프라가 없다" 는
 * `NEVER_APPLIED` 에서만 사실이고, 그 밖의 상태에서 같은 말을 하면 계약에 없는 것을
 * 단정하는 것이 된다. 어휘가 없는 값은 상태 라벨을 그대로 적는다.
 */
export function terraformSentence(gate: GateState): string {
  if (gate.state === 'loading') return 'Terraform 상태를 확인하는 중입니다.';
  if (gate.state === 'failed') return 'Terraform 상태를 불러오지 못했습니다.';
  if (gate.overallState === 'APPLIED') {
    return 'Terraform 이 이 확정 정보로 인프라를 올린 상태입니다. 인프라 작업 탭에서 철거가 끝난 뒤 삭제할 수 있습니다.';
  }
  if (gate.overallState === 'NEVER_APPLIED') {
    return 'Terraform 은 아직 적용된 적이 없어 철거할 인프라가 없습니다.';
  }
  return `Terraform 은 ${metaOf(gate.overallState).label} 상태입니다.`;
}
