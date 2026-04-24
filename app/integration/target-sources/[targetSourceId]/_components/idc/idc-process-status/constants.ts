import { ProcessStatus } from '@/lib/types';

// IDC 는 승인 단계 없음 — 4단계 flow.
export const idcSteps = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '리소스 등록' },
  { step: ProcessStatus.INSTALLING, label: '환경 구성' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
];

export const BDC_SERVER_IP = '10.100.50.10';

export interface FirewallRule {
  sourceIp: string;
  destinationIp: string;
  port: number;
}
