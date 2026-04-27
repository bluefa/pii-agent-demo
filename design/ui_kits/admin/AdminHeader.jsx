// AdminHeader.jsx — product header with nav tabs
const AdminHeader = ({ activeTab, onNavigate }) => {
  const items = [
    { key: 'dashboard', label: '연동 현황' },
    { key: 'services', label: '서비스 관리' },
    { key: 'history', label: 'Admin Tasks' },
  ];
  return (
    <header className="app-header">
      <div style={{display:'flex', alignItems:'center'}}>
        <div className="brand">
          <div className="brand-mark">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:'#fff'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <h1 className="brand-title">PII Agent 관리자</h1>
        </div>
        <nav className="nav">
          {items.map(it => (
            <a key={it.key}
               className={activeTab === it.key ? 'active' : ''}
               onClick={() => onNavigate(it.key)}>
              {it.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="user">
        <span className="user-name">관리자</span>
        <div className="avatar">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
      </div>
    </header>
  );
};
window.AdminHeader = AdminHeader;
