// ServiceSidebar.jsx — left nav with service codes
const ServiceSidebar = ({ services, selected, onSelect, search, onSearch }) => {
  const filtered = services.filter(s =>
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <aside className="sidebar">
      <div className="sidebar-hdr"><h2>서비스 코드</h2></div>
      <div className="sidebar-search">
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="서비스 검색..." />
      </div>
      <ul>
        {filtered.length === 0 ? (
          <li style={{padding:'32px 16px', textAlign:'center'}}>
            <div style={{fontSize:13, color:'#6B7280'}}>검색 결과가 없습니다</div>
            <div style={{fontSize:11, color:'#9CA3AF', marginTop:4}}>다른 검색어를 입력해 주세요</div>
          </li>
        ) : filtered.map(s => (
          <li key={s.code}
              className={`service-item ${selected === s.code ? 'active' : ''}`}
              onClick={() => onSelect(s.code)}>
            <div className="row1">
              <span className="code">{s.code}</span>
              {selected === s.code && <span className="count-pill">{s.projectCount}</span>}
            </div>
            <div className="name">{s.name}</div>
          </li>
        ))}
      </ul>
      <div style={{padding:'12px 16px', borderTop:'1px solid #F3F4F6', fontSize:11, color:'#9CA3AF', textAlign:'center'}}>
        총 {services.length}개 서비스
      </div>
    </aside>
  );
};
window.ServiceSidebar = ServiceSidebar;
