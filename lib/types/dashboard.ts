// ===== Admin Dashboard Types (Swagger 기반) =====

/** 연동 방식 */
export type IntegrationMethod = 'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU' | '수동조사';

/** 시스템 담당자 */
export interface SystemManager {
  name: string;
  email: string;
}

/** 시스템별 DB 상태 */
export interface SystemDbStatus {
  target_db_count: number;
  healthy_db_count: number;
  unhealthy_db_count: number;
  active_db_count: number;
}

/** 대시보드 요약 (GET /api/v1/admin/dashboard/summary) */
export interface DashboardSummary {
  total_system_count: number;
  total_target_db_count: number;
  active_integration_db_count: number;
  healthy_db_count: number;
  unhealthy_db_count: number;
  unhealthy_service_count: number;
  service_connection_rate: number;
  connection_rate: number;
  checked_at: string;
}

/** 시스템 상세 (GET /api/v1/admin/dashboard/systems 항목) */
export interface SystemDetail {
  service_code: string;
  service_name: string;
  manager: SystemManager;
  nirp_codes: string[];
  sw_plm_codes: string[];
  integration_methods: IntegrationMethod[];
  svc_installed: boolean;
  db_status: SystemDbStatus;
}

/** 시스템 목록 응답 (페이지네이션 포함) */
export interface SystemDetailListResponse {
  systems: SystemDetail[];
  total_count: number;
  page: number;
  size: number;
  total_pages: number;
}

/** 연결 상태 필터 */
export type ConnectionStatusFilter = 'all' | 'healthy' | 'unhealthy' | 'none';

/** 설치 상태 필터 */
export type SvcInstalledFilter = 'all' | 'true' | 'false';

/** 정렬 방향 */
export type SortOrder = 'asc' | 'desc' | 'none';

/** 검색/필터/정렬/페이지네이션 파라미터 */
export interface DashboardFilters {
  search: string;
  integration_method: string[];
  connection_status: ConnectionStatusFilter;
  svc_installed: SvcInstalledFilter;
  sort_by: string;
  sort_order: SortOrder;
  page: number;
  size: number;
}
