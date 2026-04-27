// ProjectDetail.jsx — step indicator + project info card
const StepIndicator = ({ current }) => {
  const steps = [
    { n: 1, label: '연동 대상 확정 대기' },
    { n: 2, label: '승인 대기' },
    { n: 3, label: '반영 중' },
    { n: 4, label: '설치 진행 중' },
    { n: 5, label: '연결 테스트' },
    { n: 6, label: '설치 완료' },
  ];
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        const done = current > s.n;
        const curr = current === s.n;
        const cls = done ? 'done' : curr ? 'curr' : 'todo';
        return (
          <React.Fragment key={s.n}>
            <div className="step">
              <div className={`step-circle ${cls}`}>
                {done ? (
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                ) : s.n}
              </div>
              <div className={`step-label ${cls}`}>{s.label}</div>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-bar ${done ? 'done' : 'todo'}`}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const InfoRow = ({ label, children }) => (
  <div style={{display:'flex', padding:'10px 0', borderBottom:'1px solid #F3F4F6', fontSize:14}}>
    <div style={{width:140, color:'#6B7280'}}>{label}</div>
    <div style={{flex:1, color:'#111827'}}>{children}</div>
  </div>
);

const ProjectDetail = ({ project, onOpenModal, onAdvance }) => (
  <>
    <div style={{marginBottom:20}}>
      <div style={{fontSize:13, color:'#6B7280', marginBottom:4}}>
        <a style={{color:'#0064FF', cursor:'pointer'}}>대시보드</a>
        <span style={{margin:'0 6px'}}>/</span>
        <span>{project.name}</span>
      </div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
        <div>
          <h1 style={{margin:0, fontSize:24, fontWeight:700, color:'#111827', letterSpacing:'-0.01em'}}>{project.name}</h1>
          <p style={{margin:'4px 0 0', fontSize:14, color:'#6B7280'}}>{project.description}</p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-secondary" onClick={onOpenModal}>새 프로젝트</button>
          <button className="btn btn-primary" onClick={onAdvance}>다음 단계 진행</button>
        </div>
      </div>
    </div>

    <StepIndicator current={project.currentStep} />

    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20}}>
      <div className="card">
        <div className="card-hdr"><h3>프로젝트 정보</h3></div>
        <div className="card-body">
          <InfoRow label="서비스 코드">{project.serviceCode}</InfoRow>
          <InfoRow label="Cloud Provider">
            <ProviderCell code={project.provider} />
          </InfoRow>
          <InfoRow label="담당자">{project.owner}</InfoRow>
          <InfoRow label="생성일">{project.createdAt}</InfoRow>
          <InfoRow label="상태"><Badge variant="warning">진행중</Badge></InfoRow>
        </div>
      </div>

      <div className="card" style={{borderLeft:`4px solid ${project.providerColor}`}}>
        <div className="card-hdr"><h3>{project.provider} 연동 설정</h3></div>
        <div className="card-body">
          <InfoRow label="계정 ID">{project.accountId}</InfoRow>
          <InfoRow label="리전">{project.region}</InfoRow>
          <InfoRow label="Role ARN">
            <span className="ds-mono" style={{fontSize:12, color:'#374151'}}>{project.roleArn}</span>
          </InfoRow>
          <InfoRow label="엔드포인트">
            <span className="ds-mono" style={{fontSize:12, color:'#374151'}}>{project.endpoint}</span>
          </InfoRow>
        </div>
      </div>
    </div>

    <div className="card">
      <div className="card-hdr">
        <h3>연동 대상 리소스</h3>
        <span style={{fontSize:12, color:'#9CA3AF'}}>총 {project.resources.length}개</span>
      </div>
      <div className="card-tablebody">
        <table>
          <thead>
            <tr><th>TYPE</th><th>NAME</th><th>ENGINE</th><th>REGION</th><th>STATUS</th></tr>
          </thead>
          <tbody>
            {project.resources.map(r => (
              <tr key={r.id}>
                <td><span className="prov"><img src={`../../assets/icons/${r.icon}.svg`} alt={r.type}/>{r.type}</span></td>
                <td><span className="system-name">{r.name}</span></td>
                <td>{r.engine}</td>
                <td style={{color:'#6B7280'}}>{r.region}</td>
                <td><Badge variant={r.status.variant}>{r.status.label}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
);
window.ProjectDetail = ProjectDetail;
