/**
 * 확정 정보를 쓸 수 있는 대상인가 — 쓰기 경로 하나를 고르는 게이트.
 *
 * swagger 는 CSP 마다 path 를 따로 둔다(`…/{aws|gcp|azure|idc}-resources`). 그래서
 * 판정은 **계약 어휘 위의 허용 목록**이다. 도메인 타입(`CloudProvider`)을 거치지
 * 않는 이유가 둘 있다:
 *
 * 1. 어휘가 다르다 — 도메인은 `'Azure'`, 계약은 `'AZURE'`. 정규화한 도메인 값을
 *    계약 목록과 대조하면 Azure 대상만 조용히 쓰기 경로를 잃는다.
 * 2. `normalizeCloudProvider` 는 **모르는 값을 'AWS' 로 떨어뜨린다**(SDU 포함).
 *    화면을 그릴 때는 합리적인 폴백이지만 쓰기 게이트에서는 반대다 — 알 수 없는
 *    provider 가 AWS path 로 POST 하게 된다. 목록에 없으면 거절한다.
 *
 * SDU 는 계약이 두 자리에서 말하므로(`cloud_provider: "SDU"` 와
 * `metadata.is_sdu_type`) 둘을 함께 본다 — 판정은 `isSduTarget` 한 곳에만 있다.
 */
import { isSduTarget } from '@/lib/types';
import type { ConfirmedResourceProvider } from '@/app/lib/api';

const BY_WIRE: Readonly<Record<string, ConfirmedResourceProvider>> = {
  AWS: 'AWS',
  AZURE: 'AZURE',
  GCP: 'GCP',
  IDC: 'IDC',
};

export function resolveWriteProvider(target: {
  cloud_provider?: string | null;
  metadata?: { is_sdu_type?: boolean | null } | null;
}): ConfirmedResourceProvider | null {
  if (
    isSduTarget({
      is_sdu_type: target.metadata?.is_sdu_type,
      cloud_provider: target.cloud_provider,
    })
  ) {
    return null;
  }
  const wire = target.cloud_provider;
  if (typeof wire !== 'string') return null;
  return BY_WIRE[wire.trim().toUpperCase()] ?? null;
}
