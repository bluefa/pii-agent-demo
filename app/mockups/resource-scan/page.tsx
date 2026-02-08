'use client';

/**
 * Resource & Scan Mockup — 비교 인덱스
 *
 * 리소스 목록 + 스캔 기능의 디자인 시안 A/B/C 비교 페이지.
 * /mockups/resource-scan 에서 접근.
 */

import Link from 'next/link';

const designs = [
  {
    id: 'a',
    title: 'A — Fluent Dashboard',
    description: 'Microsoft Fluent 영감. 통합 대시보드 뷰 — 스캔과 리소스를 하나의 흐름으로. 상단 커맨드 바 + 통계 카드 + 인라인 테이블.',
    accent: '#0078D4',
    tone: 'Clean, structured, enterprise-grade',
  },
  {
    id: 'b',
    title: 'B — Inventory Ledger',
    description: '인벤토리 관리자 UX. 리소스 타입별 카드 그리드 + 사이드 패널 상세. 스캔은 floating action으로 분리.',
    accent: '#0F172A',
    tone: 'Data-dense, scannable, utilitarian',
  },
  {
    id: 'c',
    title: 'C — Split Workflow',
    description: '좌우 분할 레이아웃. 좌측: 스캔 타임라인 + 결과 시각화. 우측: 리소스 목록 + 필터. 스캔↔리소스 연결이 명확.',
    accent: '#059669',
    tone: 'Workflow-oriented, visual, connected',
  },
];

export default function ResourceScanMockupIndex() {
  return (
    <div className="min-h-screen" style={{ background: '#f8fafc', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <div className="max-w-5xl mx-auto px-8 py-12">
        <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>
          Resource & Scan — 디자인 시안
        </h1>
        <p className="text-sm mt-2" style={{ color: '#64748b' }}>
          현재 리소스 목록과 스캔 UI의 UX 개선안. 3가지 방향을 비교합니다.
        </p>

        {/* UX Problems */}
        <div className="mt-8 p-6 rounded-xl" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#ef4444' }}>
            현재 UX 문제점
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm" style={{ color: '#334155' }}>
            <div className="flex gap-3">
              <span style={{ color: '#ef4444' }}>1.</span>
              <div>
                <strong>스캔↔리소스 단절</strong>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                  스캔 결과와 리소스 테이블이 별개 섹션. 신규 발견 리소스가 어디 있는지 즉시 파악 불가.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span style={{ color: '#ef4444' }}>2.</span>
              <div>
                <strong>상태 한눈에 안 보임</strong>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                  12개 리소스 중 연결/끊김/대기 비율을 파악하려면 테이블 전체를 스크롤해야 함.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span style={{ color: '#ef4444' }}>3.</span>
              <div>
                <strong>리소스 타입 구분 약함</strong>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                  ResourceTypeGroup 헤더가 시각적으로 약해 RDS 5개 vs DynamoDB 3개 비율 인지 어려움.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span style={{ color: '#ef4444' }}>4.</span>
              <div>
                <strong>스캔 이력 접근성</strong>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                  이력 보기가 토글 버튼으로 숨겨져 있어 트렌드 파악이 불편. 이전 스캔과 비교 불가.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span style={{ color: '#ef4444' }}>5.</span>
              <div>
                <strong>필터가 2탭만</strong>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                  연동 대상/전체 외에 상태(연결/끊김), 타입별, 신규 등 필터 부재.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span style={{ color: '#ef4444' }}>6.</span>
              <div>
                <strong>Credential 매핑 UX</strong>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                  어떤 DB가 credential이 필요한지 직관적이지 않음. 도움말 툴팁에 의존.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Design Cards */}
        <div className="mt-10 grid grid-cols-3 gap-6">
          {designs.map((d) => (
            <Link
              key={d.id}
              href={`/mockups/resource-scan/${d.id}`}
              className="group block rounded-xl overflow-hidden transition-all hover:-translate-y-1"
              style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              {/* Color bar */}
              <div className="h-2" style={{ background: d.accent }} />
              <div className="p-5">
                <h3 className="text-base font-bold" style={{ color: '#0f172a' }}>{d.title}</h3>
                <p className="text-xs mt-1" style={{ color: d.accent, fontWeight: 600 }}>{d.tone}</p>
                <p className="text-sm mt-3" style={{ color: '#64748b' }}>{d.description}</p>
                <div className="mt-4 text-sm font-medium group-hover:underline" style={{ color: d.accent }}>
                  시안 보기 →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Review Checklist */}
        <div className="mt-10 p-6 rounded-xl" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#64748b' }}>
            리뷰 체크리스트
          </h2>
          <div className="space-y-2 text-sm" style={{ color: '#334155' }}>
            {[
              '스캔 결과 → 리소스 목록 연결이 직관적인가?',
              '리소스 12개 이상일 때 한눈에 상태 파악 가능한가?',
              '리소스 타입별 분포가 즉시 인지되는가?',
              '스캔 이력과 트렌드를 쉽게 확인할 수 있는가?',
              '필터/검색이 실제 운영 시나리오에 충분한가?',
              'Credential 매핑이 직관적인가?',
            ].map((item, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
