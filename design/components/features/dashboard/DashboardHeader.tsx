'use client';

interface DashboardHeaderProps {
  checkedAt?: string;
}

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.5 2.5V5.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.5 7A4.5 4.5 0 0 1 11 4.5L11.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.5 11.5V8.5H5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11.5 7A4.5 4.5 0 0 1 3 9.5L2.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const formatCheckedAt = (isoString: string): string => {
  const date = new Date(isoString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hours}:${minutes}`;
};

const DashboardHeader = ({ checkedAt }: DashboardHeaderProps) => {
  return (
    <div className="mb-8">
      {/* Top accent line */}
      <div
        className="h-1 w-16 rounded-full mb-6"
        style={{ background: 'linear-gradient(135deg, #0064FF 0%, #6366f1 100%)' }}
      />

      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0064FF 0%, #6366f1 100%)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="11" y="2" width="7" height="4" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="11" y="8" width="7" height="10" rx="1.5" fill="white" fillOpacity="0.6" />
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.6" />
            </svg>
          </div>
          <div>
          <h1
            className="text-[28px] font-bold tracking-tight"
            style={{ color: '#111827' }}
          >
            연동 현황 대시보드
          </h1>
          <p className="text-[15px] mt-1.5" style={{ color: '#6b7280' }}>
            전체 시스템의 PII Agent 연동 상태를 모니터링합니다
          </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {checkedAt && (
            <div
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{ color: '#6b7280', backgroundColor: '#f3f4f6' }}
            >
              <ClockIcon />
              <span>마지막 확인: {formatCheckedAt(checkedAt)}</span>
            </div>
          )}
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
            style={{
              color: '#0064FF',
              backgroundColor: '#eff6ff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dbeafe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
            }}
          >
            <RefreshIcon />
            새로고침
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
