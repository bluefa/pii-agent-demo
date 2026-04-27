'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { consumePendingAdminNavigation } from '@/app/components/features/admin-dashboard/pendingAdminNavigation';
import { Button } from '@/app/components/ui/Button';
import { useToast } from '@/app/components/ui/toast';
import { Breadcrumb } from '@/app/components/ui/Breadcrumb';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { PageMeta } from '@/app/components/ui/PageMeta';
import { ProjectCreateModal } from './ProjectCreateModal';
import {
  getServicesPage,
  getProjects,
  confirmInstallation,
  getApprovalHistory,
  approveApprovalRequestV1,
  rejectApprovalRequestV1,
} from '@/app/lib/api';
import { ProjectSummary } from '@/lib/types';
import { integrationRoutes } from '@/lib/routes';
import { cn, statusColors, textColors } from '@/lib/theme';
import {
  ServiceSidebar,
  ApprovalDetailModal,
} from './admin';
import { InfrastructureList } from './admin/infrastructure';
import {
  serviceListReducer,
  buildInitialServiceListState,
  type ApprovalModalState,
} from './admin-dashboard';

export const AdminDashboard = () => {
  const router = useRouter();
  const toast = useToast();

  const [serviceList, dispatch] = useReducer(
    serviceListReducer,
    undefined,
    buildInitialServiceListState,
  );
  const { services, selectedService, query: serviceQuery, pageInfo: servicePageInfo } = serviceList;

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalModal, setApprovalModal] = useState<ApprovalModalState>({ status: 'closed' });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  // abortRef: cancels in-flight service-list requests on a new fetch or unmount.
  const abortRef = useRef<AbortController | null>(null);
  // skipAutoSelectRef: skip the page-0 auto-select on the next fetch so a
  // hydrated selection is not overwritten by the first fetched item.
  const skipAutoSelectRef = useRef(false);
  // hydratedRef: ensures the hydration effect runs exactly once even under
  // React StrictMode's double-invoke in development.
  const hydratedRef = useRef(false);

  const fetchServicesPage = useCallback(async (page: number, searchQuery?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const data = await getServicesPage(page, 10, searchQuery || undefined, { signal: controller.signal });
    if (controller.signal.aborted) return;
    dispatch({ type: 'SET_SERVICES', services: data.content, pageInfo: data.page });
    if (page === 0 && data.content.length > 0 && !skipAutoSelectRef.current) {
      dispatch({ type: 'SET_SELECTED', serviceCode: data.content[0].code });
    }
    skipAutoSelectRef.current = false;
  }, []);

  // Cleanup on unmount: clear search debounce and cancel any in-flight fetch.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Hydration + initial fetch (single run). Consume any pending payload from
  // the target-source detail page and seed the reducer before the first fetch
  // — fetch arguments must come from the payload to avoid a race with the
  // default page-0 / no-query fetch.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const payload = consumePendingAdminNavigation();
    let pageToFetch = 0;
    let queryToFetch: string | undefined;
    if (payload) {
      dispatch({ type: 'HYDRATE', payload });
      skipAutoSelectRef.current = true;
      pageToFetch = payload.pageNumber;
      queryToFetch = payload.searchQuery || undefined;
    }
    void fetchServicesPage(pageToFetch, queryToFetch);
  }, [fetchServicesPage]);

  const handleSelectService = useCallback((code: string) => {
    dispatch({ type: 'SET_SELECTED', serviceCode: code });
  }, []);

  const handleSearchChange = useCallback((newQuery: string) => {
    dispatch({ type: 'SET_QUERY', query: newQuery });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dispatch({ type: 'SET_PAGE', pageNum: 0 });
      fetchServicesPage(0, newQuery);
    }, 300);
  }, [fetchServicesPage]);

  const handlePageChange = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', pageNum: page });
    fetchServicesPage(page, serviceQuery);
  }, [fetchServicesPage, serviceQuery]);

  useEffect(() => {
    if (!selectedService) return;
    const fetchServiceData = async () => {
      setLoading(true);
      const projectsData = await getProjects(selectedService);
      setProjects(projectsData);
      setLoading(false);
    };
    fetchServiceData();
  }, [selectedService]);

  const refreshProjects = async () => {
    if (!selectedService) return;
    setLoading(true);
    const data = await getProjects(selectedService);
    setProjects(data);
    setLoading(false);
  };

  const handleViewApproval = async (project: ProjectSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const historyResponse = await getApprovalHistory(project.targetSourceId, 0, 1);
      const latest = historyResponse.content[0];
      if (!latest) {
        toast.info('승인 요청 이력이 없습니다.');
        return;
      }
      setApprovalModal({
        status: 'view',
        detail: { project, approvalRequest: latest.request },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '승인 요청 조회 실패');
    }
  };

  const handleApprove = async () => {
    if (approvalModal.status !== 'view') return;
    const currentDetail = approvalModal.detail;
    try {
      setApprovalModal({ status: 'submitting', detail: currentDetail });
      await approveApprovalRequestV1(currentDetail.project.targetSourceId);
      setApprovalModal((prev) =>
        prev.status === 'submitting' ? { status: 'closed' } : prev,
      );
      await refreshProjects();
    } catch (err) {
      setApprovalModal((prev) =>
        prev.status === 'submitting' ? { status: 'view', detail: currentDetail } : prev,
      );
      toast.error(err instanceof Error ? err.message : '승인 처리 실패');
    }
  };

  const handleReject = async (reason: string) => {
    if (approvalModal.status !== 'view') return;
    const currentDetail = approvalModal.detail;
    try {
      setApprovalModal({ status: 'submitting', detail: currentDetail });
      await rejectApprovalRequestV1(currentDetail.project.targetSourceId, reason);
      setApprovalModal((prev) =>
        prev.status === 'submitting' ? { status: 'closed' } : prev,
      );
      await refreshProjects();
    } catch (err) {
      setApprovalModal((prev) =>
        prev.status === 'submitting' ? { status: 'view', detail: currentDetail } : prev,
      );
      toast.error(err instanceof Error ? err.message : '반려 처리 실패');
    }
  };

  const handleConfirmCompletion = async (targetSourceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(String(targetSourceId));
      await confirmInstallation(targetSourceId);
      await refreshProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '설치 완료 확정 실패');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenDetail = useCallback((targetSourceId: number) => {
    router.push(integrationRoutes.targetSource(targetSourceId));
  }, [router]);

  const handleManageAction = useCallback((action: 'view' | 'delete', targetSourceId: number) => {
    if (action === 'view') {
      router.push(integrationRoutes.targetSource(targetSourceId));
      return;
    }
    toast.info('삭제 미구현');
  }, [router, toast]);

  const openCreateModal = useCallback(() => {
    setApprovalModal({ status: 'create' });
  }, []);

  const closeAnyModal = useCallback(() => {
    setApprovalModal({ status: 'closed' });
  }, []);

  const selectedServiceObj = services.find((s) => s.code === selectedService);
  const approvalDetail =
    approvalModal.status === 'view' || approvalModal.status === 'submitting'
      ? approvalModal.detail
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-[calc(100vh-56px)]">
        <ServiceSidebar
          services={services}
          selectedService={selectedService}
          onSelectService={handleSelectService}
          projectCount={projects.length}
          searchQuery={serviceQuery}
          onSearchChange={handleSearchChange}
          pageInfo={servicePageInfo}
          onPageChange={handlePageChange}
        />

        <main className="flex-1 p-6 overflow-auto bg-gray-50/50">
          {!selectedService ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500">서비스를 선택하세요</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Breadcrumb
                crumbs={[
                  { label: 'SIT Home', href: '/' },
                  { label: 'Service List' },
                ]}
              />
              <PageHeader
                title={`${selectedService} ${selectedServiceObj?.name ?? ''}`.trim()}
                action={
                  <>
                    {loading && projects.length > 0 && (
                      <span className={cn('inline-flex items-center gap-1.5 text-xs', textColors.tertiary)}>
                        <span className={cn('w-3 h-3 border-2 border-t-transparent rounded-full animate-spin', statusColors.pending.border)} />
                        갱신 중
                      </span>
                    )}
                    <Button onClick={openCreateModal} className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      타겟 소스 등록
                    </Button>
                  </>
                }
              />
              <PageMeta
                items={[
                  { label: '서비스 코드', value: selectedService },
                  { label: '서비스명', value: selectedServiceObj?.name ?? '-' },
                  ...(selectedServiceObj?.description
                    ? [{ label: '설명', value: selectedServiceObj.description }]
                    : []),
                ]}
              />

              <InfrastructureList
                projects={projects}
                loading={loading}
                actionLoading={actionLoading}
                onAddInfra={openCreateModal}
                onOpenDetail={handleOpenDetail}
                onManageAction={handleManageAction}
                onConfirmCompletion={handleConfirmCompletion}
                onViewApproval={handleViewApproval}
              />
            </div>
          )}
        </main>
      </div>

      {approvalDetail && (
        <ApprovalDetailModal
          isOpen
          onClose={closeAnyModal}
          project={approvalDetail.project}
          approvalRequest={approvalDetail.approvalRequest}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={approvalModal.status === 'submitting'}
        />
      )}

      {approvalModal.status === 'create' && selectedService && (
        <ProjectCreateModal
          selectedServiceCode={selectedService}
          serviceName={selectedServiceObj?.name || ''}
          onClose={closeAnyModal}
          onCreated={refreshProjects}
        />
      )}
    </div>
  );
};
