'use client';

import { useState } from 'react';
import {
  F,
  MOCK_PROJECT,
  MOCK_RESOURCES,
  MOCK_SCAN_RESULT,
  MOCK_SCAN_HISTORY,
  MOCK_CREDENTIALS,
  PROCESS_STEPS,
  REGION_MAP,
  AWS_TYPE_META,
  CONN_STATUS,
  NEEDS_CREDENTIAL,
  type MockResource,
  type ScanUIState,
} from '../_data';

type FilterMode = 'all' | 'selected' | 'new' | 'disconnected';

export default function MockupAPage() {
  const [scanState, setScanState] = useState<ScanUIState>('IDLE');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showScanBanner, setShowScanBanner] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredResources = MOCK_RESOURCES.filter((r) => {
    if (filter === 'selected' && !r.isSelected) return false;
    if (filter === 'new' && !r.isNew) return false;
    if (filter === 'disconnected' && r.connectionStatus !== 'DISCONNECTED') return false;
    if (searchQuery && !r.resourceId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const groupedByType = filteredResources.reduce((acc, r) => {
    if (!acc[r.awsType]) acc[r.awsType] = [];
    acc[r.awsType].push(r);
    return acc;
  }, {} as Record<string, MockResource[]>);

  const connSummary = {
    connected: MOCK_RESOURCES.filter((r) => r.connectionStatus === 'CONNECTED').length,
    disconnected: MOCK_RESOURCES.filter((r) => r.connectionStatus === 'DISCONNECTED').length,
    pending: MOCK_RESOURCES.filter((r) => r.connectionStatus === 'PENDING').length,
  };

  const handleStartScan = () => {
    setScanState('IN_PROGRESS');
    setTimeout(() => {
      setScanState('COMPLETED');
      setShowScanBanner(true);
    }, 2000);
  };

  const handleFilterNew = () => {
    setFilter('new');
  };

  return (
    <div style={{ minHeight: '100vh', background: F.bg3, fontFamily: F.fontBase }}>
      {/* State Preview Bar (mockup controls) */}
      <div style={{ background: F.bg1, borderBottom: `1px solid ${F.stroke2}`, padding: F.spaceMd }}>
        <div style={{ display: 'flex', gap: F.spaceSm }}>
          <button
            onClick={() => {
              setScanState('IDLE');
              setShowScanBanner(false);
            }}
            style={{
              padding: `${F.spaceXs} ${F.spaceSm}`,
              background: scanState === 'IDLE' ? F.brand : F.bg2,
              color: scanState === 'IDLE' ? F.bg1 : F.fg2,
              border: `1px solid ${F.stroke1}`,
              borderRadius: F.radiusMd,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Normal
          </button>
          <button
            onClick={() => {
              setScanState('IN_PROGRESS');
              setShowScanBanner(false);
            }}
            style={{
              padding: `${F.spaceXs} ${F.spaceSm}`,
              background: scanState === 'IN_PROGRESS' ? F.brand : F.bg2,
              color: scanState === 'IN_PROGRESS' ? F.bg1 : F.fg2,
              border: `1px solid ${F.stroke1}`,
              borderRadius: F.radiusMd,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Scan In Progress
          </button>
          <button
            onClick={() => {
              setScanState('COMPLETED');
              setShowScanBanner(true);
            }}
            style={{
              padding: `${F.spaceXs} ${F.spaceSm}`,
              background: scanState === 'COMPLETED' ? F.brand : F.bg2,
              color: scanState === 'COMPLETED' ? F.bg1 : F.fg2,
              border: `1px solid ${F.stroke1}`,
              borderRadius: F.radiusMd,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Scan Completed
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: F.spaceXxl }}>
        {/* Project Header */}
        <div style={{ marginBottom: F.spaceLg }}>
          <div style={{ fontSize: '13px', color: F.fg3, marginBottom: F.spaceSm }}>
            관리자 &gt; {MOCK_PROJECT.serviceCode} &gt; {MOCK_PROJECT.projectCode}
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: F.fg1, margin: 0 }}>{MOCK_PROJECT.name}</h1>
          <p style={{ fontSize: '14px', color: F.fg2, margin: `${F.spaceXs} 0 0 0` }}>{MOCK_PROJECT.description}</p>
        </div>

        {/* Process Steps Bar */}
        <div
          style={{
            background: F.bg1,
            border: `1px solid ${F.stroke2}`,
            borderRadius: F.radiusXl,
            padding: F.spaceLg,
            marginBottom: F.spaceLg,
          }}
        >
          <div style={{ display: 'flex', gap: F.spaceLg, alignItems: 'center' }}>
            {PROCESS_STEPS.map((s, idx) => (
              <div key={s.step} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: F.spaceSm }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: s.status === 'done' ? F.brand : s.status === 'current' ? F.brandBg : F.bg3,
                    color: s.status === 'done' ? F.bg1 : s.status === 'current' ? F.brand : F.fg4,
                    border: s.status === 'current' ? `2px solid ${F.brand}` : 'none',
                  }}
                >
                  {s.step}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: s.status === 'pending' ? F.fg4 : F.fg1 }}>
                    {s.label}
                  </div>
                </div>
                {idx < PROCESS_STEPS.length - 1 && (
                  <div style={{ width: '24px', height: '1px', background: F.stroke2, flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Info + Status Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: F.spaceLg, marginBottom: F.spaceLg }}>
          <div
            style={{
              background: F.bg1,
              border: `1px solid ${F.stroke2}`,
              borderRadius: F.radiusXl,
              padding: F.spaceLg,
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: F.fg1, margin: `0 0 ${F.spaceMd} 0` }}>
              프로젝트 정보
            </h3>
            <div style={{ display: 'grid', gap: F.spaceSm, fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: F.fg3 }}>프로젝트 코드</span>
                <span style={{ color: F.fg1, fontWeight: 500 }}>{MOCK_PROJECT.projectCode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: F.fg3 }}>서비스</span>
                <span style={{ color: F.fg1, fontWeight: 500 }}>{MOCK_PROJECT.serviceCode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: F.fg3 }}>클라우드</span>
                <span style={{ color: F.fg1, fontWeight: 500 }}>{MOCK_PROJECT.cloudProvider}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: F.fg3 }}>설치 모드</span>
                <span style={{ color: F.fg1, fontWeight: 500 }}>{MOCK_PROJECT.awsInstallationMode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: F.fg3 }}>생성일</span>
                <span style={{ color: F.fg1, fontWeight: 500 }}>
                  {new Date(MOCK_PROJECT.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: F.bg1,
              border: `1px solid ${F.stroke2}`,
              borderRadius: F.radiusXl,
              padding: F.spaceLg,
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: F.fg1, margin: `0 0 ${F.spaceMd} 0` }}>
              연결 현황
            </h3>
            <div style={{ display: 'flex', gap: F.spaceSm }}>
              <div
                style={{
                  flex: 1,
                  padding: F.spaceMd,
                  background: F.successBg,
                  borderRadius: F.radiusMd,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: 600, color: F.success }}>{connSummary.connected}</div>
                <div style={{ fontSize: '12px', color: F.fg3, marginTop: F.spaceXs }}>연결</div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: F.spaceMd,
                  background: F.errorBg,
                  borderRadius: F.radiusMd,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: 600, color: F.error }}>{connSummary.disconnected}</div>
                <div style={{ fontSize: '12px', color: F.fg3, marginTop: F.spaceXs }}>끊김</div>
              </div>
              <div
                style={{ flex: 1, padding: F.spaceMd, background: F.bg3, borderRadius: F.radiusMd, textAlign: 'center' }}
              >
                <div style={{ fontSize: '20px', fontWeight: 600, color: F.fg2 }}>{connSummary.pending}</div>
                <div style={{ fontSize: '12px', color: F.fg3, marginTop: F.spaceXs }}>대기</div>
              </div>
            </div>
          </div>
        </div>

        {/* ★ UNIFIED SCAN + RESOURCE CARD */}
        <div
          style={{
            background: F.bg1,
            border: `1px solid ${F.stroke2}`,
            borderRadius: F.radiusXl,
            overflow: 'hidden',
            marginBottom: F.spaceLg,
          }}
        >
          {/* CommandBar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: F.spaceLg,
              borderBottom: `1px solid ${F.stroke2}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceMd }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: F.fg1, margin: 0 }}>리소스</h3>
              <span
                style={{
                  padding: `${F.spaceXs} ${F.spaceSm}`,
                  background: F.bg3,
                  color: F.fg2,
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: F.radiusMd,
                }}
              >
                {filteredResources.length}
              </span>
              <div style={{ display: 'flex', gap: F.spaceXs }}>
                {(['all', 'selected', 'new', 'disconnected'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: `${F.spaceXs} ${F.spaceSm}`,
                      background: filter === f ? F.brandBg : 'transparent',
                      color: filter === f ? F.brand : F.fg2,
                      border: `1px solid ${filter === f ? F.brand : F.stroke2}`,
                      borderRadius: F.radiusMd,
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: filter === f ? 600 : 400,
                    }}
                  >
                    {f === 'all' && '전체'}
                    {f === 'selected' && '연동 대상'}
                    {f === 'new' && '신규'}
                    {f === 'disconnected' && '끊김'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: F.spaceSm, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="리소스 ID 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: `${F.spaceXs} ${F.spaceSm}`,
                  border: `1px solid ${F.stroke1}`,
                  borderRadius: F.radiusMd,
                  fontSize: '13px',
                  width: '200px',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleStartScan}
                disabled={scanState === 'IN_PROGRESS'}
                style={{
                  padding: `${F.spaceXs} ${F.spaceMd}`,
                  background: scanState === 'IN_PROGRESS' ? F.bg3 : F.brand,
                  color: F.bg1,
                  border: 'none',
                  borderRadius: F.radiusMd,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: scanState === 'IN_PROGRESS' ? 'not-allowed' : 'pointer',
                }}
              >
                {scanState === 'IN_PROGRESS' ? '스캔 중...' : '스캔 시작'}
              </button>
            </div>
          </div>

          {/* Scan Result Banner */}
          {showScanBanner && (
            <div
              style={{
                padding: F.spaceMd,
                background: F.infoBg,
                borderBottom: `1px solid ${F.stroke2}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceMd, fontSize: '13px', color: F.fg1 }}>
                <span>
                  <strong>{MOCK_SCAN_RESULT.totalFound}개 발견</strong> · 신규{' '}
                  <span
                    onClick={handleFilterNew}
                    style={{ color: F.brand, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {MOCK_SCAN_RESULT.newFound}
                  </span>{' '}
                  · 업데이트 {MOCK_SCAN_RESULT.updated} · 제거 {MOCK_SCAN_RESULT.removed}
                </span>
                <span style={{ color: F.fg3, fontSize: '12px' }}>마지막 스캔: 2026-02-05 14:22</span>
              </div>
              <button
                onClick={() => setShowScanBanner(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: F.fg3,
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Resource Table */}
          <div style={{ padding: F.spaceLg }}>
            {Object.entries(groupedByType).map(([awsType, resources]) => {
              const meta = AWS_TYPE_META[awsType];
              return (
                <div key={awsType} style={{ marginBottom: F.spaceLg }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: F.spaceSm,
                      padding: `${F.spaceSm} ${F.spaceMd}`,
                      background: F.bg2,
                      borderLeft: `3px solid ${meta.color}`,
                      marginBottom: F.spaceSm,
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{meta.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: F.fg1 }}>{meta.label}</span>
                    <span style={{ fontSize: '12px', color: F.fg3 }}>({resources.length})</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: F.bg2, borderBottom: `1px solid ${F.stroke2}` }}>
                        <th style={{ padding: F.spaceSm, textAlign: 'left', width: '40px' }}>
                          <input type="checkbox" />
                        </th>
                        <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>
                          리소스 ID
                        </th>
                        <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>
                          DB 타입
                        </th>
                        <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>리전</th>
                        <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>
                          연결 상태
                        </th>
                        <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>
                          Credential
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map((r) => {
                        const connStatus = CONN_STATUS[r.connectionStatus];
                        const credential = MOCK_CREDENTIALS.find((c) => c.id === r.selectedCredentialId);
                        const needsCred = NEEDS_CREDENTIAL[r.databaseType];
                        const showCredWarning = needsCred && !r.selectedCredentialId;

                        return (
                          <tr
                            key={r.id}
                            style={{
                              background: r.isNew
                                ? F.infoBg
                                : r.connectionStatus === 'DISCONNECTED'
                                  ? F.errorBg
                                  : 'transparent',
                              borderBottom: `1px solid ${F.stroke3}`,
                            }}
                          >
                            <td style={{ padding: F.spaceSm }}>
                              <input type="checkbox" checked={r.isSelected} readOnly />
                            </td>
                            <td style={{ padding: F.spaceSm }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceXs }}>
                                <code style={{ fontFamily: F.fontMono, fontSize: '12px', color: F.fg1 }}>
                                  {r.resourceId}
                                </code>
                                {r.isNew && (
                                  <span
                                    style={{
                                      padding: `2px ${F.spaceXs}`,
                                      background: F.brand,
                                      color: F.bg1,
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      borderRadius: F.radiusSm,
                                    }}
                                  >
                                    NEW
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: F.spaceSm, color: F.fg1 }}>{r.databaseType}</td>
                            <td style={{ padding: F.spaceSm, color: F.fg2 }}>{REGION_MAP[r.region] || r.region}</td>
                            <td style={{ padding: F.spaceSm }}>
                              <span
                                style={{
                                  padding: `${F.spaceXs} ${F.spaceSm}`,
                                  background: connStatus.bgColor,
                                  color: connStatus.color,
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  borderRadius: F.radiusMd,
                                }}
                              >
                                {connStatus.text}
                              </span>
                            </td>
                            <td style={{ padding: F.spaceSm, color: showCredWarning ? F.warning : F.fg2 }}>
                              {showCredWarning ? (
                                <span style={{ fontWeight: 600 }}>⚠️ 필요</span>
                              ) : credential ? (
                                credential.name
                              ) : (
                                <span style={{ color: F.fg4 }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Scan History (expandable footer) */}
          <div style={{ borderTop: `1px solid ${F.stroke2}`, padding: F.spaceMd, background: F.bg2 }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                background: 'transparent',
                border: 'none',
                color: F.brand,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: F.spaceXs,
              }}
            >
              <span>{showHistory ? '▼' : '▶'}</span>
              스캔 이력 ({MOCK_SCAN_HISTORY.length})
            </button>
            {showHistory && (
              <div style={{ marginTop: F.spaceMd }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${F.stroke2}` }}>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>시작</th>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>완료</th>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>상태</th>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>
                        소요 시간
                      </th>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg2 }}>발견</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_SCAN_HISTORY.map((h) => (
                      <tr key={h.id} style={{ borderBottom: `1px solid ${F.stroke3}` }}>
                        <td style={{ padding: F.spaceSm, color: F.fg2 }}>
                          {new Date(h.startedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: F.spaceSm, color: F.fg2 }}>
                          {new Date(h.completedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: F.spaceSm }}>
                          <span
                            style={{
                              padding: `2px ${F.spaceXs}`,
                              background: h.status === 'COMPLETED' ? F.successBg : F.errorBg,
                              color: h.status === 'COMPLETED' ? F.success : F.error,
                              fontSize: '11px',
                              fontWeight: 500,
                              borderRadius: F.radiusSm,
                            }}
                          >
                            {h.status === 'COMPLETED' ? '완료' : '실패'}
                          </span>
                        </td>
                        <td style={{ padding: F.spaceSm, color: F.fg2 }}>{h.duration}초</td>
                        <td style={{ padding: F.spaceSm, color: F.fg1 }}>
                          {h.result ? `${h.result.totalFound}개` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: F.spaceSm }}>
          <button
            style={{
              padding: `${F.spaceSm} ${F.spaceLg}`,
              background: F.bg1,
              color: F.fg1,
              border: `1px solid ${F.stroke1}`,
              borderRadius: F.radiusMd,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            확정 대상 수정
          </button>
          <button
            style={{
              padding: `${F.spaceSm} ${F.spaceLg}`,
              background: F.brand,
              color: F.bg1,
              border: 'none',
              borderRadius: F.radiusMd,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            연동 대상 확정 승인 요청
          </button>
        </div>
      </div>
    </div>
  );
}
