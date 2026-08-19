/**
 * fail_reason 12종 접기 맵 — TargetSource 사유 줄(밴드)과 리소스 사유 셀(표)이
 * 같은 한 벌을 읽는다 (design: 최신 TC 결과 설계 §8 · TC 실패 사유 카탈로그).
 *
 * 허용목록이다 — 목록 밖의 값은 라벨 없이 원문 그대로 + 중립으로 그린다
 * (부정형은 enum 나머지 전부를 받는다). 라벨 문안은 계약 랜딩 전 DRAFT.
 * 사유는 판정이 아니라 사실이므로 두 자리 모두 중립 텍스트다 — 적색은 pill 의 몫.
 */

export interface TcFailReasonInfo {
  /** 지면에 서는 한국어 라벨 — 원문 enum 이 mono 로 병기된다. */
  label: string;
  /** 정확한 상태 설명 — hover title 로 노출. */
  desc: string;
}

export const TC_FAIL_REASONS: Readonly<Record<string, TcFailReasonInfo>> = {
  TERRAFORM_NOT_APPLIED: {
    label: '인프라 설치(Terraform) 미적용',
    desc: '설치가 적용되지 않은 상태에서 실행됨 — 리소스별 결과가 만들어지지 않습니다. 인프라 작업 탭에서 설치 상태를 확인하세요.',
  },
  CONFIRMED_INFRA_NOT_FOUND: {
    label: '확정 인프라 정보 없음',
    desc: '테스트할 확정 스냅샷이 없음 — 연동 확정 진행 상태를 확인하세요.',
  },
  SECRET_NOT_FOUND: {
    label: 'Credential(Secret) 없음',
    desc: 'Credential 설정 안 된 리소스 존재 — 확정 정보 표에서 배정을 확인하세요.',
  },
  POD_CREATION_FAILED: {
    label: '테스트 Pod 생성 실패',
    desc: 'pod 자체가 뜨지 못해 로그가 없음 — 재실행 후 반복되면 클러스터 이벤트를 확인하세요.',
  },
  CLUSTER_TEST_FAILED: {
    label: '클러스터 연결 테스트 실패',
    desc: '접속 시도가 실제로 거절됨 — 원문 오류는 Pod 로그에 있습니다.',
  },
  FUNCTION_INVOCATION_TIMEOUT: {
    label: '테스트 실행 시간 초과',
    desc: '검증이 제한 시간 안에 끝나지 않음 — 응답 없이 패킷을 버리는 방화벽 경로에서 흔한 모양입니다.',
  },
  AWS_DATABASE_HOST_NOT_FOUND: {
    label: 'AWS DB 호스트 없음',
    desc: '확정 당시의 DB 호스트를 지금은 찾을 수 없음 — 대상 존재·리전을 확인하세요.',
  },
  AWS_VPC_ENDPOINT_NOT_FOUND: {
    label: 'AWS VPC 엔드포인트 없음',
    desc: '설치가 만들었어야 할 VPC Endpoint 가 없음 — 설치 산출물을 확인하세요.',
  },
  AZURE_PRIVATE_ENDPOINT_NOT_APPROVED: {
    label: 'Azure Private Endpoint 미승인',
    desc: '고객 승인 대기 상태 — 승인 확인 후 재실행이 필요합니다.',
  },
  GCP_PSC_CONNECTION_NOT_APPROVED: {
    label: 'GCP PSC 연결 미승인',
    desc: '고객 승인 대기 상태 — 승인 확인 후 재실행이 필요합니다.',
  },
  IDC_LISTENER_NOT_FOUND: {
    label: 'IDC 리스너 없음',
    desc: 'NLB 에 이 주소·포트의 리스너가 없음 — BDC측 네트워크 구성을 확인하세요.',
  },
  IDC_NLB_RESOURCE_NOT_FOUND: {
    label: 'IDC NLB 리소스 없음',
    desc: '경로의 관문인 NLB 자체가 없음 — BDC측 네트워크 구성을 확인하세요.',
  },
};

/** 접기 결과 — 목록 밖의 값은 label/desc 없이 원문만 남는다(중립 렌더). */
export interface TcFailReasonView {
  raw: string;
  label: string | null;
  desc: string | null;
}

export function failReasonView(raw: string | null | undefined): TcFailReasonView | null {
  if (!raw) return null;
  const info = TC_FAIL_REASONS[raw];
  return { raw, label: info?.label ?? null, desc: info?.desc ?? null };
}
