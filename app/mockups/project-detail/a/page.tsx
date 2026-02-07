'use client';

/**
 * Mockup A — "Clean Ledger" (클린 원장) v3
 *
 * 컨셉: 따뜻한 에디토리얼 보고서. 세리프 헤딩, 수평선 디바이더.
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
  bg: '#f8f7f4',
  surface: '#ffffff',
  text: '#1c1917',
  muted: '#a8a29e',
  mutedDark: '#78716c',
  border: '#e7e5e0',
  borderDark: '#d6d3d1',
  accent: '#4338ca',
  accentLight: '#eef2ff',
  success: '#15803d',
  error: '#b91c1c',
  errorLight: '#fef2f2',
  warning: '#a16207',
  pending: '#9ca3af',
} as const;

type ViewState = 'normal' | 'loading' | 'error' | 'empty';

const serif = 'Georgia, "Noto Serif KR", "Times New Roman", serif';
const sans = 'var(--font-geist-sans), system-ui, sans-serif';

// ─── Sub-components ──────────────────────────────────────────────

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xs font-semibold tracking-[0.2em] uppercase pb-2 mb-4" style={{ color: C.mutedDark, borderBottom: `1px solid ${C.border}`, fontFamily: sans, letterSpacing: '0.2em' }}>
    {children}
  </h2>
);

const StatusDot = ({ status }: { status: string }) => {
  const color = status === 'CONNECTED' ? C.success : status === 'DISCONNECTED' ? C.error : C.pending;
  return <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />;
};

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`rounded ${className}`} style={{ background: C.border, animation: 'ledgerPulse 2s infinite' }} />
);

const InfoRow = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-baseline justify-between py-2" style={{ borderBottom: `1px solid ${C.bg}` }}>
    <span className="text-sm" style={{ color: C.mutedDark }}>{label}</span>
    <span className={`text-sm ${mono ? 'font-mono' : ''}`} style={{ color: C.text, fontWeight: 500 }}>{value}</span>
  </div>
);

const nodeColor = (status: string) => {
  if (status === 'done') return { bg: C.accent, text: '#fff', border: C.accent };
  if (status === 'current') return { bg: C.accentLight, text: C.accent, border: C.accent };
  return { bg: C.bg, text: C.muted, border: C.border };
};

// ─── Process Graph ──────────────────────────────────────────────
const ProcessGraph = () => {
  const nodeW = 100;
  const nodeH = 48;
  const gapX = 32;
  const startX = 20;
  const startY = 30;
  const totalW = PROCESS_NODES.length * (nodeW + gapX) + 40;

  const nodePositions = PROCESS_NODES.map((_, i) => ({
    x: startX + i * (nodeW + gapX),
    y: startY,
  }));

  const nodeIndex = (id: string) => PROCESS_NODES.findIndex(n => n.id === id);

  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={140} className="block">
        {/* Forward edges */}
        {PROCESS_EDGES.filter(e => e.type === 'forward').map((e) => {
          const fi = nodeIndex(e.from);
          const ti = nodeIndex(e.to);
          if (fi < 0 || ti < 0) return null;
          const fromDone = PROCESS_NODES[fi].status === 'done';
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={nodePositions[fi].x + nodeW}
              y1={nodePositions[fi].y + nodeH / 2}
              x2={nodePositions[ti].x}
              y2={nodePositions[ti].y + nodeH / 2}
              stroke={fromDone ? C.accent : C.border}
              strokeWidth={2}
            />
          );
        })}

        {/* Reconnect edge (curved, dashed) */}
        {PROCESS_EDGES.filter(e => e.type === 'reconnect').map((e) => {
          const fi = nodeIndex(e.from);
          const ti = nodeIndex(e.to);
          if (fi < 0 || ti < 0) return null;
          const fromX = nodePositions[fi].x + nodeW / 2;
          const toX = nodePositions[ti].x + nodeW / 2;
          const bottomY = startY + nodeH + 30;
          const midX = (fromX + toX) / 2;
          return (
            <g key={`reconnect-${e.from}-${e.to}`}>
              <path
                d={`M ${fromX} ${startY + nodeH} L ${fromX} ${bottomY} Q ${midX} ${bottomY + 20} ${toX} ${bottomY} L ${toX} ${startY + nodeH}`}
                fill="none"
                stroke={C.mutedDark}
                strokeWidth={1.5}
                strokeDasharray="6 3"
              />
              <polygon
                points={`${toX - 4},${startY + nodeH + 8} ${toX},${startY + nodeH} ${toX + 4},${startY + nodeH + 8}`}
                fill={C.mutedDark}
              />
              <text x={midX} y={bottomY + 16} textAnchor="middle" fontSize={10} fill={C.mutedDark} fontFamily={sans}>
                {e.label}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {PROCESS_NODES.map((n, i) => {
          const pos = nodePositions[i];
          const col = nodeColor(n.status);
          return (
            <g key={n.id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={nodeW}
                height={nodeH}
                rx={8}
                fill={col.bg}
                stroke={col.border}
                strokeWidth={n.status === 'current' ? 2 : 1}
              />
              {n.status === 'done' && (
                <text x={pos.x + 12} y={pos.y + 20} fontSize={11} fill={col.text} fontFamily={sans}>✓</text>
              )}
              <text
                x={pos.x + nodeW / 2}
                y={pos.y + (n.status === 'done' ? 38 : 28)}
                textAnchor="middle"
                fontSize={11}
                fill={n.status === 'current' ? C.accent : n.status === 'done' ? '#fff' : C.muted}
                fontWeight={n.status === 'current' ? 600 : 400}
                fontFamily={sans}
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─── Main ────────────────────────────────────────────────────────
export default function MockupAPage() {
  const [viewState, setViewState] = useState<ViewState>('normal');
  const [showDelete, setShowDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const p = MOCK_PROJECT;
  const resources = viewState === 'empty' ? [] : MOCK_RESOURCES;
  const disconnected = resources.filter(r => r.connectionStatus === 'DISCONNECTED').length;
  const connected = resources.filter(r => r.connectionStatus === 'CONNECTED').length;
  const pending = resources.filter(r => r.connectionStatus === 'PENDING').length;

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: sans }}>
      {/* State Preview */}
      <div className="flex items-center gap-2 px-6 py-2 text-xs" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ color: C.muted }}>미리보기:</span>
        {(['normal', 'loading', 'error', 'empty'] as ViewState[]).map((s) => (
          <button
            key={s}
            onClick={() => setViewState(s)}
            className="px-2.5 py-0.5 rounded-full transition-colors"
            style={{ background: viewState === s ? C.accent : 'transparent', color: viewState === s ? '#fff' : C.mutedDark, border: viewState === s ? 'none' : `1px solid ${C.border}` }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Header */}
      <header className="max-w-6xl mx-auto px-8 pt-10 pb-6">
        <nav className="flex items-center gap-1.5 text-xs mb-6" style={{ color: C.muted }}>
          <span>관리자</span><span>›</span><span>{p.serviceCode}</span><span>›</span>
          <span style={{ color: C.text }}>{p.projectCode}</span>
        </nav>
        <h1 className="text-3xl font-normal leading-tight" style={{ fontFamily: serif }}>{p.name}</h1>
        <p className="text-sm mt-2" style={{ color: C.mutedDark }}>{p.description}</p>
        <hr className="mt-6" style={{ border: 'none', borderTop: `2px solid ${C.text}`, opacity: 0.1 }} />
      </header>

      {/* Error */}
      {viewState === 'error' && (
        <div className="max-w-6xl mx-auto px-8 py-20 text-center">
          <p className="text-lg" style={{ fontFamily: serif, color: C.error }}>오류가 발생했습니다</p>
          <p className="text-sm mt-2" style={{ color: C.mutedDark }}>과제 데이터를 불러올 수 없습니다.</p>
          <button onClick={() => setViewState('normal')} className="mt-5 px-5 py-2 text-sm rounded transition-colors" style={{ border: `1px solid ${C.borderDark}`, color: C.text }}>
            다시 시도
          </button>
        </div>
      )}

      {viewState !== 'error' && (
        <main className="max-w-6xl mx-auto px-8 pb-16">
          <div className="grid grid-cols-[280px_1fr] gap-10">
            {/* ══ LEFT PANEL ══ */}
            <aside>
              <SectionTitle>기본 정보</SectionTitle>
              {viewState === 'loading' ? (
                <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="w-full h-5" />)}</div>
              ) : (
                <div>
                  <InfoRow label="과제 코드" value={p.projectCode} mono />
                  <InfoRow label="서비스" value={p.serviceCode} />
                  <InfoRow label="클라우드" value={p.cloudProvider} />
                  <InfoRow label="설치 모드" value="자동 설치" />
                  <InfoRow label="생성일" value={new Date(p.createdAt).toLocaleDateString('ko-KR')} />
                  <InfoRow label="최종 수정" value={new Date(p.updatedAt).toLocaleDateString('ko-KR')} />
                </div>
              )}

              {/* Connection Summary in sidebar */}
              <div className="mt-8">
                <SectionTitle>연결 요약</SectionTitle>
                {viewState === 'loading' ? (
                  <Skeleton className="w-full h-16" />
                ) : (
                  <div className="space-y-2">
                    {[
                      { label: '연결됨', count: connected, color: C.success },
                      { label: '끊김', count: disconnected, color: C.error },
                      { label: '대기', count: pending, color: C.pending },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${C.bg}` }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                          <span className="text-sm" style={{ color: C.mutedDark }}>{s.label}</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums" style={{ color: s.color }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger */}
              <div className="mt-8">
                <SectionTitle>위험 영역</SectionTitle>
                {!showDelete ? (
                  <button onClick={() => setShowDelete(true)} className="text-sm underline underline-offset-4 decoration-1" style={{ color: C.error, textDecorationColor: `${C.error}40` }}>
                    이 과제를 삭제합니다
                  </button>
                ) : (
                  <div className="rounded-lg p-4" style={{ background: C.errorLight, border: `1px solid ${C.error}30` }}>
                    <p className="text-sm" style={{ color: C.error }}>되돌릴 수 없습니다.</p>
                    <div className="flex gap-3 mt-3">
                      <button onClick={() => setShowDelete(false)} className="px-4 py-2 text-sm rounded-lg" style={{ border: `1px solid ${C.border}` }}>취소</button>
                      <button className="px-4 py-2 text-sm font-medium rounded-lg" style={{ background: C.error, color: '#fff' }}>삭제 확인</button>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* ══ MAIN CONTENT ══ */}
            <div className="space-y-8">
              {/* Process Graph */}
              <div>
                <SectionTitle>프로세스 진행</SectionTitle>
                {viewState === 'loading' ? <Skeleton className="w-full h-24" /> : <ProcessGraph />}
              </div>

              {/* Resource Table — ALWAYS VISIBLE */}
              <div>
                <SectionTitle>리소스 ({resources.length})</SectionTitle>
                {viewState === 'loading' ? (
                  <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="w-full h-10" />)}</div>
                ) : resources.length === 0 ? (
                  <div className="text-center py-16" style={{ border: `1px dashed ${C.border}`, borderRadius: 8 }}>
                    <p style={{ fontFamily: serif, color: C.muted }}>등록된 리소스가 없습니다</p>
                    <button className="mt-3 text-sm underline" style={{ color: C.accent }}>리소스 스캔 시작하기</button>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {['', '리소스 ID', '타입', 'DB', '리전', '상태', 'Credential'].map((h) => (
                          <th key={h} className="text-left py-2 text-xs font-normal tracking-wider" style={{ color: C.mutedDark, borderBottom: `2px solid ${C.text}20` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-white" style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td className="py-3 pr-2"><StatusDot status={r.connectionStatus} /></td>
                          <td className="py-3 font-mono text-xs">{r.resourceId}</td>
                          <td className="py-3" style={{ color: C.mutedDark }}>{r.awsType}</td>
                          <td className="py-3">{r.databaseType}</td>
                          <td className="py-3" style={{ color: C.mutedDark }}>{REGION_MAP[r.region] ?? r.region}</td>
                          <td className="py-3">
                            <span style={{ color: r.connectionStatus === 'CONNECTED' ? C.success : r.connectionStatus === 'DISCONNECTED' ? C.error : C.pending }}>
                              {CONNECTION_LABEL[r.connectionStatus]?.text}
                            </span>
                            {r.isNew && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: C.accentLight, color: C.accent }}>NEW</span>}
                          </td>
                          <td className="py-3" style={{ color: C.muted }}>
                            {r.selectedCredentialId ? MOCK_CREDENTIALS.find(c => c.id === r.selectedCredentialId)?.name ?? '-' : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Connection Test */}
              {MOCK_TEST_HISTORY.length > 0 && viewState === 'normal' && (
                <div>
                  <SectionTitle>연결 테스트</SectionTitle>
                  <div className="rounded-lg p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs" style={{ color: C.muted }}>
                        {new Date(MOCK_TEST_HISTORY[0].executedAt).toLocaleString('ko-KR')} 실행
                      </span>
                      <span className="text-xs font-medium" style={{ color: C.error }}>{MOCK_TEST_HISTORY[0].failCount}건 실패</span>
                    </div>
                    <div className="space-y-2">
                      {MOCK_TEST_HISTORY[0].results.map((r) => (
                        <div key={r.resourceId} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: `1px solid ${C.bg}` }}>
                          <div className="flex items-center gap-2">
                            <StatusDot status={r.success ? 'CONNECTED' : 'DISCONNECTED'} />
                            <span>{r.resourceType}</span>
                            <span style={{ color: C.muted }}>·</span>
                            <span style={{ color: C.muted }}>{r.databaseType}</span>
                          </div>
                          {!r.success && r.error && <span className="text-xs" style={{ color: C.error }}>{r.error.message}</span>}
                        </div>
                      ))}
                    </div>
                    <button className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium" style={{ background: C.accent, color: '#fff' }}>
                      연결 테스트 재실행
                    </button>
                  </div>
                </div>
              )}

              {/* History (collapsible) */}
              {viewState === 'normal' && (
                <div>
                  <button onClick={() => setHistoryOpen(!historyOpen)} className="flex items-center gap-2 w-full text-left">
                    <h2 className="text-xs font-semibold tracking-[0.2em] uppercase pb-2" style={{ color: C.mutedDark, letterSpacing: '0.2em' }}>
                      진행 내역
                    </h2>
                    <svg className={`w-3 h-3 transition-transform ${historyOpen ? 'rotate-90' : ''}`} fill="none" stroke={C.mutedDark} viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {historyOpen && (
                    <div className="mt-2 space-y-0" style={{ borderTop: `1px solid ${C.border}` }}>
                      {MOCK_HISTORY.map((h, i) => (
                        <div key={h.id} className="flex gap-5 py-4" style={{ borderBottom: i < MOCK_HISTORY.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <time className="text-xs tabular-nums shrink-0 pt-0.5" style={{ color: C.muted, fontFamily: 'var(--font-geist-mono), monospace' }}>
                            {new Date(h.timestamp).toLocaleDateString('ko-KR')}
                          </time>
                          <div>
                            <p className="text-sm"><span className="font-medium">{h.actor}</span> — {h.detail}</p>
                            <span className="text-xs" style={{ color: C.muted }}>
                              {h.type === 'APPROVAL' ? '승인' : h.type === 'TARGET_CONFIRMED' ? '연동 확정' : h.type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      <style>{`
        @keyframes ledgerPulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
        @media (prefers-reduced-motion: reduce) { [style*="animation"] { animation: none !important; } }
      `}</style>
    </div>
  );
}
