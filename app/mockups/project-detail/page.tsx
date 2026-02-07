'use client';

/**
 * Project Detail Mockup — Compare Index (v3)
 *
 * UX 공통: 좌측 패널(기본정보) + 프로세스 노드 그래프(재연동 분기) + 리소스 항상 노출
 */

import Link from 'next/link';

const designs = [
  {
    id: 'A',
    href: '/mockups/project-detail/a',
    name: 'Clean Ledger',
    nameKr: '클린 원장',
    concept: '따뜻한 에디토리얼 보고서 스타일. 세리프 헤딩과 수평선으로 정보 위계 구성',
    tone: '차분한 · 신뢰감 · 에디토리얼',
    strength: '신뢰 — 문서 같은 구조가 정확한 정보 전달감을 줌',
    audience: '서비스 담당자, 보고서/감사 목적',
    risk: '정보 밀도가 낮아 보일 수 있음',
    color: '#4338ca',
    bg: '#f8f7f4',
  },
  {
    id: 'B',
    href: '/mockups/project-detail/b',
    name: 'Flat Ops',
    nameKr: '플랫 옵스',
    concept: '극도로 절제된 모노크롬. 장식 없이 데이터에 바로 집중',
    tone: '절제된 · 빠른 · 기능적',
    strength: '속도 — 최소 요소로 최대 정보 전달. 운영자 특화',
    audience: '빠른 스캔이 중요한 운영자, 다수 과제 관리',
    risk: '시각적으로 밋밋할 수 있음',
    color: '#111111',
    bg: '#fafafa',
  },
  {
    id: 'C',
    href: '/mockups/project-detail/c',
    name: 'Split Panel',
    nameKr: '스플릿 패널',
    concept: '다크 좌측 사이드바 + 라이트 메인 영역. 틸 컬러 강조, 듀얼톤 구성',
    tone: '구조적 · 직관적 · 듀얼톤',
    strength: '몰입 — 다크 패널이 기본정보를 고정, 메인에 집중하도록 유도',
    audience: '프로세스 추적이 중요한 엔지니어, 설치 담당',
    risk: '좌측 패널이 좁은 화면에서 공간 압박',
    color: '#14b8a6',
    bg: '#18181b',
  },
];

export default function MockupIndexPage() {
  return (
    <div className="min-h-screen p-8" style={{ background: '#f5f5f5', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Project Detail — 디자인 시안 비교 v3</h1>
        <p className="text-sm text-gray-500 mb-2">A/B/C 시안을 브라우저에서 직접 확인하고 방향성을 선택하세요.</p>
        <div className="text-xs text-gray-400 mb-8 p-3 rounded-lg" style={{ background: '#fff', border: '1px solid #e5e5e5' }}>
          <span className="font-semibold text-gray-600">v3 공통 UX:</span>
          {' '}좌측 패널(기본정보) · 프로세스 노드 그래프(재연동 분기 포함) · 리소스 테이블 항상 노출 · 탭 없음
        </div>

        <div className="grid gap-4">
          {designs.map((d) => (
            <Link
              key={d.id}
              href={d.href}
              className="group block rounded-xl overflow-hidden transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: '#fff', outlineColor: d.color }}
            >
              <div className="flex">
                <div className="w-2 shrink-0" style={{ background: d.color }} />
                <div className="flex-1 p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold w-7 h-7 rounded flex items-center justify-center" style={{ background: d.bg, color: d.color, border: `1px solid ${d.color}30` }}>
                      {d.id}
                    </span>
                    <h2 className="text-lg font-bold">{d.name}</h2>
                    <span className="text-sm text-gray-400">{d.nameKr}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: `${d.color}15`, color: d.color }}>{d.tone}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{d.concept}</p>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="font-medium text-gray-400 uppercase tracking-wider">강점</span>
                      <p className="text-gray-700 mt-0.5">{d.strength}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-400 uppercase tracking-wider">추천 대상</span>
                      <p className="text-gray-700 mt-0.5">{d.audience}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-400 uppercase tracking-wider">리스크</span>
                      <p className="text-gray-700 mt-0.5">{d.risk}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center px-4 text-gray-300 group-hover:text-gray-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
