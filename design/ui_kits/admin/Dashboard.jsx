// Dashboard.jsx — KPI grid + systems table
const DashboardHeader = ({ checkedAt, onRefresh }) => (
  <div className="dash-head">
    <div className="dash-accent"></div>
    <div className="dash-title-row">
      <div className="dash-title-left">
        <div className="dash-logo">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
            <rect x="11" y="2" width="7" height="4" rx="1.5" fill="white" fillOpacity="0.9"/>
            <rect x="11" y="8" width="7" height="10" rx="1.5" fill="white" fillOpacity="0.6"/>
            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.6"/>
          </svg>
        </div>
        <div>
          <h1 className="dash-h1">연동 현황 대시보드</h1>
          <p className="dash-sub">전체 시스템의 PII Agent 연동 상태를 모니터링합니다</p>
        </div>
      </div>
      <div className="dash-actions">
        <span className="chip chip-muted">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          마지막 확인: {checkedAt}
        </span>
        <button className="chip chip-primary" onClick={onRefresh}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M11.5 2.5V5.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2.5 7A4.5 4.5 0 0 1 11 4.5L11.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2.5 11.5V8.5H5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11.5 7A4.5 4.5 0 0 1 3 9.5L2.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          새로고침
        </button>
      </div>
    </div>
  </div>
);

const KpiCard = ({ iconBg, icon, rate, bigNumber, unit, label, downLabel, downCount }) => (
  <div className="kpi-card">
    <div className="kpi-head">
      <div className="kpi-icon" style={{background: iconBg}}>{icon}</div>
      <div>
        <div className="kpi-pct">{rate.toFixed(1)}%</div>
        <div className="kpi-unit-small">연동률</div>
      </div>
    </div>
    <div className="kpi-label">{label}</div>
    <div className="kpi-big">{bigNumber.toLocaleString('ko-KR')}<span className="unit">{unit}</span></div>
    <span className="kpi-chip"><span className="d"></span>{downLabel} {downCount}</span>
  </div>
);

const ServerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="7" rx="1.5" stroke="white" strokeWidth="1.8"/>
    <rect x="3" y="14" width="18" height="7" rx="1.5" stroke="white" strokeWidth="1.8"/>
    <circle cx="7" cy="6.5" r="1" fill="white"/>
    <circle cx="7" cy="17.5" r="1" fill="white"/>
    <line x1="16" y1="6.5" x2="18" y2="6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="16" y1="17.5" x2="18" y2="17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const DbIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <ellipse cx="12" cy="6" rx="7" ry="3" stroke="white" strokeWidth="1.8"/>
    <path d="M5 6v5c0 1.66 3.13 3 7 3s7-1.34 7-3V6" stroke="white" strokeWidth="1.8"/>
    <path d="M5 11v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5" stroke="white" strokeWidth="1.8"/>
  </svg>
);

const Badge = ({ variant, children }) => (
  <span className={`badge badge-${variant}`}><span className="dot"></span>{children}</span>
);

const ProviderCell = ({ code }) => {
  const src = {
    AWS: '../../assets/icons/aws.svg',
    Azure: '../../assets/icons/azure.svg',
    GCP: '../../assets/icons/gcp.svg',
  }[code];
  return (
    <span className="prov">
      {src && <img src={src} alt={code} />}
      <span>{code}</span>
    </span>
  );
};

const SystemsTable = ({ systems, onRowClick }) => (
  <div className="card">
    <div className="card-hdr">
      <h3>시스템 목록</h3>
      <span style={{fontSize:12, color:'#9CA3AF'}}>총 {systems.length}개</span>
    </div>
    <div className="card-tablebody">
      <table>
        <thead>
          <tr>
            <th>SYSTEM</th><th>PROVIDER</th><th>STATUS</th>
            <th>DB 연동</th><th>LAST SYNC</th>
          </tr>
        </thead>
        <tbody>
          {systems.map(s => (
            <tr key={s.id} onClick={() => onRowClick(s)}>
              <td><span className="system-name">{s.name}</span></td>
              <td><ProviderCell code={s.provider} /></td>
              <td><Badge variant={s.status.variant}>{s.status.label}</Badge></td>
              <td>{s.activeDb} / {s.totalDb}</td>
              <td style={{color:'#6B7280'}}>{s.lastSync}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const Dashboard = ({ summary, systems, onRefresh, onRowClick }) => (
  <>
    <DashboardHeader checkedAt={summary.checkedAt} onRefresh={onRefresh} />
    <div className="kpi-grid">
      <KpiCard
        iconBg="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
        icon={<ServerIcon />}
        rate={summary.serviceRate}
        bigNumber={summary.totalSystems}
        unit="시스템"
        label="서비스 현황"
        downLabel="끊어진 서비스"
        downCount={summary.unhealthyServices}
      />
      <KpiCard
        iconBg="linear-gradient(135deg, #10b981 0%, #059669 100%)"
        icon={<DbIcon />}
        rate={summary.dbRate}
        bigNumber={summary.activeDb}
        unit="연동중"
        label="DB 연동 현황"
        downLabel="끊김"
        downCount={summary.unhealthyDb}
      />
    </div>
    <SystemsTable systems={systems} onRowClick={onRowClick} />
  </>
);
window.Dashboard = Dashboard;
window.Badge = Badge;
window.ProviderCell = ProviderCell;
