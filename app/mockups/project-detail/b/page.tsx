'use client';

/**
 * Mockup B — "Flat Ops" (플랫 옵스) v3
 *
 * 컨셉: 극도로 절제된 모노크롬. 장식 없이 데이터에 집중.
 * UX: 좌측 패널(기본정보) + 프로세스 노드 그래프(재연동) + 리소스 항상 노출
 *
 * ⚠️ 목업 전용 — theme.ts 토큰 대신 자체 컬러 시스템 사용 (디자인 탐색 목적)
 */

import { useState } from 'react';
import {
  MOCK_PROJECT,
  MOCK_RESOURCES,
  MOCK_CREDENTIALS,
  MOCK_TEST_HISTORY,
  MOCK_HISTORY,
  PROCESS_NODES,
  PROCESS_EDGES,
  REGION_MAP,
  CONNECTION_LABEL,
} from '@/app/mockups/project-detail/_data';

// ─── Design Tokens ───────────────────────────────────────────────
const C = {
  bg: '#fafafa',
  surface: '#ffffff',
  text: '#111111',
  sub: '#555555',
  muted: '#999999',
  border: '#e5e5e5',
  accent: '#111111',
  blue: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#d97706',
  ghost: '#f5f5f5',
} as const;

type ViewState = 'normal' | 'loading' | 'error' | 'empty';

const sans = 'var(--font-geist-sans), system-ui, -apple-system, sans-serif';
const mono = 'var(--font-geist-mono), monospace';

// ─── Sub-components ──────────────────────────────────────────────

const Label = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: C.muted }}>{children}</h3>
);

const Skeleton = ({ w = 'w-24', h = 'h-3.5' }: { w?: string; h?: string }) => (
  <div className={`${w} ${h} rounded-sm animate-pulse`} style={{ background: C.border }} />
);

const Pill = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color, background: `${color}12` }}>{children}</span>
);

const connColor = (s: string) => s === 'CONNECTED' ? C.green : s === 'DISCONNECTED' ? C.red : C.muted;

// ─── Process Graph ──────────────────────────────────────────────
const ProcessGraph = () => {
  const nodeW = 96;
  const nodeH = 36;
  const gapX = 24;
  const startX = 16;
  const startY = 24;
  const totalW = PROCESS_NODES.length * (nodeW + gapX) + 32;

  const positions = PROCESS_NODES.map((_, i) => ({
    x: startX + i * (nodeW + gapX),
    y: startY,
  }));

  const findIdx = (id: string) => PROCESS_NODES.findIndex(n => n.id === id);

  const nodeStyle = (status: string) => {
    if (status === 'done') return { fill: C.accent, stroke: C.accent, textColor: '#fff' };
    if (status === 'current') return { fill: '#fff', stroke: C.blue, textColor: C.blue };
    return { fill: C.ghost, stroke: C.border, textColor: C.muted };
  };

  return (
    <div className="overflow-x-auto -mx-1">
      <svg width={totalW} height={120} className="block">
        {/* Forward edges */}
        {PROCESS_EDGES.filter(e => e.type === 'forward').map((e) => {
          const fi = findIdx(e.from);
          const ti = findIdx(e.to);
          if (fi < 0 || ti < 0) return null;
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={positions[fi].x + nodeW}
              y1={positions[fi].y + nodeH / 2}
              x2={positions[ti].x}
              y2={positions[ti].y + nodeH / 2}
              stroke={PROCESS_NODES[fi].status === 'done' ? C.accent : C.border}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Reconnect edge */}
        {PROCESS_EDGES.filter(e => e.type === 'reconnect').map((e) => {
          const fi = findIdx(e.from);
          const ti = findIdx(e.to);
          if (fi < 0 || ti < 0) return null;
          const fromX = positions[fi].x + nodeW / 2;
          const toX = positions[ti].x + nodeW / 2;
          const bottomY = startY + nodeH + 22;
          const midX = (fromX + toX) / 2;
          return (
            <g key={`reconnect-${e.from}-${e.to}`}>
              <path
                d={`M ${fromX} ${startY + nodeH} L ${fromX} ${bottomY} Q ${midX} ${bottomY + 16} ${toX} ${bottomY} L ${toX} ${startY + nodeH}`}
                fill="none"
                stroke={C.muted}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <polygon
                points={`${toX - 3},${startY + nodeH + 6} ${toX},${startY + nodeH} ${toX + 3},${startY + nodeH + 6}`}
                fill={C.muted}
              />
              <text x={midX} y={bottomY + 12} textAnchor="middle" fontSize={9} fill={C.muted} fontFamily={sans}>
                {e.label}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {PROCESS_NODES.map((n, i) => {
          const pos = positions[i];
          const st = nodeStyle(n.status);
          return (
            <g key={n.id}>
              <rect
                x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={4}
                fill={st.fill} stroke={st.stroke}
                strokeWidth={n.status === 'current' ? 2 : 1}
              />
              <text
                x={pos.x + nodeW / 2}
                y={pos.y + nodeH / 2 + 4}
                textAnchor="middle"
                fontSize={10}
                fill={st.textColor}
                fontWeight={n.status === 'current' ? 600 : 400}
                fontFamily={sans}
              >
                {n.status === 'done' ? `✓ ${n.label}` : n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─── Main ────────────────────────────────────────────────────────
export default function MockupBPage() {
  const [viewState, setViewState] = useState<ViewState>('normal');
  const [showDelete, setShowDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const p = MOCK_PROJECT;
  const resources = viewState === 'empty' ? [] : MOCK_RESOURCES;

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: sans }}>
      {/* State Preview */}
      <div className="flex items-center gap-1.5 px-6 py-1.5 text-[11px]" style={{ borderBottom: `1px solid ${C.border}` }}>
        {(['normal', 'loading', 'error', 'empty'] as ViewState[]).map((s) => (
          <button
            key={s}
            onClick={() => setViewState(s)}
            className="px-2 py-0.5 rounded transition-colors"
            style={{ background: viewState === s ? C.accent : 'transparent', color: viewState === s ? '#fff' : C.muted }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Header */}
      <header className="px-6 pt-8 pb-5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <nav className="flex items-center gap-1 text-[11px] mb-3" style={{ color: C.muted }}>
          <span>관리자</span><span>·</span><span>{p.serviceCode}</span><span>·</span>
          <span style={{ color: C.text }}>{p.projectCode}</span>
        </nav>
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">{p.name}</h1>
          <Pill color={C.blue}>{p.cloudProvider}</Pill>
          <Pill color={C.amber}>연결 테스트 필요</Pill>
        </div>
        <p className="text-sm mt-1.5" style={{ color: C.sub }}>{p.description}</p>
      </header>

      {/* Error */}
      {viewState === 'error' && (
        <div className="px-6 py-20 text-center">
          <p className="text-sm font-medium" style={{ color: C.red }}>과제 데이터를 불러올 수 없습니다</p>
          <p className="text-xs mt-1" style={{ color: C.muted }}>네트워크 상태를 확인하세요.</p>
          <button onClick={() => setViewState('normal')} className="mt-3 text-xs font-medium px-3 py-1.5 rounded" style={{ border: `1px solid ${C.border}` }}>재시도</button>
        </div>
      )}

      {viewState !== 'error' && (
        <div className="flex px-6 py-6 gap-8">
          {/* ══ LEFT PANEL ══ */}
          <aside className="w-56 shrink-0">
            <Label>기본 정보</Label>
            {viewState === 'loading' ? (
              <div className="space-y-2.5">{[1,2,3,4].map(i => <Skeleton key={i} w="w-full" />)}</div>
            ) : (
              <div className="space-y-1.5 text-sm">
                {[
                  ['과제 코드', p.projectCode],
                  ['서비스', p.serviceCode],
                  ['Cloud', p.cloudProvider],
                  ['설치 모드', '자동 설치'],
                  ['생성일', new Date(p.createdAt).toLocaleDateString('ko-KR')],
                  ['리소스', `${resources.length}건`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-1" style={{ borderBottom: `1px solid ${C.ghost}` }}>
                    <span style={{ color: C.muted }}>{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Connection Summary */}
            <div className="mt-6">
              <Label>연결 요약</Label>
              {viewState !== 'loading' && (
                <div className="flex gap-4">
                  {[
                    { label: '연결', count: resources.filter(r => r.connectionStatus === 'CONNECTED').length, color: C.green },
                    { label: '끊김', count: resources.filter(r => r.connectionStatus === 'DISCONNECTED').length, color: C.red },
                    { label: '대기', count: resources.filter(r => r.connectionStatus === 'PENDING').length, color: C.muted },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className="text-lg font-bold tabular-nums" style={{ color: s.color, fontFamily: mono }}>{s.count}</div>
                      <div className="text-[10px]" style={{ color: C.muted }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Danger */}
            <div className="mt-6">
              <Label>위험 영역</Label>
              {!showDelete ? (
                <button onClick={() => setShowDelete(true)} className="text-xs" style={{ color: C.red }}>과제 삭제 →</button>
              ) : (
                <div className="py-3 px-3 rounded" style={{ background: `${C.red}08`, border: `1px solid ${C.red}20` }}>
                  <p className="text-xs" style={{ color: C.red }}>되돌릴 수 없습니다.</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setShowDelete(false)} className="px-2 py-1 rounded text-xs" style={{ border: `1px solid ${C.border}` }}>취소</button>
                    <button className="px-2 py-1 rounded text-xs font-semibold" style={{ background: C.red, color: '#fff' }}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ══ MAIN CONTENT ══ */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Process Graph */}
            <div>
              <Label>프로세스</Label>
              {viewState === 'loading' ? <Skeleton w="w-full" h="h-16" /> : <ProcessGraph />}
            </div>

            {/* Resource Table — ALWAYS VISIBLE */}
            <div>
              <Label>리소스 ({resources.length})</Label>
              {viewState === 'loading' ? (
                <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} w="w-full" h="h-9" />)}</div>
              ) : resources.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm" style={{ color: C.muted }}>리소스가 없습니다</p>
                  <button className="mt-2 text-xs font-medium" style={{ color: C.blue }}>스캔 실행 →</button>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {['', '리소스 ID', '타입', 'DB', '리전', '상태', 'Credential'].map((h) => (
                        <th key={h} className="text-left py-2 font-medium" style={{ color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((r) => (
                      <tr
                        key={r.id}
                        className="group transition-colors"
                        style={{ borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.ghost)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td className="py-2.5 pr-2">
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: connColor(r.connectionStatus) }} />
                        </td>
                        <td className="py-2.5 font-medium" style={{ fontFamily: mono }}>{r.resourceId}</td>
                        <td className="py-2.5" style={{ color: C.sub }}>{r.awsType}</td>
                        <td className="py-2.5">{r.databaseType}</td>
                        <td className="py-2.5" style={{ color: C.sub }}>{REGION_MAP[r.region] ?? r.region}</td>
                        <td className="py-2.5">
                          <span style={{ color: connColor(r.connectionStatus) }}>{CONNECTION_LABEL[r.connectionStatus]?.text}</span>
                          {r.isNew && <Pill color={C.blue}>NEW</Pill>}
                        </td>
                        <td className="py-2.5" style={{ color: C.muted }}>{r.selectedCredentialId ? MOCK_CREDENTIALS.find(c => c.id === r.selectedCredentialId)?.name ?? '-' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Connection Test */}
            {MOCK_TEST_HISTORY.length > 0 && viewState === 'normal' && (
              <div>
                <Label>최근 테스트</Label>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px]" style={{ color: C.muted }}>
                    {new Date(MOCK_TEST_HISTORY[0].executedAt).toLocaleString('ko-KR')}
                  </span>
                  <Pill color={C.red}>{MOCK_TEST_HISTORY[0].failCount}건 실패</Pill>
                </div>
                <div className="space-y-1">
                  {MOCK_TEST_HISTORY[0].results.map((r) => (
                    <div key={r.resourceId} className="flex items-center gap-3 text-xs py-1">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.success ? C.green : C.red }} />
                      <span style={{ color: C.sub }}>{r.resourceType}</span>
                      <span style={{ color: C.muted }}>{r.databaseType}</span>
                      {!r.success && <span className="ml-auto text-[10px]" style={{ color: C.red }}>{r.error?.message}</span>}
                    </div>
                  ))}
                </div>
                <button className="mt-3 w-full py-2 rounded text-xs font-semibold" style={{ background: C.accent, color: '#fff' }}>
                  연결 테스트 재실행
                </button>
              </div>
            )}

            {/* History (collapsible) */}
            {viewState === 'normal' && (
              <div>
                <button onClick={() => setHistoryOpen(!historyOpen)} className="flex items-center gap-1.5">
                  <Label>진행 내역</Label>
                  <svg className={`w-2.5 h-2.5 -mt-2 transition-transform ${historyOpen ? 'rotate-90' : ''}`} fill="none" stroke={C.muted} viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {historyOpen && (
                  <div>
                    {MOCK_HISTORY.map((h) => (
                      <div key={h.id} className="flex items-center gap-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: h.type === 'APPROVAL' ? C.green : C.blue }} />
                        <time className="text-[11px] tabular-nums shrink-0" style={{ color: C.muted, fontFamily: mono }}>
                          {new Date(h.timestamp).toLocaleDateString('ko-KR')}
                        </time>
                        <span className="text-xs font-medium">{h.actor}</span>
                        <span className="text-xs" style={{ color: C.sub }}>{h.detail}</span>
                        <Pill color={h.type === 'APPROVAL' ? C.green : C.accent}>
                          {h.type === 'APPROVAL' ? '승인' : '확정'}
                        </Pill>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) { .animate-pulse { animation: none !important; } }
      `}</style>
    </div>
  );
}
