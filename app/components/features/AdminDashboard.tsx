'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/Button';
import { ProjectCreateModal } from './ProjectCreateModal';
import {
  getServices,
  getProjects,
  getPermissions,
  addPermission,
  deletePermission,
  confirmInstallation,
  getApprovalHistory,
  approveApprovalRequestV1,
  rejectApprovalRequestV1,
  UserSearchResult,
} from '@/app/lib/api';
import type { ApprovalResourceInput } from '@/app/lib/api';
import { ServiceCode, ProjectSummary, User } from '@/lib/types';
import {
  AdminHeader,
  ServiceSidebar,
  PermissionsPanel,
  ProjectsTable,
  ApprovalDetailModal,
} from './admin';
import { statusColors, cn } from '@/lib/theme';

export const AdminDashboard = () => {
  const [services, setServices] = useState<ServiceCode[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [permissions, setPermissions] = useState<User[]>([]);
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

  useEffect(() => {
    const fetchServices = async () => {
      const data = await getServices();
      setServices(data);
      if (data.length > 0) setSelectedService(data[0].code);
    };
    fetchServices();
  }, []);

  useEffect(() => {
    if (!selectedService) return;
    const fetchProjects = async () => {
      setLoading(true);
      const data = await getProjects(selectedService);
      setProjects(data);
      setLoading(false);
    };
    fetchProjects();
  }, [selectedService]);

  useEffect(() => {
    if (!selectedService) return;
    const fetchPermissions = async () => {
      const data = await getPermissions(selectedService);
      setPermissions(data);
    };
    fetchPermissions();
  }, [selectedService]);

  const refreshProjects = async () => {
    if (!selectedService) return;
    setLoading(true);
    const data = await getProjects(selectedService);
    setProjects(data);
    setLoading(false);
  };

  const handleAddUser = async (user: UserSearchResult) => {
    if (!selectedService) return;
    try {
      await addPermission(selectedService, user.id);
      const data = await getPermissions(selectedService);
      setPermissions(data);
    } catch {
      alert('사용자 추가 실패');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!selectedService) return;
    try {
      await deletePermission(selectedService, userId);
      const data = await getPermissions(selectedService);
      setPermissions(data);
    } catch {
      alert('사용자 삭제 실패');
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="flex h-[calc(100vh-73px)]">
        <ServiceSidebar
          services={services}
          selectedService={selectedService}
          onSelectService={setSelectedService}
          projectCount={projects.length}
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
              {/* Service Header */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedService}</h2>
                    <span className={cn('px-2 py-0.5 text-xs font-medium rounded', statusColors.info.bg, statusColors.info.textDark)}>서비스</span>
                  </div>
                  <p className="text-gray-500 mt-1">{services.find((s) => s.code === selectedService)?.name}</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  과제 등록
                </Button>
              </div>

              {/* Main Content - 2 Columns */}
              <div className="grid grid-cols-[320px_1fr] gap-6">
                <PermissionsPanel
                  permissions={permissions}
                  onAddUser={handleAddUser}
                  onRemoveUser={handleRemoveUser}
                />

                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">과제 목록</h3>
                  </div>
                  <ProjectsTable
                    projects={projects}
                    loading={loading}
                    actionLoading={actionLoading}
                    onConfirmCompletion={handleConfirmCompletion}
                    onViewApproval={handleViewApproval}
                  />
                </div>
              </div>
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
          serviceName={services.find((s) => s.code === selectedService)?.name || ''}
          onClose={() => setShowCreateModal(false)}
          onCreated={refreshProjects}
        />
      )}
    </div>
  );
};
