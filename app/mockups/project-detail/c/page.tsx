'use client';

/**
 * Mockup C — "Split Panel" (스플릿 패널) v3
 *
 * 컨셉: 다크 좌측 사이드바(기본정보) + 라이트 우측 메인(프로세스 그래프 + 리소스).
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
  panelBg: '#18181b',
  panelText: '#fafafa',
  panelMuted: '#71717a',
  panelBorder: '#27272a',
  stepAccent: '#14b8a6',
  stepGlow: '#14b8a620',
  bg: '#f9fafb',
  surface: '#ffffff',
  text: '#111827',
  sub: '#6b7280',
  muted: '#9ca3af',
  border: '#e5e7eb',
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
} as const;

type ViewState = 'normal' | 'loading' | 'error' | 'empty';

const sans = 'var(--font-geist-sans), system-ui, sans-serif';
const mono = 'var(--font-geist-mono), monospace';

// ─── Sub-components ──────────────────────────────────────────────

const Skeleton = ({ w = 'w-24', h = 'h-3.5', dark = false }: { w?: string; h?: string; dark?: boolean }) => (
  <div className={`${w} ${h} rounded animate-pulse`} style={{ background: dark ? C.panelBorder : C.border }} />
);

const connColor = (s: string) => s === 'CONNECTED' ? C.green : s === 'DISCONNECTED' ? C.red : C.muted;

const Badge = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color, border: `1px solid ${color}30`, background: `${color}10` }}>{children}</span>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-semibold mb-3" style={{ color: C.sub }}>{children}</h3>
);

// ─── Process Graph ──────────────────────────────────────────────
const ProcessGraph = () => {
  const nodeW = 104;
  const nodeH = 42;
  const gapX = 28;
  const startX = 16;
  const startY = 28;
  const totalW = PROCESS_NODES.length * (nodeW + gapX) + 32;

  const positions = PROCESS_NODES.map((_, i) => ({
    x: startX + i * (nodeW + gapX),
    y: startY,
  }));

  const findIdx = (id: string) => PROCESS_NODES.findIndex(n => n.id === id);

  const nodeStyle = (status: string) => {
    if (status === 'done') return { fill: C.text, stroke: C.text, textColor: '#fff' };
    if (status === 'current') return { fill: `${C.stepAccent}15`, stroke: C.stepAccent, textColor: C.stepAccent };
    return { fill: C.bg, stroke: C.border, textColor: C.muted };
  };

  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={130} className="block">
        {/* Forward edges */}
        {PROCESS_EDGES.filter(e => e.type === 'forward').map((e) => {
          const fi = findIdx(e.from);
          const ti = findIdx(e.to);
          if (fi < 0 || ti < 0) return null;
          const isDone = PROCESS_NODES[fi].status === 'done';
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={positions[fi].x + nodeW}
              y1={positions[fi].y + nodeH / 2}
              x2={positions[ti].x}
              y2={positions[ti].y + nodeH / 2}
              stroke={isDone ? C.text : C.border}
              strokeWidth={2}
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
          const bottomY = startY + nodeH + 26;
          const midX = (fromX + toX) / 2;
          return (
            <g key={`reconnect-${e.from}-${e.to}`}>
              <path
                d={`M ${fromX} ${startY + nodeH} L ${fromX} ${bottomY} Q ${midX} ${bottomY + 18} ${toX} ${bottomY} L ${toX} ${startY + nodeH}`}
                fill="none"
                stroke={C.stepAccent}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                opacity={0.6}
              />
              <polygon
                points={`${toX - 4},${startY + nodeH + 7} ${toX},${startY + nodeH} ${toX + 4},${startY + nodeH + 7}`}
                fill={C.stepAccent}
                opacity={0.6}
              />
              <text x={midX} y={bottomY + 14} textAnchor="middle" fontSize={10} fill={C.stepAccent} fontFamily={sans}>
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
                x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={10}
                fill={st.fill} stroke={st.stroke}
                strokeWidth={n.status === 'current' ? 2 : 1}
              />
              <text
                x={pos.x + nodeW / 2}
                y={pos.y + nodeH / 2 + 4}
                textAnchor="middle"
                fontSize={11}
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
export default function MockupCPage() {
  const [viewState, setViewState] = useState<ViewState>('normal');
  const [showDelete, setShowDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const p = MOCK_PROJECT;
  const resources = viewState === 'empty' ? [] : MOCK_RESOURCES;

  return (
    <div className="min-h-screen flex" style={{ fontFamily: sans }}>
      {/* ════════ LEFT PANEL (Dark) ════════ */}
      <aside className="w-72 shrink-0 flex flex-col sticky top-0 h-screen overflow-y-auto" style={{ background: C.panelBg, color: C.panelText }}>
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${C.stepAccent}, transparent)` }} />

        {/* Header */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: C.stepAccent }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="#fff" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-sm font-bold">PII Agent</span>
          </div>
          {viewState === 'loading' ? (
            <div className="space-y-2"><Skeleton w="w-32" dark /><Skeleton w="w-20" dark /></div>
          ) : (
            <>
              <h1 className="text-sm font-bold leading-tight">{p.name}</h1>
              <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: C.panelMuted }}>
                <span>{p.projectCode}</span><span>·</span><span>{p.serviceCode}</span>
              </div>
            </>
          )}
        </div>

        {/* Project Meta */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.panelMuted }}>기본 정보</span>
          {viewState !== 'loading' && (
            <div className="mt-3 space-y-1.5 text-xs">
              {[
                ['Cloud', p.cloudProvider],
                ['모드', '자동 설치'],
                ['리소스', `${resources.length}건`],
                ['생성일', new Date(p.createdAt).toLocaleDateString('ko-KR')],
                ['최종 수정', new Date(p.updatedAt).toLocaleDateString('ko-KR')],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span style={{ color: C.panelMuted }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection Summary */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.panelBorder}` }}>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.panelMuted }}>연결 상태</span>
          {viewState !== 'loading' && (
            <div className="mt-3 flex gap-4">
              {[
                { label: '연결', count: resources.filter(r => r.connectionStatus === 'CONNECTED').length, color: C.green },
                { label: '끊김', count: resources.filter(r => r.connectionStatus === 'DISCONNECTED').length, color: C.red },
                { label: '대기', count: resources.filter(r => r.connectionStatus === 'PENDING').length, color: C.panelMuted },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-lg font-bold tabular-nums" style={{ color: s.color, fontFamily: mono }}>{s.count}</div>
                  <div className="text-[10px]" style={{ color: C.panelMuted }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="px-5 py-4 mt-auto" style={{ borderTop: `1px solid ${C.panelBorder}` }}>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="text-[11px]" style={{ color: C.red }}>과제 삭제</button>
          ) : (
            <div className="p-3 rounded-lg" style={{ background: `${C.red}15`, border: `1px solid ${C.red}30` }}>
              <p className="text-[11px]" style={{ color: C.red }}>되돌릴 수 없습니다.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setShowDelete(false)} className="px-2 py-1 rounded text-[11px]" style={{ border: `1px solid ${C.panelBorder}`, color: C.panelText }}>취소</button>
                <button className="px-2 py-1 rounded text-[11px] font-semibold" style={{ background: C.red, color: '#fff' }}>삭제</button>
              </div>
            </div>
          )}
        </div>

        {/* State Preview */}
        <div className="px-5 py-3 flex items-center gap-1" style={{ borderTop: `1px solid ${C.panelBorder}` }}>
          {(['normal', 'loading', 'error', 'empty'] as ViewState[]).map((s) => (
            <button
              key={s}
              onClick={() => setViewState(s)}
              className="px-2 py-0.5 rounded text-[10px] transition-colors"
              style={{ background: viewState === s ? C.stepAccent : 'transparent', color: viewState === s ? '#fff' : C.panelMuted }}
            >
              {s}
            </button>
          ))}
        </div>
      </aside>

      {/* ════════ RIGHT PANEL (Light) ════════ */}
      <main className="flex-1 min-w-0" style={{ background: C.bg, color: C.text }}>
        {/* Error */}
        {viewState === 'error' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <p className="text-sm font-medium">데이터를 불러올 수 없습니다</p>
              <p className="text-xs mt-1" style={{ color: C.muted }}>네트워크를 확인하세요.</p>
              <button onClick={() => setViewState('normal')} className="mt-4 px-4 py-2 text-xs font-medium rounded-lg" style={{ background: C.text, color: '#fff' }}>재시도</button>
            </div>
          </div>
        )}

        {viewState !== 'error' && (
          <div className="p-6 space-y-6">
            {/* Process Graph */}
            <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <SectionLabel>프로세스 진행</SectionLabel>
              {viewState === 'loading' ? <Skeleton w="w-full" h="h-16" /> : <ProcessGraph />}
            </div>

            {/* Resource Table — ALWAYS VISIBLE */}
            <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="px-5 pt-4 pb-2">
                <SectionLabel>리소스 ({resources.length})</SectionLabel>
              </div>
              {viewState === 'loading' ? (
                <div className="px-5 pb-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} w="w-full" h="h-9" />)}</div>
              ) : resources.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm" style={{ color: C.muted }}>리소스가 없습니다</p>
                  <button className="mt-3 px-4 py-2 rounded-lg text-xs font-medium" style={{ background: C.text, color: '#fff' }}>리소스 스캔 시작</button>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['상태', '리소스 ID', '타입', 'DB', '리전', '연결', 'Credential'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-[11px]" style={{ color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td className="px-4 py-3"><span className="w-2 h-2 rounded-full inline-block" style={{ background: connColor(r.connectionStatus) }} /></td>
                        <td className="px-4 py-3 font-medium" style={{ fontFamily: mono }}>{r.resourceId}</td>
                        <td className="px-4 py-3" style={{ color: C.sub }}>{r.awsType}</td>
                        <td className="px-4 py-3">{r.databaseType}</td>
                        <td className="px-4 py-3" style={{ color: C.sub }}>{REGION_MAP[r.region] ?? r.region}</td>
                        <td className="px-4 py-3">
                          <span style={{ color: connColor(r.connectionStatus) }}>{CONNECTION_LABEL[r.connectionStatus]?.text}</span>
                          {r.isNew && <Badge color={C.blue}>NEW</Badge>}
                        </td>
                        <td className="px-4 py-3" style={{ color: C.muted }}>{r.selectedCredentialId ? MOCK_CREDENTIALS.find(c => c.id === r.selectedCredentialId)?.name ?? '-' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Connection Test */}
            {MOCK_TEST_HISTORY.length > 0 && viewState === 'normal' && (
              <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-4">
                  <SectionLabel>연결 테스트 결과</SectionLabel>
                  <span className="text-[11px]" style={{ color: C.muted }}>{new Date(MOCK_TEST_HISTORY[0].executedAt).toLocaleString('ko-KR')}</span>
                </div>
                <div className="space-y-2">
                  {MOCK_TEST_HISTORY[0].results.map((r) => (
                    <div key={r.resourceId} className="flex items-center gap-3 p-2.5 rounded-lg text-xs" style={{ background: r.success ? `${C.green}06` : `${C.red}06` }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.success ? C.green : C.red }} />
                      <span className="font-medium">{r.resourceType}</span>
                      <span style={{ color: C.muted }}>{r.databaseType}</span>
                      {r.success ? (
                        <Badge color={C.green}>PASS</Badge>
                      ) : (
                        <span className="ml-auto text-[11px]" style={{ color: C.red }}>{r.error?.message}</span>
                      )}
                    </div>
                  ))}
                </div>
                <button className="mt-4 w-full py-2.5 rounded-lg text-xs font-semibold" style={{ background: C.text, color: '#fff' }}>
                  연결 테스트 재실행
                </button>
              </div>
            )}

            {/* History (collapsible) */}
            {viewState === 'normal' && (
              <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <button onClick={() => setHistoryOpen(!historyOpen)} className="w-full flex items-center justify-between px-5 py-3">
                  <SectionLabel>진행 내역</SectionLabel>
                  <svg className={`w-4 h-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} fill="none" stroke={C.muted} viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {historyOpen && (
                  <div style={{ borderTop: `1px solid ${C.border}` }}>
                    {MOCK_HISTORY.map((h, i) => (
                      <div key={h.id} className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom: i < MOCK_HISTORY.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: h.type === 'APPROVAL' ? C.green : C.blue }} />
                        <time className="text-[11px] tabular-nums shrink-0" style={{ color: C.muted, fontFamily: mono }}>
                          {new Date(h.timestamp).toLocaleDateString('ko-KR')}
                        </time>
                        <span className="text-xs font-medium">{h.actor}</span>
                        <span className="text-xs" style={{ color: C.sub }}>{h.detail}</span>
                        <Badge color={h.type === 'APPROVAL' ? C.green : C.blue}>
                          {h.type === 'APPROVAL' ? '승인' : '확정'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @media (prefers-reduced-motion: reduce) { .animate-pulse { animation: none !important; } }
      `}</style>
    </div>
  );
}
