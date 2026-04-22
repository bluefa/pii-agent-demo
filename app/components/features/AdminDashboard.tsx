'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/app/components/ui/Button';
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
import type { ServicePageResponse } from '@/app/lib/api';
import type { ApprovalResourceInput } from '@/app/lib/api';
import { ServiceCode, ProjectSummary } from '@/lib/types';
import { integrationRoutes } from '@/lib/routes';
import {
  ServiceSidebar,
  ApprovalDetailModal,
} from './admin';
import { InfrastructureList } from './admin/infrastructure';

export const AdminDashboard = () => {
  const router = useRouter();
  const [services, setServices] = useState<ServiceCode[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalDetail, setApprovalDetail] = useState<{
    project: ProjectSummary;
    approvalRequest: {
      id: string;
      requested_at: string;
      requested_by: string;
      input_data: {
        resource_inputs: ApprovalResourceInput[];
        exclusion_reason_default?: string;
      };
    };
  } | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const [serviceQuery, setServiceQuery] = useState('');
  const [servicePageNum, setServicePageNum] = useState(0);
  const [servicePageInfo, setServicePageInfo] = useState<ServicePageResponse['page']>({
    totalElements: 0, totalPages: 0, number: 0, size: 10,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchServicesPage = useCallback(async (page: number, query?: string) => {
    const data = await getServicesPage(page, 10, query || undefined);
    setServices(data.content);
    setServicePageInfo(data.page);
    if (page === 0 && data.content.length > 0) {
      setSelectedService(data.content[0].code);
    }
  }, []);

  useEffect(() => {
    fetchServicesPage(0);
  }, [fetchServicesPage]);

  const handleSearchChange = useCallback((query: string) => {
    setServiceQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setServicePageNum(0);
      fetchServicesPage(0, query);
    }, 300);
  }, [fetchServicesPage]);

  const handlePageChange = useCallback((page: number) => {
    setServicePageNum(page);
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
        alert('승인 요청 이력이 없습니다.');
        return;
      }
      setApprovalDetail({ project, approvalRequest: latest.request });
    } catch (err) {
      alert(err instanceof Error ? err.message : '승인 요청 조회 실패');
    }
  };

  const handleApprove = async () => {
    if (!approvalDetail) return;
    try {
      setApprovalLoading(true);
      await approveApprovalRequestV1(approvalDetail.project.targetSourceId);
      setApprovalDetail(null);
      await refreshProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : '승인 처리 실패');
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!approvalDetail) return;
    try {
      setApprovalLoading(true);
      await rejectApprovalRequestV1(approvalDetail.project.targetSourceId, reason);
      setApprovalDetail(null);
      await refreshProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : '반려 처리 실패');
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleConfirmCompletion = async (targetSourceId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(String(targetSourceId));
      await confirmInstallation(targetSourceId);
      await refreshProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : '설치 완료 확정 실패');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenDetail = useCallback((targetSourceId: number) => {
    router.push(integrationRoutes.project(targetSourceId));
  }, [router]);

  const handleManageAction = useCallback((action: 'view' | 'delete', targetSourceId: number) => {
    if (action === 'view') {
      router.push(integrationRoutes.project(targetSourceId));
      return;
    }
    alert('삭제 미구현');
  }, [router]);

  const selectedServiceObj = services.find((s) => s.code === selectedService);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-[calc(100vh-56px)]">
        <ServiceSidebar
          services={services}
          selectedService={selectedService}
          onSelectService={setSelectedService}
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
                  <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    타겟 소스 등록
                  </Button>
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
                onAddInfra={() => setShowCreateModal(true)}
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
          isOpen={!!approvalDetail}
          onClose={() => setApprovalDetail(null)}
          project={approvalDetail.project}
          approvalRequest={approvalDetail.approvalRequest}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={approvalLoading}
        />
      )}

      {showCreateModal && selectedService && (
        <ProjectCreateModal
          selectedServiceCode={selectedService}
          serviceName={selectedServiceObj?.name || ''}
          onClose={() => setShowCreateModal(false)}
          onCreated={refreshProjects}
        />
      )}
    </div>
  );
};
