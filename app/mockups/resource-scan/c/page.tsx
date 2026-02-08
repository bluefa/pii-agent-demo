'use client';

/**
 * Mockup C — Split Workflow
 *
 * Split-panel workflow design for Resource List + Scan UI.
 * Left: Scan control center (35%) — timeline, visualization, controls
 * Right: Resource data view (65%) — table, filters, search
 * Teal accent, organic feel, cross-highlighting between panels.
 */

import { useState } from 'react';
import {
  MOCK_RESOURCES, MockResource,
  MOCK_SCAN_RESULT, ScanResult,
  MOCK_SCAN_HISTORY, ScanHistoryEntry,
  MOCK_CREDENTIALS,
  REGION_MAP,
  AWS_TYPE_INFO,
  CONNECTION_LABEL,
  ScanUIState,
} from '@/app/mockups/resource-scan/_data';

const colors = {
  bg: '#F9FAFB',
  leftBg: '#F0FDF9',
  surface: '#FFFFFF',
  text: '#1F2937',
  sub: '#6B7280',
  muted: '#9CA3AF',
  border: '#E5E7EB',
  primary: '#059669',
  primaryLight: '#D1FAE5',
  primaryDark: '#047857',
  success: '#10B981',
  successLight: '#ECFDF5',
  error: '#EF4444',
  errorLight: '#FEF2F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  info: '#3B82F6',
  infoLight: '#EFF6FF',
  divider: '#D1D5DB',
};

type FilterType = 'all' | 'connected' | 'disconnected' | 'pending' | 'new';

export default function MockupC() {
  const [viewState, setViewState] = useState<ScanUIState>('COMPLETED');
  const [filter, setFilter] = useState<FilterType>('all');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightNew, setHighlightNew] = useState(false);

  const filterResources = () => {
    return MOCK_RESOURCES.filter((r) => {
      if (searchQuery && !r.resourceId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (typeFilter && r.awsType !== typeFilter) return false;
      if (filter === 'connected' && r.connectionStatus !== 'CONNECTED') return false;
      if (filter === 'disconnected' && r.connectionStatus !== 'DISCONNECTED') return false;
      if (filter === 'pending' && r.connectionStatus !== 'PENDING') return false;
      if (filter === 'new' && !r.isNew) return false;
      return true;
    });
  };

  const groupedResources = () => {
    const filtered = filterResources();
    const grouped = filtered.reduce((acc, r) => {
      if (!acc[r.awsType]) acc[r.awsType] = [];
      acc[r.awsType].push(r);
      return acc;
    }, {} as Record<string, MockResource[]>);
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  const scanProgress = 65;
  const scanElapsed = 45;

  const onClickNewBadge = () => {
    setFilter('new');
    setHighlightNew(true);
    setTimeout(() => setHighlightNew(false), 2000);
  };

  const onClickUpdatedBadge = () => {
    setFilter('connected');
  };

  return (
    <div className="min-h-screen" style={{ background: colors.bg, fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      {/* State Preview Bar */}
      <div className="px-6 py-3" style={{ background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold" style={{ color: colors.sub }}>상태 프리뷰:</span>
          {(['IDLE', 'IN_PROGRESS', 'COMPLETED', 'COOLDOWN', 'FAILED'] as ScanUIState[]).map((state) => (
            <button
              key={state}
              onClick={() => setViewState(state)}
              className="px-3 py-1 text-xs font-medium rounded-lg transition-all"
              style={{
                background: viewState === state ? colors.primaryLight : colors.bg,
                color: viewState === state ? colors.primaryDark : colors.sub,
                border: `1px solid ${viewState === state ? colors.primary : colors.border}`,
              }}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-[35%_65%] h-[calc(100vh-57px)]">
        {/* LEFT PANEL — Scan Control Center */}
        <div className="flex flex-col overflow-y-auto" style={{ background: colors.leftBg, borderRight: `2px solid ${colors.divider}` }}>
          <div className="p-6 flex-1 flex flex-col">
            {/* Scan Control */}
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-1" style={{ color: colors.text }}>리소스 스캔</h2>
              <div className="flex items-center gap-2 mb-4">
                <div className="px-2.5 py-1 rounded text-xs font-semibold" style={{ background: colors.warning, color: '#FFFFFF' }}>
                  AWS
                </div>
              </div>

              {viewState === 'IDLE' && (
                <button
                  onClick={() => setViewState('IN_PROGRESS')}
                  className="w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: colors.primary, color: '#FFFFFF', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                >
                  스캔 시작
                </button>
              )}

              {viewState === 'IN_PROGRESS' && (
                <div>
                  <button
                    disabled
                    className="w-full py-3.5 rounded-xl text-sm font-bold opacity-60 cursor-not-allowed"
                    style={{ background: colors.primary, color: '#FFFFFF' }}
                  >
                    스캔 중...
                  </button>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1.5" style={{ color: colors.sub }}>
                      <span>진행률 {scanProgress}%</span>
                      <span>{scanElapsed}초 경과</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: colors.border }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ background: colors.primary, width: `${scanProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {viewState === 'COMPLETED' && (
                <button
                  onClick={() => setViewState('COOLDOWN')}
                  className="w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: colors.primary, color: '#FFFFFF', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                >
                  다시 스캔
                </button>
              )}

              {viewState === 'COOLDOWN' && (
                <div>
                  <button
                    disabled
                    className="w-full py-3.5 rounded-xl text-sm font-bold opacity-60 cursor-not-allowed"
                    style={{ background: colors.muted, color: '#FFFFFF' }}
                  >
                    대기 중...
                  </button>
                  <div className="mt-2 text-center text-xs" style={{ color: colors.sub }}>
                    쿨다운 5분 남음
                  </div>
                </div>
              )}

              {viewState === 'FAILED' && (
                <button
                  onClick={() => setViewState('IDLE')}
                  className="w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: colors.error, color: '#FFFFFF' }}
                >
                  재시도
                </button>
              )}
            </div>

            {/* Scan Result Visualization */}
            {viewState === 'COMPLETED' && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
                <h3 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: colors.sub }}>스캔 결과</h3>

                {/* Stacked Bar */}
                <div className="h-8 rounded-lg overflow-hidden flex mb-3">
                  {MOCK_SCAN_RESULT.byResourceType.map((rt) => {
                    const typeInfo = AWS_TYPE_INFO[rt.resourceType];
                    const percentage = (rt.count / MOCK_SCAN_RESULT.totalFound) * 100;
                    return (
                      <div
                        key={rt.resourceType}
                        className="flex items-center justify-center text-xs font-bold"
                        style={{
                          width: `${percentage}%`,
                          background: typeInfo?.color || colors.muted,
                          color: '#FFFFFF',
                        }}
                        title={`${typeInfo?.label || rt.resourceType}: ${rt.count}개`}
                      >
                        {rt.count}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {MOCK_SCAN_RESULT.byResourceType.map((rt) => {
                    const typeInfo = AWS_TYPE_INFO[rt.resourceType];
                    return (
                      <div key={rt.resourceType} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-sm" style={{ background: typeInfo?.color || colors.muted }} />
                        <span style={{ color: colors.text }}>{typeInfo?.icon} {typeInfo?.label}</span>
                        <span className="ml-auto font-semibold" style={{ color: colors.sub }}>{rt.count}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="pt-3 text-sm font-medium" style={{ borderTop: `1px solid ${colors.border}`, color: colors.text }}>
                  {MOCK_SCAN_RESULT.totalFound}개 발견
                  <span className="mx-2" style={{ color: colors.muted }}>·</span>
                  <button
                    onClick={onClickNewBadge}
                    className="px-2 py-0.5 rounded-md text-xs font-bold transition-all hover:scale-105"
                    style={{ background: colors.infoLight, color: colors.info }}
                  >
                    신규 {MOCK_SCAN_RESULT.newFound}
                  </button>
                  <span className="mx-2" style={{ color: colors.muted }}>·</span>
                  <button
                    onClick={onClickUpdatedBadge}
                    className="px-2 py-0.5 rounded-md text-xs font-bold transition-all hover:scale-105"
                    style={{ background: colors.successLight, color: colors.success }}
                  >
                    업데이트 {MOCK_SCAN_RESULT.updated}
                  </button>
                </div>
              </div>
            )}

            {viewState === 'FAILED' && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: colors.errorLight, border: `1px solid ${colors.error}` }}>
                <div className="text-xs font-bold mb-1" style={{ color: colors.error }}>스캔 실패</div>
                <div className="text-xs" style={{ color: colors.sub }}>API 연결 오류. 잠시 후 다시 시도하세요.</div>
              </div>
            )}

            {/* Scan Timeline */}
            <div className="flex-1">
              <h3 className="text-xs font-bold mb-4 uppercase tracking-wider" style={{ color: colors.sub }}>스캔 이력</h3>
              <div className="space-y-4">
                {MOCK_SCAN_HISTORY.slice(0, 4).map((entry, idx) => (
                  <div key={entry.id} className="flex gap-3">
                    {/* Timeline Dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: entry.status === 'COMPLETED' ? colors.success : colors.error }}
                      />
                      {idx < 3 && <div className="w-0.5 flex-1 mt-1" style={{ background: colors.divider }} />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold" style={{ color: colors.text }}>
                          {new Date(entry.startedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            background: entry.status === 'COMPLETED' ? colors.successLight : colors.errorLight,
                            color: entry.status === 'COMPLETED' ? colors.success : colors.error,
                          }}
                        >
                          {entry.status === 'COMPLETED' ? '완료' : '실패'}
                        </span>
                      </div>
                      {entry.result && (
                        <div className="text-xs" style={{ color: colors.sub }}>
                          발견 {entry.result.totalFound}개 · 신규 {entry.result.newFound}
                        </div>
                      )}
                      {!entry.result && (
                        <div className="text-xs" style={{ color: colors.sub }}>오류 발생</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Resource Data View */}
        <div className="flex flex-col overflow-hidden" style={{ background: colors.surface }}>
          <div className="p-6 pb-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold" style={{ color: colors.text }}>리소스 목록</h2>
                <div
                  className="px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: colors.primaryLight, color: colors.primaryDark }}
                >
                  {filterResources().length}개
                </div>
                {filter !== 'all' && (
                  <button
                    onClick={() => setFilter('all')}
                    className="text-xs underline"
                    style={{ color: colors.primary }}
                  >
                    필터 해제
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3 mb-5">
              {/* Search */}
              <input
                type="text"
                placeholder="리소스 ID 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg text-sm border transition-all focus:outline-none focus:ring-2"
                style={{
                  borderColor: colors.border,
                  color: colors.text,
                  background: colors.bg,
                }}
              />

              {/* Status Pills */}
              <div className="flex gap-2">
                {(['all', 'connected', 'disconnected', 'pending', 'new'] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                    style={{
                      background: filter === f ? colors.primary : colors.bg,
                      color: filter === f ? '#FFFFFF' : colors.sub,
                      border: `1px solid ${filter === f ? colors.primary : colors.border}`,
                    }}
                  >
                    {f === 'all' ? '전체' : f === 'connected' ? '연결됨' : f === 'disconnected' ? '끊김' : f === 'pending' ? '대기' : '신규'}
                  </button>
                ))}
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter || ''}
                onChange={(e) => setTypeFilter(e.target.value || null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all focus:outline-none focus:ring-2"
                style={{
                  borderColor: colors.border,
                  color: colors.sub,
                  background: colors.bg,
                }}
              >
                <option value="">모든 타입</option>
                {Object.keys(AWS_TYPE_INFO).map((type) => (
                  <option key={type} value={type}>{AWS_TYPE_INFO[type].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Resource Table */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {filterResources().length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full" style={{ color: colors.muted }}>
                <div className="text-6xl mb-4">←</div>
                <div className="text-sm font-medium">스캔을 시작하여 리소스를 검색하세요</div>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedResources().map(([awsType, resources]) => {
                  const typeInfo = AWS_TYPE_INFO[awsType];
                  return (
                    <div key={awsType}>
                      {/* Type Header */}
                      <div
                        className="flex items-center gap-3 px-4 py-2.5 rounded-lg mb-2"
                        style={{ background: colors.bg, borderLeft: `4px solid ${typeInfo?.color || colors.muted}` }}
                      >
                        <span className="text-base">{typeInfo?.icon}</span>
                        <span className="text-sm font-bold" style={{ color: colors.text }}>{typeInfo?.label}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: colors.primaryLight, color: colors.primaryDark }}
                        >
                          {resources.length}
                        </span>
                      </div>

                      {/* Resource Rows */}
                      <div className="space-y-1">
                        {resources.map((r) => {
                          const connLabel = CONNECTION_LABEL[r.connectionStatus];
                          const cred = MOCK_CREDENTIALS.find((c) => c.id === r.selectedCredentialId);
                          return (
                            <div
                              key={r.id}
                              className="flex items-center gap-4 px-4 py-3 rounded-lg transition-all hover:shadow-sm"
                              style={{
                                background: colors.surface,
                                border: `1px solid ${colors.border}`,
                                borderLeftWidth: '4px',
                                borderLeftColor: r.isNew ? colors.info : r.connectionStatus === 'DISCONNECTED' ? colors.error : 'transparent',
                              }}
                            >
                              {/* Checkbox */}
                              <input
                                type="checkbox"
                                checked={r.isSelected}
                                readOnly
                                className="w-4 h-4 rounded"
                                style={{ accentColor: colors.primary }}
                              />

                              {/* Resource ID */}
                              <div className="flex-1 flex items-center gap-2">
                                <code className="text-xs font-mono" style={{ color: colors.text }}>{r.resourceId}</code>
                                {r.isNew && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                    style={{ background: colors.infoLight, color: colors.info }}
                                  >
                                    NEW
                                  </span>
                                )}
                              </div>

                              {/* DB Type */}
                              <div className="w-32 text-xs" style={{ color: colors.sub }}>{r.databaseType}</div>

                              {/* Region */}
                              <div className="w-24 text-xs" style={{ color: colors.sub }}>{REGION_MAP[r.region] || r.region}</div>

                              {/* Status */}
                              <div className="flex items-center gap-2 w-24">
                                <div className="w-2 h-2 rounded-full" style={{ background: connLabel.color }} />
                                <span className="text-xs font-medium" style={{ color: connLabel.color }}>{connLabel.text}</span>
                              </div>

                              {/* Credential */}
                              <div className="w-40 text-xs truncate" style={{ color: colors.sub }}>
                                {cred ? cred.name : '—'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
