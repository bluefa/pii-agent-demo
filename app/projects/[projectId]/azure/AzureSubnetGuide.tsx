'use client';

interface AzureSubnetGuideProps {
  onClose: () => void;
}

export const AzureSubnetGuide = ({ onClose }: AzureSubnetGuideProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Subnet 설정 가이드</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">Subnet이 필요한 이유</h3>
            <p className="text-sm text-blue-700">
              PII Agent를 VM에 설치하기 위해서는 VM이 위치한 VNet에 전용 Subnet이 필요합니다.
              이 Subnet을 통해 Agent와 BDC 서버 간의 보안 통신이 이루어집니다.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">설정 절차</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Azure Portal에서 VM이 위치한 Virtual Network를 찾습니다.</li>
              <li>
                <span className="font-medium">Subnets</span> 메뉴에서 새 Subnet을 추가합니다.
              </li>
              <li>
                Subnet 이름: <code className="bg-gray-100 px-1 rounded">pii-agent-subnet</code> (권장)
              </li>
              <li>
                주소 범위: <code className="bg-gray-100 px-1 rounded">/28</code> 이상 권장 (예: 10.0.1.0/28)
              </li>
              <li>Subnet 생성 후 Terraform 스크립트를 다시 다운로드합니다.</li>
              <li>스크립트를 실행하여 Agent를 설치합니다.</li>
            </ol>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">필요 정보</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>- VNet Resource Group</li>
              <li>- VNet Name</li>
              <li>- Subnet Address Range (CIDR)</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center">
          <a
            href="https://docs.microsoft.com/azure/virtual-network/virtual-network-manage-subnet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Azure 공식 문서
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
