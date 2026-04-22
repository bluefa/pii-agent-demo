import type { CloudProvider } from '@/lib/types';

/**
 * 사전 조치 항목의 상세 가이드
 */
export interface PrerequisiteGuide {
  label: string;           // 접힌 상태 제목 (예: "스캔 Role 등록")
  summary: string;         // 한 줄 요약
  steps: string[];         // 상세 절차 (번호 매김)
  warnings?: string[];
  notes?: string[];
}

/**
 * GuideCard 본문에 렌더할 인라인 파트 (일반 텍스트 / 강조 / 링크)
 */
export type GuideInline =
  | string
  | { strong: string }
  | { link: string; href: string };

/**
 * GuideCard 본문 콘텐츠 (프로토타입 L1453-1518 GUIDES 구조)
 */
export interface StepGuideContent {
  heading: string;          // <h4> 제목
  summary: GuideInline[];   // <p> 요약 인라인 파트
  bullets: GuideInline[][]; // <ul><li> 목록, 각 항목은 인라인 파트 배열
}

/**
 * 프로세스 가이드 단계의 상세 내용
 * stepNumber 는 `ProcessStatus` enum 값(1-7)과 정렬된다.
 */
export interface ProcessGuideStep {
  stepNumber: number;
  label: string;           // 단계 명칭 (예: "연동 대상 확정")
  description: string;     // 1-2줄 요약
  prerequisites?: string[];           // 사전 조치 (단순 텍스트)
  prerequisiteGuides?: PrerequisiteGuide[];  // 사전 조치 상세 가이드 (아코디언 UI)
  procedures?: string[];     // 수행 절차 (번호 매긴 스텝)
  warnings?: string[];       // 주의사항
  notes?: string[];          // 참고사항 (ⓘ 형태)
  guide?: StepGuideContent;  // GuideCard(warm variant) 렌더 콘텐츠
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
