// Modal.jsx — new-project modal
const Modal = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = React.useState('');
  const [service, setService] = React.useState('SVC-0042');
  const [provider, setProvider] = React.useState('AWS');
  const [region, setRegion] = React.useState('ap-northeast-2');

  if (!isOpen) return null;

  const providers = [
    { code: 'AWS',  icon: '../../assets/icons/aws.svg' },
    { code: 'Azure', icon: '../../assets/icons/azure.svg' },
    { code: 'GCP',  icon: '../../assets/icons/gcp.svg' },
    { code: 'IDC',  icon: null },
    { code: 'SDU',  icon: null },
  ];

  const submit = () => {
    onSubmit({ name: name || '새 프로젝트', service, provider, region });
    setName('');
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-hdr">
          <div className="modal-hdr-left">
            <div className="modal-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
              </svg>
            </div>
            <div>
              <h2 className="modal-title">새 프로젝트</h2>
              <p className="modal-sub">PII Agent를 연동할 Cloud Provider를 등록합니다</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>프로젝트 이름</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="예: pii-scanner-prod" />
          </div>
          <div className="field">
            <label>서비스 코드</label>
            <select value={service} onChange={e => setService(e.target.value)}>
              <option>SVC-0001 · 결제 서비스</option>
              <option>SVC-0042 · 회원 데이터 허브</option>
              <option>SVC-0108 · 로그 분석</option>
            </select>
          </div>
          <div className="field">
            <label>Cloud Provider</label>
            <div className="field-provider-row">
              {providers.map(p => (
                <div key={p.code}
                     className={`provider-option ${provider === p.code ? 'selected' : ''}`}
                     onClick={() => setProvider(p.code)}>
                  {p.icon ? <img src={p.icon} alt={p.code} /> :
                    <div style={{width:24, height:24, borderRadius:4, background:'#E5E7EB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#6B7280'}}>{p.code[0]}</div>}
                  <span>{p.code}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <label>리전</label>
            <input value={region} onChange={e => setRegion(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={submit}>등록</button>
        </div>
      </div>
    </div>
  );
};
window.NewProjectModal = Modal;
