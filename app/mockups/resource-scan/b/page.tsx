'use client';

import { useState, useMemo } from 'react';
import {
  F, MOCK_PROJECT, MOCK_RESOURCES, MockResource, MOCK_SCAN_RESULT, MOCK_SCAN_HISTORY,
  MOCK_CREDENTIALS, PROCESS_STEPS, REGION_MAP, AWS_TYPE_META, CONN_STATUS,
  NEEDS_CREDENTIAL,
} from '@/app/mockups/resource-scan/_data';

type ScanUIState = 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'COOLDOWN';

export default function MockupB() {
  const [scanState, setScanState] = useState<ScanUIState>('COMPLETED');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const stats = useMemo(() => {
    const byType: Record<string, { total: number; connected: number; disconnected: number; pending: number }> = {};
    MOCK_RESOURCES.forEach(r => {
      if (!byType[r.awsType]) byType[r.awsType] = { total: 0, connected: 0, disconnected: 0, pending: 0 };
      byType[r.awsType].total++;
      if (r.connectionStatus === 'CONNECTED') byType[r.awsType].connected++;
      else if (r.connectionStatus === 'DISCONNECTED') byType[r.awsType].disconnected++;
      else byType[r.awsType].pending++;
    });
    const statusSummary = {
      connected: MOCK_RESOURCES.filter(r => r.connectionStatus === 'CONNECTED').length,
      disconnected: MOCK_RESOURCES.filter(r => r.connectionStatus === 'DISCONNECTED').length,
      pending: MOCK_RESOURCES.filter(r => r.connectionStatus === 'PENDING').length,
    };
    return { byType, statusSummary };
  }, []);

  const filteredResources = useMemo(() => {
    let items = MOCK_RESOURCES;
    if (typeFilter) items = items.filter(r => r.awsType === typeFilter);
    if (statusFilter) items = items.filter(r => r.connectionStatus === statusFilter);
    if (searchQuery) items = items.filter(r => r.resourceId.toLowerCase().includes(searchQuery.toLowerCase()));
    return items;
  }, [typeFilter, statusFilter, searchQuery]);

  const groupedResources = useMemo(() => {
    const groups: Record<string, MockResource[]> = {};
    filteredResources.forEach(r => {
      if (!groups[r.awsType]) groups[r.awsType] = [];
      groups[r.awsType].push(r);
    });
    return groups;
  }, [filteredResources]);

  const handleScan = () => {
    setScanState('IN_PROGRESS');
    setTimeout(() => setScanState('COMPLETED'), 2500);
  };

  const clearFilters = () => {
    setTypeFilter(null);
    setStatusFilter(null);
  };

  const hasActiveFilter = typeFilter !== null || statusFilter !== null;

  return (
    <div style={{ minHeight: '100vh', background: F.bg2, fontFamily: F.fontBase, color: F.fg1 }}>
      {/* State Preview Bar */}
      <div style={{ background: F.bg3, borderBottom: `1px solid ${F.stroke2}`, padding: `${F.spaceSm} ${F.spaceLg}`, display: 'flex', gap: F.spaceSm, fontSize: '13px', color: F.fg3 }}>
        <span>현재 상태:</span>
        <button style={{ color: F.brand, textDecoration: 'underline', cursor: 'pointer' }}>Mockup B — Status Dashboard</button>
      </div>

      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: F.spaceXxl }}>
        {/* Breadcrumb + Title */}
        <div style={{ marginBottom: F.spaceLg }}>
          <div style={{ fontSize: '13px', color: F.fg3, marginBottom: F.spaceSm }}>
            프로젝트 관리 &gt; AWS 프로젝트 &gt; {MOCK_PROJECT.projectCode}
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: F.fg1, margin: 0 }}>{MOCK_PROJECT.name}</h1>
        </div>

        {/* Process Steps Bar */}
        <div style={{ background: F.bg1, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusLg, padding: F.spaceLg, marginBottom: F.spaceLg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceSm }}>
            {PROCESS_STEPS.map((step, idx) => (
              <div key={step.step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceSm }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, background: step.status === 'done' ? F.successBg : step.status === 'current' ? F.brandBg : F.bg3, color: step.status === 'done' ? F.success : step.status === 'current' ? F.brand : F.fg4 }}>
                    {step.status === 'done' ? '✓' : step.step}
                  </div>
                  <span style={{ fontSize: '13px', color: step.status === 'current' ? F.fg1 : F.fg3 }}>{step.label}</span>
                </div>
                {idx < PROCESS_STEPS.length - 1 && <div style={{ flex: 1, height: '2px', background: step.status === 'done' ? F.success : F.stroke2, marginLeft: F.spaceSm, marginRight: F.spaceSm }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Info + Status Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: F.spaceLg, marginBottom: F.spaceLg }}>
          <div style={{ background: F.bg1, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusLg, padding: F.spaceLg }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: `0 0 ${F.spaceMd} 0`, color: F.fg2 }}>프로젝트 정보</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: F.spaceSm, fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: F.fg3 }}>서비스 코드</span>
                <span style={{ color: F.fg1 }}>{MOCK_PROJECT.serviceCode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: F.fg3 }}>설치 모드</span>
                <span style={{ color: F.fg1 }}>{MOCK_PROJECT.awsInstallationMode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: F.fg3 }}>생성일</span>
                <span style={{ color: F.fg1 }}>{new Date(MOCK_PROJECT.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
          </div>

          <div style={{ background: F.bg1, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusLg, padding: F.spaceLg }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: `0 0 ${F.spaceMd} 0`, color: F.fg2 }}>연결 요약</h3>
            <div style={{ display: 'flex', gap: F.spaceMd }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 600, color: F.success }}>{stats.statusSummary.connected}</div>
                <div style={{ fontSize: '12px', color: F.fg3, marginTop: F.spaceXs }}>연결됨</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 600, color: F.error }}>{stats.statusSummary.disconnected}</div>
                <div style={{ fontSize: '12px', color: F.fg3, marginTop: F.spaceXs }}>끊김</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 600, color: F.fg4 }}>{stats.statusSummary.pending}</div>
                <div style={{ fontSize: '12px', color: F.fg3, marginTop: F.spaceXs }}>대기</div>
              </div>
            </div>
          </div>
        </div>

        {/* ScanPanel */}
        <div style={{ background: F.bg1, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusLg, padding: F.spaceLg, marginBottom: F.spaceLg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: F.spaceMd }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: F.fg1 }}>리소스 스캔</h3>
            <div style={{ display: 'flex', gap: F.spaceSm }}>
              <button onClick={handleScan} disabled={scanState === 'IN_PROGRESS'} style={{ background: scanState === 'IN_PROGRESS' ? F.bg4 : F.brand, color: F.bg1, border: 'none', borderRadius: F.radiusMd, padding: `${F.spaceSm} ${F.spaceLg}`, fontSize: '13px', fontWeight: 600, cursor: scanState === 'IN_PROGRESS' ? 'not-allowed' : 'pointer' }}>
                {scanState === 'IN_PROGRESS' ? '스캔 중...' : '스캔 시작'}
              </button>
              <button onClick={() => setShowHistory(!showHistory)} style={{ background: F.bg3, color: F.fg2, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusMd, padding: `${F.spaceSm} ${F.spaceLg}`, fontSize: '13px', cursor: 'pointer' }}>
                히스토리 {showHistory ? '숨기기' : '보기'}
              </button>
            </div>
          </div>

          {scanState === 'COMPLETED' && MOCK_SCAN_RESULT && (
            <div>
              <div style={{ height: '8px', background: F.bg3, borderRadius: F.radiusSm, overflow: 'hidden', display: 'flex', marginBottom: F.spaceSm }}>
                {MOCK_SCAN_RESULT.byResourceType.map(item => {
                  const percent = (item.count / MOCK_SCAN_RESULT.totalFound) * 100;
                  const meta = AWS_TYPE_META[item.resourceType];
                  return <div key={item.resourceType} style={{ width: `${percent}%`, background: meta?.color || F.fg4 }} />;
                })}
              </div>
              <div style={{ fontSize: '13px', color: F.fg3 }}>
                {MOCK_SCAN_RESULT.totalFound}개 발견 · 신규 {MOCK_SCAN_RESULT.newFound} · 업데이트 {MOCK_SCAN_RESULT.updated}
              </div>
            </div>
          )}

          {showHistory && (
            <div style={{ marginTop: F.spaceMd, borderTop: `1px solid ${F.stroke2}`, paddingTop: F.spaceMd }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, margin: `0 0 ${F.spaceSm} 0`, color: F.fg2 }}>스캔 히스토리</h4>
              {MOCK_SCAN_HISTORY.map(entry => (
                <div key={entry.id} style={{ fontSize: '12px', color: F.fg3, marginBottom: F.spaceXs, display: 'flex', gap: F.spaceMd }}>
                  <span>{new Date(entry.completedAt).toLocaleString('ko-KR')}</span>
                  <span style={{ color: entry.status === 'COMPLETED' ? F.success : F.error }}>{entry.status}</span>
                  <span>{entry.duration}s</span>
                  {entry.result && <span>{entry.result.totalFound}개 발견</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ★ STATUS DASHBOARD STRIP */}
        <div style={{ marginBottom: F.spaceLg }}>
          {/* Type Distribution Cards */}
          <div style={{ display: 'flex', gap: F.spaceMd, marginBottom: F.spaceMd }}>
            {Object.entries(stats.byType)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([type, data]) => {
                const meta = AWS_TYPE_META[type];
                const isActive = typeFilter === type;
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(isActive ? null : type)}
                    style={{
                      flex: 1,
                      background: F.bg1,
                      border: `1px solid ${isActive ? F.brand : F.stroke2}`,
                      borderLeft: `4px solid ${meta.color}`,
                      borderRadius: F.radiusXl,
                      padding: F.spaceLg,
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 2px 8px rgba(0, 120, 212, 0.15)' : 'none',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceSm, marginBottom: F.spaceSm }}>
                      <span style={{ fontSize: '20px' }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontSize: '12px', color: F.fg3 }}>{meta.label}</div>
                        <div style={{ fontSize: '20px', fontWeight: 600, color: F.fg1 }}>{data.total}</div>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: F.bg3, borderRadius: F.radiusSm, overflow: 'hidden', display: 'flex' }}>
                      {data.connected > 0 && <div style={{ width: `${(data.connected / data.total) * 100}%`, background: F.success }} />}
                      {data.disconnected > 0 && <div style={{ width: `${(data.disconnected / data.total) * 100}%`, background: F.error }} />}
                      {data.pending > 0 && <div style={{ width: `${(data.pending / data.total) * 100}%`, background: F.fg4 }} />}
                    </div>
                  </button>
                );
              })}
          </div>

          {/* Connection Status Summary Cards */}
          <div style={{ display: 'flex', gap: F.spaceMd }}>
            {[
              { key: 'CONNECTED', label: '연결됨', count: stats.statusSummary.connected, color: F.success, bg: F.successBg },
              { key: 'DISCONNECTED', label: '끊김', count: stats.statusSummary.disconnected, color: F.error, bg: F.errorBg },
              { key: 'PENDING', label: '대기', count: stats.statusSummary.pending, color: F.fg4, bg: F.bg3 },
            ].map(item => {
              const isActive = statusFilter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setStatusFilter(isActive ? null : item.key)}
                  style={{
                    flex: 1,
                    background: F.bg1,
                    border: `1px solid ${isActive ? F.brand : F.stroke2}`,
                    borderRadius: F.radiusXl,
                    padding: F.spaceLg,
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 2px 8px rgba(0, 120, 212, 0.15)' : 'none',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '24px', fontWeight: 600, color: item.color }}>{item.count}</div>
                  <div style={{ fontSize: '12px', color: F.fg3, marginTop: F.spaceXs }}>{item.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ResourceTable */}
        <div style={{ background: F.bg1, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusLg, padding: F.spaceLg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: F.spaceMd }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceMd }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: F.fg1 }}>리소스 목록</h3>
              {hasActiveFilter && (
                <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceSm }}>
                  {typeFilter && <span style={{ fontSize: '13px', color: F.fg3, background: F.bg3, padding: `${F.spaceXs} ${F.spaceSm}`, borderRadius: F.radiusMd }}>{AWS_TYPE_META[typeFilter].label}</span>}
                  {statusFilter && <span style={{ fontSize: '13px', color: F.fg3, background: F.bg3, padding: `${F.spaceXs} ${F.spaceSm}`, borderRadius: F.radiusMd }}>{CONN_STATUS[statusFilter].text}</span>}
                  <button onClick={clearFilters} style={{ fontSize: '12px', color: F.brand, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    필터 해제
                  </button>
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="리소스 ID 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: `${F.spaceSm} ${F.spaceMd}`, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusMd, fontSize: '13px', width: '240px', outline: 'none' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${F.stroke2}` }}>
                  <th style={{ padding: `${F.spaceSm} ${F.spaceMd}`, textAlign: 'left', fontWeight: 600, color: F.fg2, width: '40px' }}>✓</th>
                  <th style={{ padding: `${F.spaceSm} ${F.spaceMd}`, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>Resource ID</th>
                  <th style={{ padding: `${F.spaceSm} ${F.spaceMd}`, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>DB Type</th>
                  <th style={{ padding: `${F.spaceSm} ${F.spaceMd}`, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>Region</th>
                  <th style={{ padding: `${F.spaceSm} ${F.spaceMd}`, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>Status</th>
                  <th style={{ padding: `${F.spaceSm} ${F.spaceMd}`, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>Credential</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedResources).map(([type, resources]) => (
                  <tbody key={type}>
                    <tr style={{ background: F.bg3 }}>
                      <td colSpan={6} style={{ padding: `${F.spaceSm} ${F.spaceMd}`, fontSize: '12px', fontWeight: 600, color: F.fg2 }}>
                        {AWS_TYPE_META[type].icon} {AWS_TYPE_META[type].label} ({resources.length})
                      </td>
                    </tr>
                    {resources.map(resource => {
                      const connStatus = CONN_STATUS[resource.connectionStatus];
                      const needsCred = NEEDS_CREDENTIAL[resource.databaseType];
                      const credName = resource.selectedCredentialId ? MOCK_CREDENTIALS.find(c => c.id === resource.selectedCredentialId)?.name : null;
                      return (
                        <tr key={resource.id} style={{ borderBottom: `1px solid ${F.stroke3}`, background: resource.isNew ? F.infoBg : 'transparent' }}>
                          <td style={{ padding: `${F.spaceSm} ${F.spaceMd}`, textAlign: 'center' }}>
                            <input type="checkbox" checked={resource.isSelected} readOnly style={{ cursor: 'pointer' }} />
                          </td>
                          <td style={{ padding: `${F.spaceSm} ${F.spaceMd}`, color: F.fg1, fontFamily: F.fontMono }}>{resource.resourceId}</td>
                          <td style={{ padding: `${F.spaceSm} ${F.spaceMd}`, color: F.fg2 }}>{resource.databaseType}</td>
                          <td style={{ padding: `${F.spaceSm} ${F.spaceMd}`, color: F.fg2 }}>{REGION_MAP[resource.region]}</td>
                          <td style={{ padding: `${F.spaceSm} ${F.spaceMd}` }}>
                            <span style={{ display: 'inline-block', padding: `${F.spaceXs} ${F.spaceSm}`, borderRadius: F.radiusSm, fontSize: '12px', background: connStatus.bgColor, color: connStatus.color, fontWeight: 600 }}>
                              {connStatus.text}
                            </span>
                          </td>
                          <td style={{ padding: `${F.spaceSm} ${F.spaceMd}`, color: needsCred ? (credName ? F.fg1 : F.error) : F.fg4 }}>
                            {needsCred ? (credName || '필요') : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ marginTop: F.spaceLg, display: 'flex', justifyContent: 'flex-end', gap: F.spaceMd }}>
          <button style={{ background: F.bg3, color: F.fg2, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusMd, padding: `${F.spaceSm} ${F.spaceLg}`, fontSize: '13px', cursor: 'pointer' }}>
            취소
          </button>
          <button style={{ background: F.brand, color: F.bg1, border: 'none', borderRadius: F.radiusMd, padding: `${F.spaceSm} ${F.spaceLg}`, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            선택 항목 연결 테스트
          </button>
        </div>
      </div>
    </div>
  );
}
