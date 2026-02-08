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
} from '@/app/mockups/resource-scan/_data';
import type { MockResource, ScanUIState } from '@/app/mockups/resource-scan/_data';

export default function MockupCPage() {
  const [scanState, setScanState] = useState<ScanUIState>('COMPLETED');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanBanner, setShowScanBanner] = useState(true);

  const filteredResources = MOCK_RESOURCES.filter((r) => {
    if (statusFilter === 'selected' && !r.isSelected) return false;
    if (statusFilter === 'connected' && r.connectionStatus !== 'CONNECTED') return false;
    if (statusFilter === 'disconnected' && r.connectionStatus !== 'DISCONNECTED') return false;
    if (statusFilter === 'pending' && r.connectionStatus !== 'PENDING') return false;
    if (statusFilter === 'new' && !r.isNew) return false;
    if (typeFilter !== 'all' && r.awsType !== typeFilter) return false;
    if (searchQuery && !r.resourceId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const groupedResources = filteredResources.reduce((acc, r) => {
    if (!acc[r.awsType]) acc[r.awsType] = [];
    acc[r.awsType].push(r);
    return acc;
  }, {} as Record<string, MockResource[]>);

  const typeKeys = Object.keys(groupedResources);

  const typeCounts = MOCK_RESOURCES.reduce((acc, r) => {
    acc[r.awsType] = (acc[r.awsType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: F.bg2, padding: F.spaceXxl, fontFamily: F.fontBase }}>
      {/* 1. State Preview Bar */}
      <div style={{ backgroundColor: F.bg4, padding: F.spaceSm, fontSize: '11px', color: F.fg3, marginBottom: F.spaceLg, borderRadius: F.radiusMd }}>
        [Mockup C — Inline Enriched] Scan: {scanState} | Status: {statusFilter} | Type: {typeFilter} | Search: "{searchQuery}" | Results: {filteredResources.length}
      </div>

      {/* 2. Project Header */}
      <div style={{ marginBottom: F.spaceXxl }}>
        <div style={{ fontSize: '11px', color: F.fg3, marginBottom: F.spaceXs }}>{MOCK_PROJECT.projectCode}</div>
        <h1 style={{ fontSize: '28px', fontWeight: 600, color: F.fg1, marginBottom: F.spaceSm }}>{MOCK_PROJECT.name}</h1>
        <p style={{ color: F.fg2 }}>{MOCK_PROJECT.description}</p>
      </div>

      {/* 3. Process Steps Bar */}
      <div style={{ display: 'flex', gap: F.spaceXs, marginBottom: F.spaceXxl }}>
        {PROCESS_STEPS.map((s) => (
          <div
            key={s.step}
            style={{
              flex: 1,
              height: '48px',
              backgroundColor: s.status === 'done' ? F.successBg : s.status === 'current' ? F.brandBg : F.bg3,
              borderLeft: `3px solid ${s.status === 'done' ? F.success : s.status === 'current' ? F.brand : F.stroke1}`,
              padding: F.spaceMd,
              borderRadius: F.radiusMd,
              fontSize: '13px',
              fontWeight: 500,
              color: s.status === 'pending' ? F.fg3 : F.fg1,
            }}
          >
            {s.step}. {s.label}
          </div>
        ))}
      </div>

      {/* 4. Info + Status Row */}
      <div style={{ display: 'flex', gap: F.spaceLg, marginBottom: F.spaceXxl }}>
        <div style={{ flex: 1, backgroundColor: F.bg1, padding: F.spaceLg, borderRadius: F.radiusLg, border: `1px solid ${F.stroke2}` }}>
          <div style={{ fontSize: '12px', color: F.fg3, marginBottom: F.spaceXs }}>Cloud Provider</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: F.fg1 }}>Amazon Web Services</div>
        </div>
        <div style={{ flex: 1, backgroundColor: F.bg1, padding: F.spaceLg, borderRadius: F.radiusLg, border: `1px solid ${F.stroke2}` }}>
          <div style={{ fontSize: '12px', color: F.fg3, marginBottom: F.spaceXs }}>연결 대상</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: F.fg1 }}>12개 리소스</div>
        </div>
        <div style={{ flex: 1, backgroundColor: F.bg1, padding: F.spaceLg, borderRadius: F.radiusLg, border: `1px solid ${F.stroke2}` }}>
          <div style={{ fontSize: '12px', color: F.fg3, marginBottom: F.spaceXs }}>연결 상태</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: F.success }}>8개 연결됨</div>
        </div>
      </div>

      {/* 5. ScanPanel — enriched */}
      <div style={{ backgroundColor: F.bg1, padding: F.spaceXxl, borderRadius: F.radiusLg, border: `1px solid ${F.stroke2}`, marginBottom: F.spaceXxl }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: F.spaceLg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceMd }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: `${F.spaceXs} ${F.spaceSm}`,
                borderRadius: F.radiusSm,
                backgroundColor: scanState === 'COMPLETED' ? F.successBg : scanState === 'IN_PROGRESS' ? F.warningBg : F.bg3,
                color: scanState === 'COMPLETED' ? F.success : scanState === 'IN_PROGRESS' ? F.warning : F.fg3,
              }}
            >
              {scanState === 'COMPLETED' ? '완료' : scanState === 'IN_PROGRESS' ? '진행중' : '대기'}
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: F.fg1 }}>리소스 스캔 (AWS)</h2>
          </div>
          <button
            onClick={() => setScanState('IN_PROGRESS')}
            style={{
              padding: `${F.spaceSm} ${F.spaceLg}`,
              backgroundColor: F.brand,
              color: '#fff',
              border: 'none',
              borderRadius: F.radiusMd,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            스캔 시작
          </button>
        </div>

        {scanState === 'COMPLETED' && (
          <>
            {/* Result tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: F.spaceMd, marginBottom: F.spaceLg }}>
              <div style={{ backgroundColor: F.bg2, borderLeft: `4px solid ${F.brand}`, padding: F.spaceMd, borderRadius: F.radiusMd }}>
                <div style={{ fontSize: '11px', color: F.fg3, marginBottom: F.spaceXs }}>전체 발견</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: F.brand }}>{MOCK_SCAN_RESULT.totalFound}</div>
              </div>
              <button
                onClick={() => setStatusFilter('new')}
                style={{
                  backgroundColor: F.bg2,
                  borderLeft: `4px solid ${F.info}`,
                  padding: F.spaceMd,
                  borderRadius: F.radiusMd,
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: '11px', color: F.fg3, marginBottom: F.spaceXs }}>
                  신규 <span style={{ fontSize: '10px' }}>🔗</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: F.info }}>{MOCK_SCAN_RESULT.newFound}</div>
              </button>
              <div style={{ backgroundColor: F.bg2, borderLeft: `4px solid ${F.warning}`, padding: F.spaceMd, borderRadius: F.radiusMd }}>
                <div style={{ fontSize: '11px', color: F.fg3, marginBottom: F.spaceXs }}>업데이트</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: F.warning }}>{MOCK_SCAN_RESULT.updated}</div>
              </div>
              <div style={{ backgroundColor: F.bg2, borderLeft: `4px solid ${F.error}`, padding: F.spaceMd, borderRadius: F.radiusMd }}>
                <div style={{ fontSize: '11px', color: F.fg3, marginBottom: F.spaceXs }}>제거</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: F.error }}>{MOCK_SCAN_RESULT.removed}</div>
              </div>
            </div>

            {/* Type breakdown tags */}
            <div style={{ display: 'flex', gap: F.spaceXs, marginBottom: F.spaceLg, flexWrap: 'wrap' }}>
              {MOCK_SCAN_RESULT.byResourceType.map((t) => (
                <span
                  key={t.resourceType}
                  style={{
                    fontSize: '12px',
                    padding: `${F.spaceXs} ${F.spaceSm}`,
                    backgroundColor: F.bg3,
                    color: F.fg2,
                    borderRadius: F.radiusSm,
                    fontWeight: 500,
                  }}
                >
                  {AWS_TYPE_META[t.resourceType]?.icon} {t.resourceType} {t.count}
                </span>
              ))}
            </div>

            {/* Scan history mini-timeline */}
            <div style={{ borderTop: `1px solid ${F.stroke3}`, paddingTop: F.spaceLg }}>
              <div style={{ fontSize: '12px', color: F.fg3, marginBottom: F.spaceSm }}>최근 스캔</div>
              <div style={{ display: 'flex', gap: F.spaceSm, alignItems: 'center' }}>
                {MOCK_SCAN_HISTORY.slice(0, 3).map((h, idx) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: F.spaceXs }}>
                    <div
                      title={`${new Date(h.startedAt).toLocaleString('ko-KR')} - ${h.status} (${h.duration}s)`}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: h.status === 'COMPLETED' ? F.success : F.error,
                        cursor: 'pointer',
                      }}
                    />
                    {idx < 2 && <div style={{ width: '20px', height: '2px', backgroundColor: F.stroke2 }} />}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {scanState === 'IN_PROGRESS' && (
          <div style={{ textAlign: 'center', padding: F.spaceXxl, color: F.fg3 }}>스캔 진행 중...</div>
        )}
      </div>

      {/* 6. ResourceTable — enriched */}
      <div style={{ backgroundColor: F.bg1, padding: F.spaceXxl, borderRadius: F.radiusLg, border: `1px solid ${F.stroke2}` }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: F.fg1, marginBottom: F.spaceLg }}>연동 대상 리소스</h2>

        {/* Multi-filter bar */}
        <div style={{ marginBottom: F.spaceLg }}>
          {/* Row 1: Status filters */}
          <div style={{ display: 'flex', gap: F.spaceXs, marginBottom: F.spaceSm, flexWrap: 'wrap' }}>
            {['all', 'selected', 'connected', 'disconnected', 'pending', 'new'].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: `${F.spaceXs} ${F.spaceMd}`,
                  fontSize: '12px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: F.radiusSm,
                  cursor: 'pointer',
                  backgroundColor: statusFilter === f ? F.brandBg : F.bg3,
                  color: statusFilter === f ? F.brand : F.fg3,
                }}
              >
                {f === 'all' ? '전체' : f === 'selected' ? '연동 대상' : f === 'connected' ? '연결됨' : f === 'disconnected' ? '끊김' : f === 'pending' ? '대기' : '신규'}
              </button>
            ))}
          </div>

          {/* Row 2: Type filters + Search */}
          <div style={{ display: 'flex', gap: F.spaceXs, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTypeFilter('all')}
              style={{
                padding: `${F.spaceXs} ${F.spaceMd}`,
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                borderRadius: F.radiusSm,
                cursor: 'pointer',
                backgroundColor: typeFilter === 'all' ? F.brandBg : F.bg3,
                color: typeFilter === 'all' ? F.brand : F.fg3,
              }}
            >
              전체 타입
            </button>
            {Object.entries(typeCounts).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                style={{
                  padding: `${F.spaceXs} ${F.spaceMd}`,
                  fontSize: '12px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: F.radiusSm,
                  cursor: 'pointer',
                  backgroundColor: typeFilter === type ? F.brandBg : F.bg3,
                  color: typeFilter === type ? F.brand : F.fg3,
                }}
              >
                {type} ({count})
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="리소스 ID 검색"
              style={{
                padding: `${F.spaceXs} ${F.spaceMd}`,
                fontSize: '13px',
                border: `1px solid ${F.stroke2}`,
                borderRadius: F.radiusMd,
                width: '240px',
              }}
            />
          </div>
        </div>

        {/* Table with type groups */}
        {typeKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: F.spaceXxl, color: F.fg3 }}>
            해당 조건의 리소스가 없습니다.{' '}
            <button
              onClick={() => setScanState('IN_PROGRESS')}
              style={{ color: F.brand, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              스캔 시작
            </button>
          </div>
        ) : (
          typeKeys.map((typeKey) => {
            const resources = groupedResources[typeKey];
            const meta = AWS_TYPE_META[typeKey];
            const connectedCount = resources.filter((r) => r.connectionStatus === 'CONNECTED').length;
            const disconnectedCount = resources.filter((r) => r.connectionStatus === 'DISCONNECTED').length;
            const pendingCount = resources.filter((r) => r.connectionStatus === 'PENDING').length;
            const total = resources.length;

            return (
              <div key={typeKey} style={{ marginBottom: F.spaceXxl }}>
                {/* Type group header */}
                <div style={{ marginBottom: F.spaceMd, borderLeft: `4px solid ${meta.color}`, paddingLeft: F.spaceMd }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceSm, marginBottom: F.spaceXs }}>
                    <span style={{ fontSize: '16px' }}>{meta.icon}</span>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: F.fg1 }}>{meta.label}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: `${F.spaceXs} ${F.spaceSm}`,
                        backgroundColor: F.bg3,
                        color: F.fg2,
                        borderRadius: F.radiusSm,
                      }}
                    >
                      {total}
                    </span>
                  </div>
                  {/* Mini status bar */}
                  <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                    {connectedCount > 0 && <div style={{ flex: connectedCount, backgroundColor: F.success }} />}
                    {disconnectedCount > 0 && <div style={{ flex: disconnectedCount, backgroundColor: F.error }} />}
                    {pendingCount > 0 && <div style={{ flex: pendingCount, backgroundColor: F.fg4 }} />}
                  </div>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: F.bg2, borderBottom: `1px solid ${F.stroke2}` }}>
                      <th style={{ padding: F.spaceSm, textAlign: 'center', fontSize: '12px', color: F.fg3, fontWeight: 600, width: '40px' }}>✓</th>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontSize: '12px', color: F.fg3, fontWeight: 600 }}>Resource ID</th>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontSize: '12px', color: F.fg3, fontWeight: 600 }}>DB Type</th>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontSize: '12px', color: F.fg3, fontWeight: 600 }}>Region</th>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontSize: '12px', color: F.fg3, fontWeight: 600 }}>Status</th>
                      <th style={{ padding: F.spaceSm, textAlign: 'left', fontSize: '12px', color: F.fg3, fontWeight: 600 }}>Credential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((r) => {
                      const connStatus = CONN_STATUS[r.connectionStatus];
                      const needsCred = NEEDS_CREDENTIAL[r.databaseType];
                      const hasCred = !!r.selectedCredentialId;

                      return (
                        <tr
                          key={r.id}
                          style={{
                            borderBottom: `1px solid ${F.stroke3}`,
                            borderLeft: r.isNew ? `4px solid ${F.info}` : r.connectionStatus === 'DISCONNECTED' ? `4px solid ${F.error}` : 'none',
                            backgroundColor: r.isNew ? F.infoBg : r.connectionStatus === 'DISCONNECTED' ? F.errorBg : 'transparent',
                          }}
                        >
                          <td style={{ padding: F.spaceSm, textAlign: 'center' }}>
                            <input type="checkbox" checked={r.isSelected} readOnly />
                          </td>
                          <td style={{ padding: F.spaceSm, fontFamily: F.fontMono, fontSize: '13px', color: F.fg1 }}>
                            {r.resourceId}
                            {r.isNew && (
                              <span
                                style={{
                                  marginLeft: F.spaceXs,
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: `2px ${F.spaceXs}`,
                                  backgroundColor: F.info,
                                  color: '#fff',
                                  borderRadius: F.radiusSm,
                                }}
                              >
                                NEW
                              </span>
                            )}
                          </td>
                          <td style={{ padding: F.spaceSm, fontSize: '13px', color: F.fg2 }}>{r.databaseType}</td>
                          <td style={{ padding: F.spaceSm, fontSize: '13px', color: F.fg2 }}>{REGION_MAP[r.region] || r.region}</td>
                          <td style={{ padding: F.spaceSm, fontSize: '13px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: F.spaceXs }}>
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: connStatus.color,
                                }}
                              />
                              <span style={{ color: connStatus.color }}>{connStatus.text}</span>
                            </span>
                          </td>
                          <td style={{ padding: F.spaceSm, fontSize: '13px', color: F.fg2 }}>
                            {needsCred ? (
                              hasCred ? (
                                <select style={{ padding: F.spaceXs, fontSize: '12px', border: `1px solid ${F.stroke2}`, borderRadius: F.radiusSm }}>
                                  {MOCK_CREDENTIALS.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ padding: `${F.spaceXs} ${F.spaceSm}`, backgroundColor: F.warningBg, color: F.warning, borderRadius: F.radiusSm, fontSize: '11px', fontWeight: 600 }}>
                                  미선택
                                </span>
                              )
                            ) : (
                              <span style={{ color: F.fg4, fontSize: '12px' }}>불필요</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>

      {/* 7. Action Bar */}
      <div style={{ marginTop: F.spaceXxl, display: 'flex', justifyContent: 'flex-end', gap: F.spaceMd }}>
        <button
          style={{
            padding: `${F.spaceSm} ${F.spaceXl}`,
            fontSize: '14px',
            fontWeight: 600,
            border: `1px solid ${F.stroke2}`,
            borderRadius: F.radiusMd,
            backgroundColor: F.bg1,
            color: F.fg2,
            cursor: 'pointer',
          }}
        >
          취소
        </button>
        <button
          style={{
            padding: `${F.spaceSm} ${F.spaceXl}`,
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            borderRadius: F.radiusMd,
            backgroundColor: F.brand,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          다음 단계로
        </button>
      </div>
    </div>
  );
}
