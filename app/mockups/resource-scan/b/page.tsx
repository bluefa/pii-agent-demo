'use client';

import { useState, useMemo } from 'react';
import {
  MOCK_RESOURCES,
  MOCK_SCAN_RESULT,
  MOCK_SCAN_HISTORY,
  MOCK_CREDENTIALS,
  REGION_MAP,
  AWS_TYPE_INFO,
  CONNECTION_LABEL,
} from '@/app/mockups/resource-scan/_data';

type ViewState = 'normal' | 'loading' | 'error' | 'empty';
type FilterType = 'all' | 'selected' | 'new' | 'disconnected';

const COLORS = {
  headerBg: '#0F172A',
  headerText: '#F8FAFC',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0F172A',
  sub: '#475569',
  muted: '#94A3B8',
  border: '#E2E8F0',
  accent: '#0F172A',
  accentLight: '#F1F5F9',
  success: '#16A34A',
  successBg: '#F0FDF4',
  error: '#DC2626',
  errorBg: '#FEF2F2',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  info: '#2563EB',
  infoBg: '#EFF6FF',
  newBadge: '#3B82F6',
};

export default function MockupB() {
  const [viewState, setViewState] = useState<ViewState>('normal');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanPanelOpen, setScanPanelOpen] = useState(false);

  const typeStats = useMemo(() => {
    const stats: Record<string, {
      total: number;
      connected: number;
      disconnected: number;
      pending: number;
      newCount: number;
    }> = {};

    Object.keys(AWS_TYPE_INFO).forEach(type => {
      stats[type] = { total: 0, connected: 0, disconnected: 0, pending: 0, newCount: 0 };
    });

    MOCK_RESOURCES.forEach(res => {
      const typeKey = res.awsType;
      if (!stats[typeKey]) return;
      stats[typeKey].total++;
      if (res.connectionStatus === 'CONNECTED') stats[typeKey].connected++;
      if (res.connectionStatus === 'DISCONNECTED') stats[typeKey].disconnected++;
      if (res.connectionStatus === 'PENDING') stats[typeKey].pending++;
      if (res.isNew) stats[typeKey].newCount++;
    });

    return stats;
  }, []);

  const filteredResources = useMemo(() => {
    let filtered = MOCK_RESOURCES;

    if (selectedType) {
      filtered = filtered.filter(r => r.awsType === selectedType);
    }

    if (filter === 'selected') {
      filtered = filtered.filter(r => r.isSelected);
    } else if (filter === 'new') {
      filtered = filtered.filter(r => r.isNew);
    } else if (filter === 'disconnected') {
      filtered = filtered.filter(r => r.connectionStatus === 'DISCONNECTED');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.resourceId.toLowerCase().includes(q) ||
        r.databaseType.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [selectedType, filter, searchQuery]);

  const getCredentialName = (credId?: string) => {
    if (!credId) return '—';
    return MOCK_CREDENTIALS.find(c => c.id === credId)?.name || '—';
  };

  const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const renderStatePreview = () => (
    <div style={{ background: COLORS.accent, color: COLORS.headerText, padding: '8px 24px', display: 'flex', gap: '12px', fontSize: '13px', borderBottom: `1px solid ${COLORS.border}` }}>
      <button
        onClick={() => setViewState('normal')}
        style={{
          padding: '4px 12px',
          borderRadius: '4px',
          background: viewState === 'normal' ? COLORS.accentLight : 'transparent',
          color: viewState === 'normal' ? COLORS.accent : COLORS.headerText,
          border: 'none',
          cursor: 'pointer',
          fontWeight: viewState === 'normal' ? '600' : '400',
        }}
      >
        Normal
      </button>
      <button
        onClick={() => setViewState('loading')}
        style={{
          padding: '4px 12px',
          borderRadius: '4px',
          background: viewState === 'loading' ? COLORS.accentLight : 'transparent',
          color: viewState === 'loading' ? COLORS.accent : COLORS.headerText,
          border: 'none',
          cursor: 'pointer',
          fontWeight: viewState === 'loading' ? '600' : '400',
        }}
      >
        Scanning
      </button>
      <button
        onClick={() => setViewState('error')}
        style={{
          padding: '4px 12px',
          borderRadius: '4px',
          background: viewState === 'error' ? COLORS.accentLight : 'transparent',
          color: viewState === 'error' ? COLORS.accent : COLORS.headerText,
          border: 'none',
          cursor: 'pointer',
          fontWeight: viewState === 'error' ? '600' : '400',
        }}
      >
        Error
      </button>
      <button
        onClick={() => setViewState('empty')}
        style={{
          padding: '4px 12px',
          borderRadius: '4px',
          background: viewState === 'empty' ? COLORS.accentLight : 'transparent',
          color: viewState === 'empty' ? COLORS.accent : COLORS.headerText,
          border: 'none',
          cursor: 'pointer',
          fontWeight: viewState === 'empty' ? '600' : '400',
        }}
      >
        Empty
      </button>
    </div>
  );

  const renderHeader = () => (
    <div style={{ background: COLORS.headerBg, color: COLORS.headerText, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>📦 리소스 인벤토리</h1>
        <span
          style={{
            background: COLORS.accentLight,
            color: COLORS.accent,
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          {MOCK_RESOURCES.length}개
        </span>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="리소스 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: `1px solid rgba(255,255,255,0.2)`,
            color: COLORS.headerText,
            padding: '8px 16px',
            borderRadius: '6px',
            width: '280px',
            fontSize: '14px',
            outline: 'none',
          }}
        />
        <button
          style={{
            background: viewState === 'loading' ? COLORS.muted : COLORS.warning,
            color: '#FFFFFF',
            padding: '8px 20px',
            borderRadius: '6px',
            border: 'none',
            cursor: viewState === 'loading' ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            opacity: viewState === 'loading' ? 0.6 : 1,
          }}
          disabled={viewState === 'loading'}
        >
          {viewState === 'loading' ? '스캔 중...' : '스캔'}
        </button>
      </div>
    </div>
  );

  const renderScanStatus = () => {
    if (viewState === 'loading') {
      return (
        <div style={{ background: COLORS.warningBg, padding: '12px 24px', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ marginBottom: '6px', fontSize: '13px', color: COLORS.sub, display: 'flex', justifyContent: 'space-between' }}>
            <span>리소스 검색 중...</span>
            <span>약 2분 소요</span>
          </div>
          <div style={{ background: '#E5E7EB', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                background: COLORS.warning,
                height: '100%',
                width: '45%',
                animation: 'progress 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      );
    }

    const lastScan = MOCK_SCAN_HISTORY[0];
    if (!lastScan || !lastScan.result) return null;

    return (
      <div style={{ background: COLORS.successBg, padding: '10px 24px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', gap: '24px', fontSize: '13px', color: COLORS.sub }}>
        <span>마지막 스캔: {formatDateTime(lastScan.completedAt)}</span>
        <span>발견: {lastScan.result.totalFound}개</span>
        <span style={{ color: COLORS.newBadge, fontWeight: '600' }}>신규: +{lastScan.result.newFound}</span>
        <span>소요시간: {lastScan.duration}초</span>
      </div>
    );
  };

  const renderTypeCards = () => {
    const types = Object.keys(AWS_TYPE_INFO);
    return (
      <div style={{ padding: '24px', background: COLORS.bg }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {types.map(typeKey => {
            const info = AWS_TYPE_INFO[typeKey];
            const stats = typeStats[typeKey];
            const isSelected = selectedType === typeKey;
            const total = stats.total;
            const connectedPct = total > 0 ? (stats.connected / total) * 100 : 0;
            const disconnectedPct = total > 0 ? (stats.disconnected / total) * 100 : 0;
            const pendingPct = total > 0 ? (stats.pending / total) * 100 : 0;

            return (
              <button
                key={typeKey}
                onClick={() => setSelectedType(isSelected ? null : typeKey)}
                style={{
                  background: COLORS.surface,
                  border: `2px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.borderColor = COLORS.muted;
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.borderColor = COLORS.border;
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '28px' }}>{info.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: COLORS.text, marginBottom: '2px' }}>{info.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: COLORS.accent }}>{stats.total}</div>
                  </div>
                  {stats.newCount > 0 && (
                    <span
                      style={{
                        background: COLORS.infoBg,
                        color: COLORS.newBadge,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                    >
                      신규 +{stats.newCount}
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <div style={{ height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                    {connectedPct > 0 && <div style={{ width: `${connectedPct}%`, background: COLORS.success }} />}
                    {disconnectedPct > 0 && <div style={{ width: `${disconnectedPct}%`, background: COLORS.error }} />}
                    {pendingPct > 0 && <div style={{ width: `${pendingPct}%`, background: COLORS.muted }} />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFilters = () => (
    <div style={{ padding: '12px 24px', background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, display: 'flex', gap: '8px' }}>
      {[
        { key: 'all' as FilterType, label: '전체' },
        { key: 'selected' as FilterType, label: '연동 대상' },
        { key: 'new' as FilterType, label: '신규' },
        { key: 'disconnected' as FilterType, label: '끊김' },
      ].map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setFilter(key)}
          style={{
            padding: '6px 16px',
            borderRadius: '16px',
            border: 'none',
            background: filter === key ? COLORS.accent : COLORS.accentLight,
            color: filter === key ? COLORS.headerText : COLORS.sub,
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: filter === key ? '600' : '400',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const renderResourceTable = () => {
    if (viewState === 'error') {
      return (
        <div style={{ padding: '80px 24px', textAlign: 'center', background: COLORS.surface }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: COLORS.error, marginBottom: '8px' }}>스캔 실패</div>
          <div style={{ fontSize: '14px', color: COLORS.sub }}>리소스를 불러올 수 없습니다. 다시 시도해주세요.</div>
        </div>
      );
    }

    if (viewState === 'empty' || filteredResources.length === 0) {
      return (
        <div style={{ padding: '80px 24px', textAlign: 'center', background: COLORS.surface }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: COLORS.text, marginBottom: '8px' }}>리소스 없음</div>
          <div style={{ fontSize: '14px', color: COLORS.sub }}>검색 조건을 변경하거나 스캔을 실행해주세요.</div>
        </div>
      );
    }

    return (
      <div style={{ background: COLORS.surface, padding: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${COLORS.border}`, textAlign: 'left' }}>
              <th style={{ padding: '12px 8px', fontWeight: '600', color: COLORS.sub, width: '80px' }}>상태</th>
              <th style={{ padding: '12px 8px', fontWeight: '600', color: COLORS.sub }}>리소스 ID</th>
              <th style={{ padding: '12px 8px', fontWeight: '600', color: COLORS.sub, width: '140px' }}>DB 타입</th>
              <th style={{ padding: '12px 8px', fontWeight: '600', color: COLORS.sub, width: '100px' }}>리전</th>
              <th style={{ padding: '12px 8px', fontWeight: '600', color: COLORS.sub, width: '100px' }}>연결 상태</th>
              <th style={{ padding: '12px 8px', fontWeight: '600', color: COLORS.sub }}>자격증명</th>
            </tr>
          </thead>
          <tbody>
            {filteredResources.map((res, idx) => {
              const connLabel = CONNECTION_LABEL[res.connectionStatus];
              const borderLeft = res.isNew ? `3px solid ${COLORS.newBadge}` : res.connectionStatus === 'DISCONNECTED' ? `3px solid ${COLORS.error}` : 'none';

              return (
                <tr
                  key={res.id}
                  style={{
                    background: idx % 2 === 0 ? COLORS.surface : COLORS.bg,
                    borderLeft,
                  }}
                >
                  <td style={{ padding: '12px 8px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: connLabel.color,
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: '600', color: COLORS.text }}>
                    {res.resourceId}
                    {res.isNew && (
                      <span
                        style={{
                          marginLeft: '8px',
                          background: COLORS.infoBg,
                          color: COLORS.newBadge,
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px', color: COLORS.sub }}>{res.databaseType}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span
                      style={{
                        background: COLORS.accentLight,
                        color: COLORS.accent,
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      {REGION_MAP[res.region] || res.region}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ color: connLabel.color, fontWeight: '600' }}>{connLabel.text}</span>
                  </td>
                  <td style={{ padding: '12px 8px', color: COLORS.sub }}>{getCredentialName(res.selectedCredentialId)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFloatingScanPanel = () => (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        width: '280px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          background: COLORS.accentLight,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setScanPanelOpen(!scanPanelOpen)}
      >
        <span style={{ fontSize: '13px', fontWeight: '600', color: COLORS.accent }}>스캔 히스토리</span>
        <span style={{ fontSize: '18px' }}>{scanPanelOpen ? '▼' : '▲'}</span>
      </div>
      {scanPanelOpen && (
        <div style={{ padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
          {MOCK_SCAN_HISTORY.slice(0, 5).map(entry => (
            <div
              key={entry.id}
              style={{
                padding: '8px',
                marginBottom: '6px',
                background: COLORS.bg,
                borderRadius: '4px',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: '600', color: COLORS.text, marginBottom: '2px' }}>
                  {formatDateTime(entry.completedAt)}
                </div>
                <div style={{ color: COLORS.sub }}>
                  {entry.status === 'COMPLETED' ? `✓ ${entry.result?.totalFound || 0}개` : '✗ 실패'}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: COLORS.muted }}>{entry.duration}s</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      {renderStatePreview()}
      {renderHeader()}
      {renderScanStatus()}
      {renderTypeCards()}
      {renderFilters()}
      {renderResourceTable()}
      {renderFloatingScanPanel()}
    </div>
  );
}
