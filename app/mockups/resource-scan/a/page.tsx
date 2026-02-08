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

const TYPE_COLLAPSE_THRESHOLD = 5;

export default function MockupAPage() {
  const [scanState, setScanState] = useState<ScanUIState>('IDLE');
  const [scanExpanded, setScanExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showAllResources, setShowAllResources] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(MOCK_RESOURCES.filter((r) => r.isSelected).map((r) => r.id))
  );

  const selectedResources = MOCK_RESOURCES.filter((r) => r.isSelected);
  const unselectedResources = MOCK_RESOURCES.filter((r) => !r.isSelected);

  const connSummary = {
    connected: selectedResources.filter((r) => r.connectionStatus === 'CONNECTED').length,
    disconnected: selectedResources.filter((r) => r.connectionStatus === 'DISCONNECTED').length,
    pending: selectedResources.filter((r) => r.connectionStatus === 'PENDING').length,
  };

  const handleStartScan = () => {
    setScanState('IN_PROGRESS');
    setScanExpanded(true);
    setTimeout(() => setScanState('COMPLETED'), 2000);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  return (
    <div style={{ minHeight: '100vh', background: F.bg3, fontFamily: F.fontBase }}>
      {/* Mockup State Controls */}
      <div style={{ background: F.bg1, borderBottom: `1px solid ${F.stroke2}`, padding: F.spaceMd }}>
        <div style={{ display: 'flex', gap: F.spaceSm, alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: F.fg4, marginRight: F.spaceSm }}>상태 전환:</span>
          {(['IDLE', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScanState(s)}
              style={{
                padding: `${F.spaceXs} ${F.spaceSm}`,
                background: scanState === s ? F.brand : F.bg2,
                color: scanState === s ? F.bg1 : F.fg2,
                border: `1px solid ${F.stroke1}`,
                borderRadius: F.radiusMd,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {s === 'IDLE' ? 'Normal' : s === 'IN_PROGRESS' ? 'Scanning' : 'Completed'}
            </button>
          ))}
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

        {/* Process Steps */}
        <div style={{ background: F.bg1, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusXl, padding: F.spaceLg, marginBottom: F.spaceLg }}>
          <div style={{ display: 'flex', gap: F.spaceLg, alignItems: 'center' }}>
            {PROCESS_STEPS.map((s, idx) => (
              <div key={s.step} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: F.spaceSm }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 600,
                  background: s.status === 'done' ? F.brand : s.status === 'current' ? F.brandBg : F.bg3,
                  color: s.status === 'done' ? F.bg1 : s.status === 'current' ? F.brand : F.fg4,
                  border: s.status === 'current' ? `2px solid ${F.brand}` : 'none',
                }}>
                  {s.step}
                </div>
                <div style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: s.status === 'pending' ? F.fg4 : F.fg1 }}>
                  {s.label}
                </div>
                {idx < PROCESS_STEPS.length - 1 && (
                  <div style={{ width: '24px', height: '1px', background: F.stroke2, flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Project Info */}
        <div style={{ background: F.bg1, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusXl, padding: F.spaceLg, marginBottom: F.spaceLg }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: F.fg1, margin: `0 0 ${F.spaceMd} 0` }}>프로젝트 정보</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: F.spaceLg, fontSize: '13px' }}>
            {[
              ['프로젝트 코드', MOCK_PROJECT.projectCode],
              ['서비스', MOCK_PROJECT.serviceCode],
              ['클라우드', MOCK_PROJECT.cloudProvider],
              ['설치 모드', MOCK_PROJECT.awsInstallationMode],
            ].map(([label, value]) => (
              <div key={label}>
                <span style={{ color: F.fg3 }}>{label}</span>
                <div style={{ color: F.fg1, fontWeight: 500, marginTop: F.spaceXs }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ★ CLOUD 리소스 — 통합 컨테이너 */}
        <div style={{ background: F.bg1, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusXl, overflow: 'hidden', marginBottom: F.spaceLg }}>

          {/* ── 섹션 헤더 ── */}
          <div style={{ padding: `${F.spaceLg} ${F.spaceLg} 0` }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: F.fg1, margin: 0 }}>Cloud 리소스</h2>
          </div>

          {/* ── 스캔 접이식 패널 ── */}
          <div style={{ margin: F.spaceLg, border: `1px solid ${F.stroke2}`, borderRadius: F.radiusLg, overflow: 'hidden' }}>

            {/* 스캔 Summary (항상 보임) — 스캔 중 vs 평상시 분기 */}
            {scanState === 'IN_PROGRESS' ? (
              /* ── 스캔 중: 진행 상태 우선 표시 ── */
              <div
                onClick={() => setScanExpanded(!scanExpanded)}
                style={{
                  padding: `${F.spaceMd} ${F.spaceLg}`,
                  background: F.warningBg, cursor: 'pointer', userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceMd }}>
                    <span style={{ fontSize: '13px', color: F.warning, transform: scanExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: F.fg1 }}>리소스 스캔</span>
                    <span style={{ padding: `2px ${F.spaceSm}`, background: F.bg1, color: F.warning, fontSize: '12px', fontWeight: 600, borderRadius: F.radiusMd }}>
                      스캔 중...
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: F.fg3 }}>리소스를 검색하고 있습니다</span>
                </div>
                {/* 인라인 진행 바 */}
                <div style={{ marginTop: F.spaceSm, height: '3px', background: 'rgba(255,255,255,0.6)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: '100%', background: F.warning, borderRadius: '2px' }} />
                </div>
              </div>
            ) : (
              /* ── 평상시: 마지막 스캔 결과 + 스캔 버튼 ── */
              <div
                onClick={() => setScanExpanded(!scanExpanded)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: `${F.spaceMd} ${F.spaceLg}`,
                  background: F.bg2, cursor: 'pointer', userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceMd }}>
                  <span style={{ fontSize: '13px', color: F.fg3, transform: scanExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: F.fg1 }}>리소스 스캔</span>
                  {scanState === 'COMPLETED' ? (
                    <span style={{ padding: `2px ${F.spaceSm}`, background: F.successBg, color: F.success, fontSize: '12px', fontWeight: 600, borderRadius: F.radiusMd }}>
                      완료
                    </span>
                  ) : (
                    <span style={{ padding: `2px ${F.spaceSm}`, background: F.bg4, color: F.fg3, fontSize: '12px', fontWeight: 500, borderRadius: F.radiusMd }}>
                      대기
                    </span>
                  )}
                  <span style={{ fontSize: '12px', color: F.fg3 }}>
                    {MOCK_SCAN_RESULT.totalFound}개 발견 · 신규 {MOCK_SCAN_RESULT.newFound}
                  </span>
                  <span style={{ fontSize: '12px', color: F.fg4 }}>|</span>
                  <span style={{ fontSize: '12px', color: F.fg4 }}>마지막: 2026-02-05 14:22</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStartScan(); }}
                  style={{
                    padding: `${F.spaceXs} ${F.spaceMd}`,
                    background: F.brand, color: F.bg1,
                    border: 'none', borderRadius: F.radiusMd,
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  스캔 시작
                </button>
              </div>
            )}

            {/* 스캔 상세 (펼침 시) */}
            {scanExpanded && (
              <div style={{ borderTop: `1px solid ${F.stroke2}`, padding: F.spaceLg }}>
                {/* 결과 메트릭 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: F.spaceMd, marginBottom: F.spaceLg }}>
                  {[
                    { label: '발견', value: MOCK_SCAN_RESULT.totalFound, color: F.fg1 },
                    { label: '신규', value: MOCK_SCAN_RESULT.newFound, color: F.brand },
                    { label: '업데이트', value: MOCK_SCAN_RESULT.updated, color: F.warning },
                    { label: '제거', value: MOCK_SCAN_RESULT.removed, color: F.fg4 },
                  ].map((m) => (
                    <div key={m.label} style={{ padding: F.spaceMd, background: F.bg2, borderRadius: F.radiusMd, textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: m.color }}>{m.value}</div>
                      <div style={{ fontSize: '12px', color: F.fg3, marginTop: F.spaceXs }}>{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* 타입별 분포 */}
                <div style={{ marginBottom: F.spaceLg }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: F.fg3, marginBottom: F.spaceSm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    타입별 분포
                  </div>
                  <div style={{ display: 'flex', gap: F.spaceSm }}>
                    {MOCK_SCAN_RESULT.byResourceType.map((t) => {
                      const meta = AWS_TYPE_META[t.resourceType];
                      return (
                        <div key={t.resourceType} style={{
                          display: 'flex', alignItems: 'center', gap: F.spaceXs,
                          padding: `${F.spaceXs} ${F.spaceSm}`,
                          background: F.bg2, borderRadius: F.radiusMd, fontSize: '12px',
                        }}>
                          <span>{meta?.icon}</span>
                          <span style={{ color: F.fg2 }}>{t.resourceType}</span>
                          <span style={{ fontWeight: 600, color: F.fg1 }}>{t.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 스캔 이력 */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: F.fg3, marginBottom: F.spaceSm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    스캔 이력
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${F.stroke2}` }}>
                        {['일시', '상태', '소요', '결과'].map((h) => (
                          <th key={h} style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg3 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_SCAN_HISTORY.map((h) => (
                        <tr key={h.id} style={{ borderBottom: `1px solid ${F.stroke3}` }}>
                          <td style={{ padding: F.spaceSm, color: F.fg2 }}>
                            {new Date(h.startedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td style={{ padding: F.spaceSm }}>
                            <span style={{
                              padding: `2px ${F.spaceXs}`,
                              background: h.status === 'COMPLETED' ? F.successBg : F.errorBg,
                              color: h.status === 'COMPLETED' ? F.success : F.error,
                              fontSize: '11px', fontWeight: 500, borderRadius: F.radiusSm,
                            }}>
                              {h.status === 'COMPLETED' ? '완료' : '실패'}
                            </span>
                          </td>
                          <td style={{ padding: F.spaceSm, color: F.fg2 }}>{h.duration}초</td>
                          <td style={{ padding: F.spaceSm, color: F.fg1 }}>
                            {h.result ? `${h.result.totalFound}개 발견 · 신규 ${h.result.newFound}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── 연동 대상 리소스 테이블 (항상 보임) ── */}
          <div style={{ padding: `0 ${F.spaceLg} ${F.spaceLg}` }}>

            {/* 테이블 헤더 바 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: F.spaceMd }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceMd }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: F.fg1, margin: 0 }}>연동 대상</h3>
                <span style={{ padding: `2px ${F.spaceSm}`, background: F.bg3, color: F.fg2, fontSize: '12px', fontWeight: 600, borderRadius: F.radiusMd }}>
                  {selectedResources.length}
                </span>
                <div style={{ display: 'flex', gap: F.spaceXs }}>
                  <span style={{ padding: `2px ${F.spaceSm}`, background: F.successBg, color: F.success, fontSize: '11px', fontWeight: 500, borderRadius: F.radiusSm }}>
                    연결 {connSummary.connected}
                  </span>
                  {connSummary.disconnected > 0 && (
                    <span style={{ padding: `2px ${F.spaceSm}`, background: F.errorBg, color: F.error, fontSize: '11px', fontWeight: 500, borderRadius: F.radiusSm }}>
                      끊김 {connSummary.disconnected}
                    </span>
                  )}
                  {connSummary.pending > 0 && (
                    <span style={{ padding: `2px ${F.spaceSm}`, background: F.bg4, color: F.fg3, fontSize: '11px', fontWeight: 500, borderRadius: F.radiusSm }}>
                      대기 {connSummary.pending}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setEditMode(!editMode)}
                style={{
                  padding: `${F.spaceXs} ${F.spaceMd}`,
                  background: editMode ? F.brandBg : 'transparent',
                  color: editMode ? F.brand : F.fg2,
                  border: `1px solid ${editMode ? F.brand : F.stroke1}`,
                  borderRadius: F.radiusMd, fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                }}
              >
                {editMode ? '수정 완료' : '대상 수정'}
              </button>
            </div>

            {/* 리소스 테이블 */}
            <ResourceTable
              resources={selectedResources}
              showCheckbox={editMode}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />

            {/* 비연동 리소스 (확장) */}
            {unselectedResources.length > 0 && (
              <div style={{ marginTop: F.spaceLg }}>
                <button
                  onClick={() => setShowAllResources(!showAllResources)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: F.brand, fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: F.spaceXs,
                    padding: 0,
                  }}
                >
                  <span style={{ transform: showAllResources ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                  비연동 리소스 ({unselectedResources.length})
                </button>
                {showAllResources && (
                  <div style={{ marginTop: F.spaceMd }}>
                    <ResourceTable
                      resources={unselectedResources}
                      showCheckbox={editMode}
                      selectedIds={selectedIds}
                      onToggle={toggleSelect}
                      dimmed
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: F.spaceSm }}>
          <button style={{
            padding: `${F.spaceSm} ${F.spaceLg}`, background: F.bg1, color: F.fg1,
            border: `1px solid ${F.stroke1}`, borderRadius: F.radiusMd, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>
            확정 대상 수정
          </button>
          <button style={{
            padding: `${F.spaceSm} ${F.spaceLg}`, background: F.brand, color: F.bg1,
            border: 'none', borderRadius: F.radiusMd, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>
            연동 대상 확정 승인 요청
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ResourceTable 서브 컴포넌트 ── */
interface ResourceTableProps {
  resources: MockResource[];
  showCheckbox: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  dimmed?: boolean;
}

const ResourceTable = ({ resources, showCheckbox, selectedIds, onToggle, dimmed }: ResourceTableProps) => {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const grouped = resources.reduce((acc, r) => {
    if (!acc[r.awsType]) acc[r.awsType] = [];
    acc[r.awsType].push(r);
    return acc;
  }, {} as Record<string, MockResource[]>);

  if (resources.length === 0) {
    return (
      <div style={{ padding: F.spaceLg, textAlign: 'center', color: F.fg4, fontSize: '13px' }}>
        해당하는 리소스가 없습니다.
      </div>
    );
  }

  const toggleType = (type: string) => {
    const next = new Set(expandedTypes);
    next.has(type) ? next.delete(type) : next.add(type);
    setExpandedTypes(next);
  };

  return (
    <>
      {Object.entries(grouped).map(([awsType, items]) => {
        const meta = AWS_TYPE_META[awsType];
        const needsCollapse = items.length > TYPE_COLLAPSE_THRESHOLD;
        const isExpanded = expandedTypes.has(awsType);
        const visibleItems = needsCollapse && !isExpanded ? items.slice(0, TYPE_COLLAPSE_THRESHOLD) : items;
        const hiddenCount = items.length - TYPE_COLLAPSE_THRESHOLD;

        return (
          <div key={awsType} style={{ marginBottom: F.spaceMd, opacity: dimmed ? 0.6 : 1 }}>
            {/* 타입 그룹 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: F.spaceSm,
              padding: `${F.spaceXs} ${F.spaceSm}`,
              borderLeft: `3px solid ${meta?.color || F.fg3}`,
              background: F.bg2, marginBottom: '1px',
            }}>
              <span style={{ fontSize: '14px' }}>{meta?.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: F.fg1 }}>{meta?.label || awsType}</span>
              <span style={{ fontSize: '12px', color: F.fg3 }}>({items.length})</span>
            </div>

            {/* 테이블 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: F.bg2, borderBottom: `1px solid ${F.stroke2}` }}>
                  {showCheckbox && <th style={{ padding: F.spaceSm, width: '36px' }} />}
                  <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg3 }}>리소스 ID</th>
                  <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg3 }}>DB 타입</th>
                  <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg3 }}>리전</th>
                  <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg3 }}>연결 상태</th>
                  <th style={{ padding: F.spaceSm, textAlign: 'left', fontWeight: 600, color: F.fg3 }}>Credential</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((r) => (
                  <ResourceRow key={r.id} resource={r} showCheckbox={showCheckbox} selectedIds={selectedIds} onToggle={onToggle} />
                ))}
              </tbody>
            </table>

            {/* 더보기 / 접기 */}
            {needsCollapse && (
              <button
                onClick={() => toggleType(awsType)}
                style={{
                  width: '100%', padding: `${F.spaceXs} 0`,
                  background: F.bg2, border: 'none', borderTop: `1px solid ${F.stroke3}`,
                  color: F.brand, fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                }}
              >
                {isExpanded ? '접기' : `+${hiddenCount}개 더보기`}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
};

/* ── ResourceRow ── */
interface ResourceRowProps {
  resource: MockResource;
  showCheckbox: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

const ResourceRow = ({ resource: r, showCheckbox, selectedIds, onToggle }: ResourceRowProps) => {
  const connStatus = CONN_STATUS[r.connectionStatus];
  const credential = MOCK_CREDENTIALS.find((c) => c.id === r.selectedCredentialId);
  const needsCred = NEEDS_CREDENTIAL[r.databaseType];

  return (
    <tr style={{
      background: r.isNew ? F.infoBg : r.connectionStatus === 'DISCONNECTED' ? F.errorBg : 'transparent',
      borderBottom: `1px solid ${F.stroke3}`,
    }}>
      {showCheckbox && (
        <td style={{ padding: F.spaceSm }}>
          <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => onToggle(r.id)} />
        </td>
      )}
      <td style={{ padding: F.spaceSm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: F.spaceXs }}>
          <code style={{ fontFamily: F.fontMono, fontSize: '12px', color: F.fg1 }}>{r.resourceId}</code>
          {r.isNew && (
            <span style={{ padding: `2px ${F.spaceXs}`, background: F.brand, color: F.bg1, fontSize: '10px', fontWeight: 600, borderRadius: F.radiusSm }}>
              NEW
            </span>
          )}
        </div>
      </td>
      <td style={{ padding: F.spaceSm, color: F.fg1 }}>{r.databaseType}</td>
      <td style={{ padding: F.spaceSm, color: F.fg2 }}>{REGION_MAP[r.region] || r.region}</td>
      <td style={{ padding: F.spaceSm }}>
        <span style={{
          padding: `${F.spaceXs} ${F.spaceSm}`,
          background: connStatus.bgColor, color: connStatus.color,
          fontSize: '12px', fontWeight: 500, borderRadius: F.radiusMd,
        }}>
          {connStatus.text}
        </span>
      </td>
      <td style={{ padding: F.spaceSm }}>
        {needsCred ? (
          credential ? (
            <span style={{ color: F.fg1 }}>{credential.name}</span>
          ) : (
            <span style={{ color: F.error, fontWeight: 500 }}>미선택</span>
          )
        ) : (
          <span style={{ color: F.fg4, fontSize: '12px' }}>불필요</span>
        )}
      </td>
    </tr>
  );
};
