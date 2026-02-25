import type {
  DashboardSummary,
  SystemDetail,
  SystemDetailListResponse,
  DashboardFilters,
  IntegrationMethod,
} from '@/lib/types/dashboard';

// ===== Mock 시스템 데이터 (25개) =====

const MOCK_SYSTEMS: SystemDetail[] = [
  {
    service_code: 'SVC-001', service_name: '고객정보관리시스템',
    manager: { name: '김철수', email: 'cskim@example.com' },
    nirp_codes: ['NIRP-101'], sw_plm_codes: ['PLM-201', 'PLM-202'],
    integration_methods: ['AWS', 'Azure'], svc_installed: true,
    db_status: { target_db_count: 12, healthy_db_count: 12, unhealthy_db_count: 0, active_db_count: 12 },
  },
  {
    service_code: 'SVC-002', service_name: '인사관리시스템',
    manager: { name: '이영희', email: 'yhlee@example.com' },
    nirp_codes: ['NIRP-102', 'NIRP-103'], sw_plm_codes: ['PLM-203'],
    integration_methods: ['AWS'], svc_installed: true,
    db_status: { target_db_count: 8, healthy_db_count: 7, unhealthy_db_count: 1, active_db_count: 8 },
  },
  {
    service_code: 'SVC-003', service_name: '회계관리시스템',
    manager: { name: '박민준', email: 'mjpark@example.com' },
    nirp_codes: [], sw_plm_codes: ['PLM-204'],
    integration_methods: ['GCP'], svc_installed: true,
    db_status: { target_db_count: 5, healthy_db_count: 5, unhealthy_db_count: 0, active_db_count: 5 },
  },
  {
    service_code: 'SVC-004', service_name: '전자결재시스템',
    manager: { name: '최수진', email: 'sjchoi@example.com' },
    nirp_codes: ['NIRP-104'], sw_plm_codes: [],
    integration_methods: ['IDC', 'SDU'], svc_installed: true,
    db_status: { target_db_count: 15, healthy_db_count: 13, unhealthy_db_count: 2, active_db_count: 15 },
  },
  {
    service_code: 'SVC-005', service_name: '메일시스템',
    manager: { name: '정대현', email: 'dhjung@example.com' },
    nirp_codes: ['NIRP-105', 'NIRP-106'], sw_plm_codes: ['PLM-205', 'PLM-206', 'PLM-207'],
    integration_methods: ['Azure'], svc_installed: true,
    db_status: { target_db_count: 3, healthy_db_count: 3, unhealthy_db_count: 0, active_db_count: 3 },
  },
  {
    service_code: 'SVC-006', service_name: '포털서비스',
    manager: { name: '한미영', email: 'myhan@example.com' },
    nirp_codes: [], sw_plm_codes: [],
    integration_methods: ['AWS', 'GCP'], svc_installed: false,
    db_status: { target_db_count: 20, healthy_db_count: 18, unhealthy_db_count: 2, active_db_count: 20 },
  },
  {
    service_code: 'SVC-007', service_name: '고객센터시스템',
    manager: { name: '오준혁', email: 'jhoh@example.com' },
    nirp_codes: ['NIRP-107'], sw_plm_codes: ['PLM-208'],
    integration_methods: ['수동조사'], svc_installed: false,
    db_status: { target_db_count: 4, healthy_db_count: 0, unhealthy_db_count: 0, active_db_count: 0 },
  },
  {
    service_code: 'SVC-008', service_name: 'CRM시스템',
    manager: { name: '강지은', email: 'jekang@example.com' },
    nirp_codes: ['NIRP-108', 'NIRP-109'], sw_plm_codes: ['PLM-209'],
    integration_methods: ['AWS', 'IDC'], svc_installed: true,
    db_status: { target_db_count: 10, healthy_db_count: 9, unhealthy_db_count: 1, active_db_count: 10 },
  },
  {
    service_code: 'SVC-009', service_name: 'ERP시스템',
    manager: { name: '윤서연', email: 'syyoon@example.com' },
    nirp_codes: [], sw_plm_codes: ['PLM-210', 'PLM-211'],
    integration_methods: ['Azure', 'IDC'], svc_installed: true,
    db_status: { target_db_count: 25, healthy_db_count: 22, unhealthy_db_count: 3, active_db_count: 25 },
  },
  {
    service_code: 'SVC-010', service_name: '데이터웨어하우스',
    manager: { name: '임동훈', email: 'dhlim@example.com' },
    nirp_codes: ['NIRP-110'], sw_plm_codes: [],
    integration_methods: ['GCP'], svc_installed: true,
    db_status: { target_db_count: 6, healthy_db_count: 6, unhealthy_db_count: 0, active_db_count: 6 },
  },
  {
    service_code: 'SVC-011', service_name: '물류관리시스템',
    manager: { name: '송하윤', email: 'hysong@example.com' },
    nirp_codes: ['NIRP-111'], sw_plm_codes: ['PLM-212'],
    integration_methods: ['AWS'], svc_installed: true,
    db_status: { target_db_count: 7, healthy_db_count: 5, unhealthy_db_count: 2, active_db_count: 7 },
  },
  {
    service_code: 'SVC-012', service_name: '재고관리시스템',
    manager: { name: '노재원', email: 'jwnoh@example.com' },
    nirp_codes: [], sw_plm_codes: ['PLM-213'],
    integration_methods: ['SDU'], svc_installed: false,
    db_status: { target_db_count: 9, healthy_db_count: 9, unhealthy_db_count: 0, active_db_count: 9 },
  },
  {
    service_code: 'SVC-013', service_name: '보안관제시스템',
    manager: { name: '권예진', email: 'yjkwon@example.com' },
    nirp_codes: ['NIRP-112', 'NIRP-113', 'NIRP-114'], sw_plm_codes: ['PLM-214'],
    integration_methods: ['IDC'], svc_installed: true,
    db_status: { target_db_count: 11, healthy_db_count: 10, unhealthy_db_count: 1, active_db_count: 11 },
  },
  {
    service_code: 'SVC-014', service_name: '통합모니터링시스템',
    manager: { name: '백승우', email: 'swbaek@example.com' },
    nirp_codes: ['NIRP-115'], sw_plm_codes: [],
    integration_methods: ['AWS', 'Azure', 'GCP'], svc_installed: true,
    db_status: { target_db_count: 30, healthy_db_count: 28, unhealthy_db_count: 2, active_db_count: 30 },
  },
  {
    service_code: 'SVC-015', service_name: '문서관리시스템',
    manager: { name: '조민서', email: 'msjo@example.com' },
    nirp_codes: [], sw_plm_codes: ['PLM-215', 'PLM-216'],
    integration_methods: ['수동조사'], svc_installed: false,
    db_status: { target_db_count: 2, healthy_db_count: 0, unhealthy_db_count: 0, active_db_count: 0 },
  },
  {
    service_code: 'SVC-016', service_name: '그룹웨어',
    manager: { name: '유지훈', email: 'jhyoo@example.com' },
    nirp_codes: ['NIRP-116'], sw_plm_codes: ['PLM-217'],
    integration_methods: ['Azure'], svc_installed: true,
    db_status: { target_db_count: 14, healthy_db_count: 14, unhealthy_db_count: 0, active_db_count: 14 },
  },
  {
    service_code: 'SVC-017', service_name: '마케팅분석플랫폼',
    manager: { name: '신하은', email: 'heshin@example.com' },
    nirp_codes: [], sw_plm_codes: [],
    integration_methods: ['GCP', 'SDU'], svc_installed: true,
    db_status: { target_db_count: 8, healthy_db_count: 6, unhealthy_db_count: 2, active_db_count: 8 },
  },
  {
    service_code: 'SVC-018', service_name: '주문관리시스템',
    manager: { name: '황도윤', email: 'dyhwang@example.com' },
    nirp_codes: ['NIRP-117', 'NIRP-118'], sw_plm_codes: ['PLM-218'],
    integration_methods: ['AWS'], svc_installed: true,
    db_status: { target_db_count: 16, healthy_db_count: 15, unhealthy_db_count: 1, active_db_count: 16 },
  },
  {
    service_code: 'SVC-019', service_name: '결제시스템',
    manager: { name: '전소율', email: 'syjeon@example.com' },
    nirp_codes: ['NIRP-119'], sw_plm_codes: ['PLM-219', 'PLM-220'],
    integration_methods: ['AWS', 'IDC'], svc_installed: false,
    db_status: { target_db_count: 18, healthy_db_count: 16, unhealthy_db_count: 2, active_db_count: 18 },
  },
  {
    service_code: 'SVC-020', service_name: '배송추적시스템',
    manager: { name: '홍민재', email: 'mjhong@example.com' },
    nirp_codes: [], sw_plm_codes: ['PLM-221'],
    integration_methods: ['Azure', 'SDU'], svc_installed: true,
    db_status: { target_db_count: 5, healthy_db_count: 4, unhealthy_db_count: 1, active_db_count: 5 },
  },
  {
    service_code: 'SVC-021', service_name: '자산관리시스템',
    manager: { name: '문채원', email: 'cwmoon@example.com' },
    nirp_codes: ['NIRP-120'], sw_plm_codes: [],
    integration_methods: ['IDC'], svc_installed: true,
    db_status: { target_db_count: 6, healthy_db_count: 6, unhealthy_db_count: 0, active_db_count: 6 },
  },
  {
    service_code: 'SVC-022', service_name: '교육관리시스템',
    manager: { name: '양준서', email: 'jsyang@example.com' },
    nirp_codes: [], sw_plm_codes: ['PLM-222'],
    integration_methods: ['GCP'], svc_installed: false,
    db_status: { target_db_count: 3, healthy_db_count: 3, unhealthy_db_count: 0, active_db_count: 3 },
  },
  {
    service_code: 'SVC-023', service_name: '복리후생시스템',
    manager: { name: '서예림', email: 'yrseo@example.com' },
    nirp_codes: ['NIRP-121'], sw_plm_codes: ['PLM-223'],
    integration_methods: ['수동조사', 'IDC'], svc_installed: false,
    db_status: { target_db_count: 4, healthy_db_count: 2, unhealthy_db_count: 0, active_db_count: 2 },
  },
  {
    service_code: 'SVC-024', service_name: 'AI분석플랫폼',
    manager: { name: '남궁현', email: 'hnam@example.com' },
    nirp_codes: ['NIRP-122', 'NIRP-123'], sw_plm_codes: ['PLM-224', 'PLM-225', 'PLM-226'],
    integration_methods: ['AWS', 'GCP'], svc_installed: true,
    db_status: { target_db_count: 22, healthy_db_count: 20, unhealthy_db_count: 2, active_db_count: 22 },
  },
  {
    service_code: 'SVC-025', service_name: '내부감사시스템',
    manager: { name: '장유진', email: 'yjjang@example.com' },
    nirp_codes: [], sw_plm_codes: [],
    integration_methods: ['SDU'], svc_installed: true,
    db_status: { target_db_count: 3, healthy_db_count: 3, unhealthy_db_count: 0, active_db_count: 3 },
  },
];

// ===== Mock 함수 =====

export const getMockDashboardSummary = (): DashboardSummary => {
  let totalTarget = 0;
  let totalActive = 0;
  let totalHealthy = 0;
  let totalUnhealthy = 0;
  let unhealthyServiceCount = 0;

  for (const sys of MOCK_SYSTEMS) {
    totalTarget += sys.db_status.target_db_count;
    totalActive += sys.db_status.active_db_count;
    totalHealthy += sys.db_status.healthy_db_count;
    totalUnhealthy += sys.db_status.unhealthy_db_count;
    if (sys.db_status.unhealthy_db_count > 0) unhealthyServiceCount++;
  }

  const totalSystems = MOCK_SYSTEMS.length;
  const serviceConnectionRate = totalSystems > 0
    ? Math.round(((totalSystems - unhealthyServiceCount) / totalSystems) * 1000) / 10
    : 0.0;
  const connectionRate = totalActive > 0
    ? Math.round(((totalActive - totalUnhealthy) / totalActive) * 1000) / 10
    : 0.0;

  return {
    total_system_count: totalSystems,
    total_target_db_count: totalTarget,
    active_integration_db_count: totalActive,
    healthy_db_count: totalHealthy,
    unhealthy_db_count: totalUnhealthy,
    unhealthy_service_count: unhealthyServiceCount,
    service_connection_rate: serviceConnectionRate,
    connection_rate: connectionRate,
    checked_at: new Date().toISOString(),
  };
};

export const getMockSystems = (filters: DashboardFilters): SystemDetailListResponse => {
  let filtered = [...MOCK_SYSTEMS];

  // 검색 (service_name, service_code)
  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.service_name.toLowerCase().includes(q) ||
        s.service_code.toLowerCase().includes(q),
    );
  }

  // 연동 방식 필터 (배열 — OR 조건)
  if (filters.integration_method.length > 0) {
    filtered = filtered.filter((s) =>
      s.integration_methods.some((m) => filters.integration_method.includes(m)),
    );
  }

  // svc_installed 필터
  if (filters.svc_installed && filters.svc_installed !== 'all') {
    const installed = filters.svc_installed === 'true';
    filtered = filtered.filter((s) => s.svc_installed === installed);
  }

  // 연결 상태 필터
  if (filters.connection_status !== 'all') {
    filtered = filtered.filter((s) => {
      switch (filters.connection_status) {
        case 'healthy':
          return s.db_status.unhealthy_db_count === 0 && s.db_status.active_db_count > 0;
        case 'unhealthy':
          return s.db_status.unhealthy_db_count > 0;
        case 'none':
          return s.db_status.active_db_count === 0;
        default:
          return true;
      }
    });
  }

  // 정렬
  const sortBy = filters.sort_by || 'service_name';
  const sortOrder = filters.sort_order === 'none' ? 'asc' : filters.sort_order;
  const multiplier = sortOrder === 'asc' ? 1 : -1;

  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'service_name':
        return a.service_name.localeCompare(b.service_name, 'ko') * multiplier;
      case 'target_db_count':
        return (a.db_status.target_db_count - b.db_status.target_db_count) * multiplier;
      case 'connection_rate': {
        const rateA = a.db_status.target_db_count > 0 ? a.db_status.active_db_count / a.db_status.target_db_count : 0;
        const rateB = b.db_status.target_db_count > 0 ? b.db_status.active_db_count / b.db_status.target_db_count : 0;
        return (rateA - rateB) * multiplier;
      }
      default:
        return 0;
    }
  });

  // 페이지네이션
  const totalCount = filtered.length;
  const page = filters.page ?? 0;
  const size = filters.size ?? 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / size));
  const start = page * size;
  const paged = filtered.slice(start, start + size);

  return {
    systems: paged,
    total_count: totalCount,
    page,
    size,
    total_pages: totalPages,
  };
};

export const getMockSystemsCsv = (filters: DashboardFilters): string => {
  // CSV에서는 페이지네이션 무시 — 전체 데이터
  const allFilters: DashboardFilters = { ...filters, page: 0, size: 10000 };
  const { systems } = getMockSystems(allFilters);

  const header = '서비스코드,서비스명,담당자,담당자이메일,NIRP코드,SW PLM코드,연동방식,설치완료,대상DB수,정상DB수,비정상DB수,연동DB수';
  const rows = systems.map((s) =>
    [
      s.service_code,
      s.service_name,
      s.manager.name,
      s.manager.email,
      `"${s.nirp_codes.join(', ')}"`,
      `"${s.sw_plm_codes.join(', ')}"`,
      `"${s.integration_methods.join(', ')}"`,
      s.svc_installed ? 'Y' : 'N',
      s.db_status.target_db_count,
      s.db_status.healthy_db_count,
      s.db_status.unhealthy_db_count,
      s.db_status.active_db_count,
    ].join(','),
  );

  return [header, ...rows].join('\n');
};
