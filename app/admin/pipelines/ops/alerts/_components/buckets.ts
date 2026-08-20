/**
 * 운영 알림 버킷 정의 — 서버(페이지)와 클라이언트(타일) 양쪽이 읽는다.
 *
 * `'use client'` 가 없는 모듈이라 Server Component 가 그대로 import 한다. 이 표가
 * 클라이언트 컴포넌트 안에 있던 동안에는 서버가 버킷 라벨·설명·탭을 알 수 없어,
 * 목록 머리글을 서버에서 그릴 수 없었다.
 *
 * 버킷 판정은 서버(BFF)의 것이다 — 어떤 대상이 어느 버킷에 드는지, 건수가 얼마인지는
 * upstream 이 소유한다. 여기 있는 것은 그 네 버킷을 화면에서 부르는 이름뿐이다.
 */
import type { OpsTargetTab } from '@/lib/routes';
import type { AlertTargetKind, DashboardSummary } from '@/lib/types/task-queue';
import type { IconName } from '@/app/admin/pipelines/_components/icons';

export type AlertStageIcon = IconName | 'terraform';

export type AlertCounts = Pick<
  DashboardSummary,
  'confirmingCount' | 'needInstallCount' | 'needTestConnectionCount' | 'needPiiAgentConfirmCount'
>;

export interface AlertBucketMeta {
  kind: AlertTargetKind;
  label: string;
  /** 필요한 작업 — what the operator has to do next. */
  need: string;
  /** Who has to act, and on what — the worklist header's subtitle. */
  description: string;
  icon: AlertStageIcon;
  /** The ops-screen tab that answers this bucket's need — rows deep-link to it. */
  tab: OpsTargetTab;
  count: (counts: AlertCounts) => number;
}

/** Tile order is the process order (설치 흐름), so the strip reads left→right
 *  as the pipeline does. Empty buckets stay clickable. */
export const ALERT_BUCKETS: readonly AlertBucketMeta[] = [
  {
    kind: 'confirming',
    label: '리소스 확정 진행 중',
    need: '확정 완료 여부 확인',
    description:
      '설치 완료 후 리소스 반영 상태를 확인해야 하는 Target Source입니다. 담당자의 확정 완료 확인이 필요합니다.',
    icon: 'clipboard-check',
    tab: 'confirm',
    count: (s) => s.confirmingCount,
  },
  {
    kind: 'need-install',
    label: '설치 필요',
    need: 'Agent 설치 수행',
    description: 'Agent 설치가 대기 중인 Target Source입니다. 인프라 담당자가 설치를 수행해야 합니다.',
    icon: 'terraform',
    tab: 'infra',
    count: (s) => s.needInstallCount,
  },
  {
    kind: 'need-test-connection',
    label: '연결 테스트 필요',
    need: '연결 테스트 실행',
    description:
      '설치된 Agent의 연결 상태를 검증해야 하는 Target Source입니다. 테스트 실행 후 결과를 확인하세요.',
    icon: 'link',
    tab: 'tc',
    count: (s) => s.needTestConnectionCount,
  },
  {
    kind: 'need-pii-agent-confirm',
    label: 'PII Agent 확인 필요',
    need: '완료 승인',
    description:
      '모든 단계를 완료하고 최종 승인을 대기 중인 Target Source입니다. 관리자 확인 후 완료 처리하세요.',
    icon: 'shield-check',
    tab: 'approval',
    count: (s) => s.needPiiAgentConfirmCount,
  },
];

export const EMPTY_ALERT_COUNTS: AlertCounts = {
  confirmingCount: 0,
  needInstallCount: 0,
  needTestConnectionCount: 0,
  needPiiAgentConfirmCount: 0,
};

/**
 * 기본 버킷 — 건수가 있는 첫 버킷(프로세스 순서), 없으면 첫 버킷.
 *
 * 이전에는 요약이 도착한 뒤 클라이언트 effect 가 골랐다. 서버가 요약을 이미 들고
 * 있으므로 그 판정도 서버에서 끝난다 — 첫 페인트에 이미 고른 버킷이 그려져 있고,
 * "아무것도 안 고른 상태"라는 중간 상태 자체가 없어진다.
 */
export const defaultAlertKind = (counts: AlertCounts): AlertTargetKind =>
  ALERT_BUCKETS.find((bucket) => bucket.count(counts) > 0)?.kind ?? ALERT_BUCKETS[0].kind;

export const alertBucket = (kind: AlertTargetKind): AlertBucketMeta =>
  ALERT_BUCKETS.find((bucket) => bucket.kind === kind) ?? ALERT_BUCKETS[0];
