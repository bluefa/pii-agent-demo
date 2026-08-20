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
  /** 필요한 작업 — what the operator has to do next. 타일 캡션이 이것만 말한다. */
  need: string;
  /**
   * 이 버킷을 움직여야 하는 사람. 목록 메타 줄이 이 값 하나만 싣는다.
   *
   * 문단이던 시절의 설명에서 **새 정보는 이 한 조각뿐**이었다("인프라 담당자가 설치를
   * 수행해야 합니다"의 앞부분). 나머지는 버킷 이름과 타일 캡션이 이미 한 말이라
   * 문장으로 남길 이유가 없었다.
   *
   * null 은 모른다는 뜻이다 — 연결 테스트 버킷의 원래 문구는 행위자를 부르지 않았고,
   * 이 화면이 admin 전용이라는 사실만으로 "관리자"라고 적으면 네 버킷이 전부 관리자가
   * 되어 조각이 아무것도 가르지 못한다. 없으면 뺀다.
   */
  owner: string | null;
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
    owner: '서비스 담당',
    icon: 'clipboard-check',
    tab: 'confirm',
    count: (s) => s.confirmingCount,
  },
  {
    kind: 'need-install',
    label: '설치 필요',
    need: 'Agent 설치 수행',
    owner: '인프라 담당',
    icon: 'terraform',
    tab: 'infra',
    count: (s) => s.needInstallCount,
  },
  {
    kind: 'need-test-connection',
    label: '연결 테스트 필요',
    need: '연결 테스트 실행',
    // 원래 문구가 행위자를 부르지 않은 유일한 버킷이다.
    owner: null,
    icon: 'link',
    tab: 'tc',
    count: (s) => s.needTestConnectionCount,
  },
  {
    kind: 'need-pii-agent-confirm',
    label: 'PII Agent 확인 필요',
    need: '완료 승인',
    owner: '관리자',
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
