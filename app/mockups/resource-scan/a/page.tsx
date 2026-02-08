'use client';

import { useState, useMemo } from 'react';
import {
  MOCK_RESOURCES, MockResource,
  MOCK_SCAN_RESULT, ScanResult,
  MOCK_SCAN_HISTORY, ScanHistoryEntry,
  MOCK_CREDENTIALS,
  REGION_MAP,
  AWS_TYPE_INFO,
  CONNECTION_LABEL,
} from '@/app/mockups/resource-scan/_data';

const C = {
  bg: '#FAFBFC',
  surface: '#FFFFFF',
  text: '#242424',
  sub: '#616161',
  muted: '#A0A0A0',
  border: '#E1E1E1',
  primary: '#0078D4',
  primaryLight: '#EBF3FC',
  primaryDark: '#106EBE',
  success: '#107C10',
  successLight: '#DFF6DD',
  error: '#D13438',
  errorLight: '#FDE7E9',
  warning: '#FFB900',
  warningLight: '#FFF4CE',
  neutral: '#F3F2F1',
  neutralDark: '#8A8886',
};

type ViewState = 'normal' | 'loading' | 'error' | 'empty';
type FilterMode = 'all' | 'selected' | 'new' | 'disconnected';

export default function FluentDashboard() {
  const [viewState, setViewState] = useState<ViewState>('normal');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanExpanded, setScanExpanded] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState(true);

  const filteredResources = useMemo(() => {
    let items = MOCK_RESOURCES;
    if (filterMode === 'selected') items = items.filter(r => r.isSelected);
    if (filterMode === 'new') items = items.filter(r => r.isNew);
    if (filterMode === 'disconnected') items = items.filter(r => r.connectionStatus === 'DISCONNECTED');
    if (typeFilter) items = items.filter(r => r.awsType === typeFilter);
    if (searchQuery) items = items.filter(r => r.resourceId.toLowerCase().includes(searchQuery.toLowerCase()));
    return items;
  }, [filterMode, typeFilter, searchQuery]);

  const groupedResources = useMemo(() => {
    const groups: Record<string, MockResource[]> = {};
    filteredResources.forEach(r => {
      if (!groups[r.awsType]) groups[r.awsType] = [];
      groups[r.awsType].push(r);
    });
    return groups;
  }, [filteredResources]);

  const stats = useMemo(() => {
    const total = MOCK_RESOURCES.length;
    const connected = MOCK_RESOURCES.filter(r => r.connectionStatus === 'CONNECTED').length;
    const disconnected = MOCK_RESOURCES.filter(r => r.connectionStatus === 'DISCONNECTED').length;
    const pending = MOCK_RESOURCES.filter(r => r.connectionStatus === 'PENDING').length;
    const newCount = MOCK_RESOURCES.filter(r => r.isNew).length;
    return { total, connected, disconnected, pending, newCount, connectedPercent: Math.round((connected / total) * 100) };
  }, []);

  const lastScan = MOCK_SCAN_HISTORY[0];
  const lastScanDate = new Date(lastScan.completedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  const toggleRowSelection = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getCredentialName = (credId?: string) => {
    if (!credId) return { text: '필요없음', style: { color: C.muted } };
    const cred = MOCK_CREDENTIALS.find(c => c.id === credId);
    return { text: cred?.name || credId, style: { color: C.text } };
  };

  if (viewState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-geist-sans)', padding: '24px' }}>
        <StatePreviewBar current="loading" onChange={setViewState} />
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <CommandBar onStateChange={() => {}} />
          <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ background: C.surface, borderRadius: '8px', padding: '20px', border: `1px solid ${C.border}`, height: '120px' }}>
                <div style={{ width: '60%', height: '16px', background: C.neutral, borderRadius: '4px', marginBottom: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: '40%', height: '28px', background: C.neutral, borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: '32px', background: C.surface, borderRadius: '8px', padding: '24px', border: `1px solid ${C.border}` }}>
            <div style={{ width: '30%', height: '20px', background: C.neutral, borderRadius: '4px', marginBottom: '16px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: '8px', background: C.neutral, borderRadius: '4px', marginBottom: '24px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ height: '48px', background: C.neutral, borderRadius: '4px', marginBottom: '8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>
    );
  }

  if (viewState === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-geist-sans)', padding: '24px' }}>
        <StatePreviewBar current="error" onChange={setViewState} />
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <CommandBar onStateChange={() => {}} />
          <div style={{ marginTop: '120px', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>리소스 목록을 불러올 수 없습니다</h2>
            <p style={{ fontSize: '14px', color: C.sub, marginBottom: '24px' }}>네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.</p>
            <button style={{ padding: '10px 24px', background: C.primary, color: 'white', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'empty') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-geist-sans)', padding: '24px' }}>
        <StatePreviewBar current="empty" onChange={setViewState} />
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <CommandBar onStateChange={() => {}} />
          <div style={{ marginTop: '120px', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>리소스가 없습니다</h2>
            <p style={{ fontSize: '14px', color: C.sub, marginBottom: '24px' }}>스캔을 실행하여 AWS 리소스를 검색하세요.</p>
            <button style={{ padding: '12px 32px', background: C.primary, color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
              스캔 시작
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-geist-sans)', padding: '24px' }}>
      <StatePreviewBar current="normal" onChange={setViewState} />
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <CommandBar onStateChange={setSearchQuery} />

        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <StatCard title="전체 리소스" value={stats.total} subtitle="12개 리소스" chart={
            <div style={{ display: 'flex', gap: '2px', height: '32px', alignItems: 'flex-end', marginTop: '12px' }}>
              {MOCK_SCAN_RESULT.byResourceType.map((t, i) => (
                <div key={i} style={{ flex: 1, background: AWS_TYPE_INFO[t.resourceType]?.color || C.muted, borderRadius: '2px', height: `${(t.count / 5) * 100}%`, minHeight: '8px' }} title={`${t.resourceType}: ${t.count}`} />
              ))}
            </div>
          } />
          <StatCard title="연결됨" value={stats.connected} subtitle={`${stats.connectedPercent}% 연결`} color={C.success} />
          <StatCard title="끊김 / 대기" value={`${stats.disconnected} / ${stats.pending}`} subtitle="주의 필요" color={C.error} />
          <StatCard title="최근 스캔" value={lastScanDate.split(' ')[0]} subtitle={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {lastScan.result?.totalFound}개 발견
              {stats.newCount > 0 && <span style={{ background: C.primaryLight, color: C.primary, padding: '2px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>신규 {stats.newCount}</span>}
            </span>
          } color={C.primary} />
        </div>

        <div style={{ marginTop: '24px', background: C.surface, borderRadius: '8px', padding: '20px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>스캔 기록</span>
            <div style={{ flex: 1, height: '2px', background: C.border, position: 'relative' }}>
              {MOCK_SCAN_HISTORY.slice(0, 4).map((entry, i) => (
                <div key={entry.id} style={{ position: 'absolute', left: `${(i / 3) * 100}%`, top: '-5px', width: '12px', height: '12px', borderRadius: '50%', background: entry.status === 'COMPLETED' ? C.success : C.error, border: `2px solid ${C.surface}`, cursor: 'pointer' }} title={`${new Date(entry.completedAt).toLocaleDateString('ko-KR')} - ${entry.status}`} />
              ))}
            </div>
            <button onClick={() => setScanExpanded(!scanExpanded)} style={{ padding: '4px 8px', fontSize: '12px', color: C.primary, background: 'transparent', border: 'none', cursor: 'pointer' }}>
              {scanExpanded ? '접기 ▲' : '더보기 ▼'}
            </button>
          </div>
          <div style={{ fontSize: '13px', color: C.sub }}>
            마지막 스캔: {lastScanDate} · {lastScan.result?.totalFound}개 발견 · <span style={{ color: C.primary, fontWeight: 500 }}>{lastScan.result?.newFound} 신규</span>
          </div>
          {scanExpanded && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
              {MOCK_SCAN_HISTORY.map(entry => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: `1px solid ${C.neutral}` }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: entry.status === 'COMPLETED' ? C.success : C.error }} />
                  <span style={{ fontSize: '13px', color: C.text, fontFamily: 'var(--font-geist-mono)' }}>{new Date(entry.completedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ fontSize: '13px', color: C.sub }}>{entry.result ? `${entry.result.totalFound}개 발견` : '실패'}</span>
                  <span style={{ fontSize: '12px', color: C.muted }}>({entry.duration}초)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all', 'selected', 'new', 'disconnected'] as FilterMode[]).map(mode => (
            <button key={mode} onClick={() => setFilterMode(mode)} style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, border: `1px solid ${filterMode === mode ? C.primary : C.border}`, background: filterMode === mode ? C.primaryLight : C.surface, color: filterMode === mode ? C.primary : C.text, borderRadius: '4px', cursor: 'pointer' }}>
              {{ all: '전체', selected: '선택됨', new: '신규', disconnected: '끊김' }[mode]}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <select value={typeFilter || ''} onChange={(e) => setTypeFilter(e.target.value || null)} style={{ padding: '8px 12px', fontSize: '13px', border: `1px solid ${C.border}`, borderRadius: '4px', background: C.surface, color: C.text, cursor: 'pointer' }}>
              <option value="">모든 타입</option>
              {Object.keys(AWS_TYPE_INFO).map(type => (
                <option key={type} value={type}>{AWS_TYPE_INFO[type].label}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredResources.length === 0 ? (
          <div style={{ marginTop: '48px', textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
            <p style={{ fontSize: '14px', color: C.sub }}>필터 조건에 해당하는 리소스가 없습니다.</p>
          </div>
        ) : (
          <div style={{ marginTop: '24px' }}>
            {Object.entries(groupedResources).map(([awsType, resources]) => (
              <div key={awsType} style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '12px 16px', background: C.neutral, borderRadius: '6px' }}>
                  <span style={{ fontSize: '20px' }}>{AWS_TYPE_INFO[awsType]?.icon}</span>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: C.text }}>{AWS_TYPE_INFO[awsType]?.label}</span>
                  <span style={{ fontSize: '13px', color: C.sub }}>({resources.length})</span>
                  <div style={{ width: '120px', height: '6px', background: C.border, borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(resources.length / MOCK_RESOURCES.length) * 100}%`, height: '100%', background: AWS_TYPE_INFO[awsType]?.color, borderRadius: '3px' }} />
                  </div>
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: C.neutral, borderBottom: `1px solid ${C.border}` }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: C.sub, width: '40px' }}></th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: C.sub }}>Resource ID</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: C.sub }}>DB 타입</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: C.sub }}>리전</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: C.sub }}>연결 상태</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: C.sub }}>자격증명</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: C.sub }}>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map(resource => {
                        const conn = CONNECTION_LABEL[resource.connectionStatus];
                        const cred = getCredentialName(resource.selectedCredentialId);
                        const borderColor = resource.isNew ? C.primary : resource.connectionStatus === 'DISCONNECTED' ? C.error : 'transparent';
                        return (
                          <tr key={resource.id} style={{ borderBottom: `1px solid ${C.neutral}`, borderLeft: `3px solid ${borderColor}`, background: selectedRows.has(resource.id) ? C.primaryLight : C.surface }}>
                            <td style={{ padding: '12px 16px' }}>
                              <input type="checkbox" checked={selectedRows.has(resource.id)} onChange={() => toggleRowSelection(resource.id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: C.text, fontFamily: 'var(--font-geist-mono)', fontWeight: 500 }}>{resource.resourceId}</td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: C.text }}>{resource.databaseType}</td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', color: C.sub }}>{REGION_MAP[resource.region] || resource.region}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: conn.color, fontWeight: 500 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: conn.color }} />
                                {conn.text}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '13px', ...cred.style }}>{cred.text}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {resource.isNew && <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: '11px', fontWeight: 600, background: C.primaryLight, color: C.primary, borderRadius: '10px', marginRight: '4px' }}>NEW</span>}
                              {resource.isSelected && <span style={{ fontSize: '16px' }} title="선택됨">✓</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showToast && viewState === 'normal' && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '12px', animation: 'slideIn 0.3s ease-out' }}>
          <span style={{ fontSize: '20px' }}>✨</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{stats.newCount}개 신규 리소스 발견</div>
            <div style={{ fontSize: '12px', color: C.sub, marginTop: '2px' }}>스캔이 완료되었습니다</div>
          </div>
          <button onClick={() => setShowToast(false)} style={{ marginLeft: '12px', padding: '4px 8px', fontSize: '12px', color: C.sub, background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

function StatePreviewBar({ current, onChange }: { current: ViewState; onChange: (state: ViewState) => void }) {
  return (
    <div style={{ background: C.neutral, padding: '12px 20px', borderRadius: '6px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: C.sub }}>상태 미리보기:</span>
      {(['normal', 'loading', 'error', 'empty'] as ViewState[]).map(state => (
        <button key={state} onClick={() => onChange(state)} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 500, border: `1px solid ${current === state ? C.primary : C.border}`, background: current === state ? C.primaryLight : C.surface, color: current === state ? C.primary : C.text, borderRadius: '4px', cursor: 'pointer' }}>
          {{ normal: '정상', loading: '로딩', error: '에러', empty: '비어있음' }[state]}
        </button>
      ))}
    </div>
  );
}

function CommandBar({ onStateChange }: { onStateChange: (query: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}` }}>
      <h1 style={{ fontSize: '20px', fontWeight: 600, color: C.text, margin: 0 }}>리소스 관리</h1>
      <input type="text" placeholder="리소스 ID 검색..." onChange={(e) => onStateChange(e.target.value)} style={{ flex: 1, padding: '8px 12px', fontSize: '14px', border: `1px solid ${C.border}`, borderRadius: '4px', outline: 'none', fontFamily: 'var(--font-geist-mono)' }} />
      <button style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 600, background: C.primary, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        스캔 시작
      </button>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string | React.ReactNode;
  color?: string;
  chart?: React.ReactNode;
}

function StatCard({ title, value, subtitle, color = C.text, chart }: StatCardProps) {
  return (
    <div style={{ background: C.surface, borderRadius: '8px', padding: '20px', border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: C.sub, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color, marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '13px', color: C.sub }}>{subtitle}</div>
      {chart}
    </div>
  );
}
