/**
 * 설치 확인 어휘 — 상태 낱말·주체 낱말·알약 톤. 두 탭이 같은 사실을 말하므로 한 벌이다
 * (인프라 작업 탭의 `설치 확인` 카드, 연결 테스트 탭의 실행 전 안내).
 *
 * 낱말 자체는 `install-copy` 의 `ko.stepValue` 다 — 서비스 화면 Step 4 가 셀에 찍는 그
 * 여섯 낱말이고, 여기서 다시 짓지 않는다. 이 파일이 더하는 것은 그 낱말이 이 콘솔의
 * 팔레트에서 어떤 톤·글리프로 서는가뿐이다.
 */
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';
import type { InstallStepValue } from '@/app/components/features/process-status/install-status-detail/model';
import type { IconName } from '@/app/admin/pipelines/_components/icons';
import type { TONE } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/terraformState';
import type {
  InstallGateStep,
  InstallSide,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';

/** 주체 — Terraform 작업 행의 `SIDE_LABEL` 과 같은 두 낱말이다. */
export const INSTALL_SIDE_LABEL: Record<InstallSide, string> = {
  service: '서비스 측',
  bdc: 'BDC 측',
};

/**
 * 상태 → 톤·글리프. 적색은 실패에만 준다(`TONE` 의 규칙 그대로): BDC 설치 대기와 해당
 * 없음은 남의 차례이거나 할 일이 없는 것이라 조용한 계열이고, 확인 중은 판정을 보류하는
 * 자리라 시계를 쓴다.
 */
export const INSTALL_STATUS_META: Record<
  InstallStepValue,
  { tone: keyof typeof TONE; icon: IconName }
> = {
  COMPLETED: { tone: 'ok', icon: 'check' },
  FAIL: { tone: 'err', icon: 'x-circle' },
  IN_PROGRESS: { tone: 'info', icon: 'loader' },
  BDC_INSTALL_REQUIRED: { tone: 'off', icon: 'clock' },
  SKIP: { tone: 'off', icon: 'ban' },
  UNKNOWN: { tone: 'off', icon: 'clock' },
};

/**
 * 알약에 찍히는 낱말. 단계가 제 어휘를 가지면(Azure PE 승인) 그것이 이기고, 아니면 공용
 * 상태 낱말이다 — 서비스 화면이 같은 셀에 찍는 낱말과 같아야 두 화면이 한 말을 한다.
 */
export const installStatusLabel = (step: InstallGateStep): string =>
  step.labels?.[step.worst] ?? INSTALL_COPY.ko.stepValue[step.worst];
