import type { CloudProvider } from '@/lib/types';

/**
 * 프로세스 가이드 단계의 상세 내용
 */
export interface ProcessGuideStep {
  stepNumber: number;
  label: string;           // 단계 명칭 (예: "연동 대상 확정")
  description: string;     // 1-2줄 요약
  prerequisites?: string[];  // 사전 조치 사항
  procedures?: string[];     // 수행 절차 (번호 매긴 스텝)
  warnings?: string[];       // 주의사항
  notes?: string[];          // 참고사항 (ⓘ 형태)
}

/**
 * Cloud Provider별 전체 프로세스 가이드
 */
export interface ProviderProcessGuide {
  provider: CloudProvider;
  variant: string;           // 설치 방식 구분 (예: 'auto' | 'manual' | 'db-only' | 'db-vm' | 'basic' | 'subnet')
  title: string;             // 모달 제목용 (예: "AWS 자동 설치")
  steps: ProcessGuideStep[];
}
