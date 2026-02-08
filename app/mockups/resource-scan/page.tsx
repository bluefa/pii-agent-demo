'use client';

/**
 * Resource & Scan Mockup v2 — 비교 인덱스
 *
 * 프로젝트 상세 페이지 컨텍스트 안에서 ScanPanel + ResourceTable 영역 개선.
 * Fluent 2 디자인 토큰 기반.
 */

import Link from 'next/link';
import { F } from './_data';

const designs = [
  {
    id: 'a',
    title: 'A — Unified Command',
    description: '스캔+리소스를 하나의 통합 카드로. 스캔 결과 요약이 리소스 테이블 헤더와 직접 연결. Fluent CommandBar 패턴 활용.',
    tone: 'Fluent 2 정통 — clean, structured',
  },
  {
    id: 'b',
    title: 'B — Status Dashboard',
    description: '리소스 상태 요약 카드를 ScanPanel과 ResourceTable 사이에 배치. 타입별 분포 + 연결 상태를 한눈에. 카드 클릭 → 테이블 필터.',
    tone: 'Data-first — 즉시 파악 가능한 요약',
  },
  {
    id: 'c',
    title: 'C — Inline Enriched',
    description: '기존 레이아웃 유지하되 ScanPanel에 인라인 시각화 추가, ResourceTable에 다중 필터+검색+타입별 상태 바. 최소 변경으로 최대 개선.',
    tone: 'Progressive — 기존 구조 위에 점진적 개선',
  },
];

const problems = [
  { num: 1, title: '스캔↔리소스 단절', desc: '스캔 결과와 리소스 테이블이 별개 섹션. 신규 발견 리소스가 어디 있는지 즉시 파악 불가.' },
  { num: 2, title: '상태 한눈에 안 보임', desc: '12개 리소스 중 연결/끊김/대기 비율을 파악하려면 테이블 전체를 스크롤해야 함.' },
  { num: 3, title: '리소스 타입 구분 약함', desc: 'ResourceTypeGroup 헤더가 시각적으로 약해 RDS 5개 vs DynamoDB 3개 비율 인지 어려움.' },
  { num: 4, title: '스캔 이력 접근성', desc: '이력 보기가 토글 버튼으로 숨겨져 있어 트렌드 파악 불편.' },
  { num: 5, title: '필터가 2탭만', desc: '연동 대상/전체 외에 상태(연결/끊김), 타입별, 신규 등 필터 부재.' },
  { num: 6, title: 'Credential 매핑 UX', desc: '어떤 DB가 credential이 필요한지 직관적이지 않음. 도움말 툴팁에 의존.' },
];

export default function ResourceScanMockupIndex() {
  return (
    <div style={{ minHeight: '100vh', background: F.bg3, fontFamily: F.fontBase, color: F.fg1 }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 32px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>ScanPanel + ResourceTable — 디자인 개선안 v2</h1>
        <p style={{ fontSize: 14, color: F.fg3, marginTop: 8 }}>
          프로젝트 상세 페이지 컨텍스트 안에서 ScanPanel + ResourceTable 영역 개선. Fluent 2 디자인 토큰 기반.
        </p>

        {/* UX 문제점 */}
        <div style={{ marginTop: 32, background: F.bg1, borderRadius: F.radiusXl, border: `1px solid ${F.stroke2}`, padding: 24 }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: F.error, marginBottom: 16 }}>
            현재 UX 문제점
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {problems.map((p) => (
              <div key={p.num} style={{ display: 'flex', gap: 12, fontSize: 14 }}>
                <span style={{ color: F.error, fontWeight: 600, flexShrink: 0 }}>{p.num}.</span>
                <div>
                  <strong>{p.title}</strong>
                  <p style={{ fontSize: 12, color: F.fg4, marginTop: 2 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 시안 카드 */}
        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          {designs.map((d) => (
            <Link
              key={d.id}
              href={`/mockups/resource-scan/${d.id}`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block', background: F.bg1, borderRadius: F.radiusXl, border: `1px solid ${F.stroke2}`, overflow: 'hidden', transition: 'box-shadow 0.2s' }}
            >
              <div style={{ height: 4, background: F.brand }} />
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{d.title}</h3>
                <p style={{ fontSize: 11, color: F.brand, fontWeight: 600, marginTop: 4 }}>{d.tone}</p>
                <p style={{ fontSize: 13, color: F.fg3, marginTop: 12 }}>{d.description}</p>
                <div style={{ marginTop: 16, fontSize: 13, fontWeight: 600, color: F.brand }}>시안 보기 →</div>
              </div>
            </Link>
          ))}
        </div>

        {/* 페이지 구조 비교 */}
        <div style={{ marginTop: 40, background: F.bg1, borderRadius: F.radiusXl, border: `1px solid ${F.stroke2}`, padding: 24 }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: F.fg3, marginBottom: 16 }}>
            프로젝트 상세 페이지 내 위치
          </h2>
          <div style={{ fontFamily: F.fontMono, fontSize: 12, lineHeight: 1.8, color: F.fg3 }}>
            <div>ProjectHeader</div>
            <div>├─ ProjectInfoCard + ProcessStatusCard</div>
            <div style={{ color: F.brand, fontWeight: 600 }}>├─ ScanPanel ← 개선 대상</div>
            <div style={{ color: F.brand, fontWeight: 600 }}>├─ ResourceTable ← 개선 대상</div>
            <div>├─ RejectionAlert</div>
            <div>└─ ActionButtons</div>
          </div>
        </div>
      </div>
    </div>
  );
}
