'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { ProjectCreateModal } from './ProjectCreateModal';
import { PermissionManageModal } from './PermissionManageModal';
import { getServices, getProjects } from '../../lib/api';
import { ServiceCode, ProjectSummary, ProcessStatus } from '../../../lib/types';

const getStatusBadge = (status: ProcessStatus, hasDisconnected: boolean, hasNew: boolean) => {
  if (hasDisconnected) return { text: '끊김', color: 'bg-red-500' };
  if (hasNew) return { text: '신규', color: 'bg-blue-500' };

  switch (status) {
    case ProcessStatus.INSTALLATION_COMPLETE:
      return { text: '완료', color: 'bg-green-500' };
    case ProcessStatus.INSTALLING:
      return { text: '설치중', color: 'bg-orange-500' };
    default:
      return { text: '대기', color: 'bg-gray-400' };
  }
};

const getStatusText = (status: ProcessStatus) => {
  switch (status) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      return '연동 대상 확정 대기';
    case ProcessStatus.WAITING_APPROVAL:
      return '승인 대기';
    case ProcessStatus.INSTALLING:
      return '설치 진행 중';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return '연결 테스트 필요';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return '설치 완료';
    default:
      return '-';
  }
};

export const AdminDashboard = () => {
  const router = useRouter();
  const [services, setServices] = useState<ServiceCode[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

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

  const refreshProjects = async () => {
    if (!selectedService) return;
    const data = await getProjects(selectedService);
    setProjects(data);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">PII Agent 관리자</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateModal(true)}>과제 등록</Button>
            <Button variant="secondary" onClick={() => setShowPermissionModal(true)}>
              권한 관리
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left: Service List */}
        <aside className="w-64 bg-white border-r overflow-auto">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-700">서비스 코드</h2>
          </div>
          <ul>
            {services.map((service) => (
              <li
                key={service.code}
                onClick={() => setSelectedService(service.code)}
                className={`px-4 py-3 cursor-pointer border-b transition-colors ${selectedService === service.code
                    ? 'bg-blue-50 border-l-4 border-l-blue-500'
                    : 'hover:bg-gray-50'
                  }`}
              >
                <div className="font-medium">{service.code}</div>
                <div className="text-sm text-gray-500">{service.name}</div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Right: Project List */}
        <main className="flex-1 p-6 overflow-auto">
          <h2 className="text-lg font-semibold mb-4">
            {selectedService ? `${selectedService} 과제 목록` : '서비스를 선택하세요'}
          </h2>

          {loading ? (
            <p className="text-gray-500">로딩 중...</p>
          ) : projects.length === 0 ? (
            <p className="text-gray-500">과제가 없습니다</p>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-4 font-medium">과제 코드</th>
                    <th className="text-left p-4 font-medium">상태</th>
                    <th className="text-left p-4 font-medium">Cloud</th>
                    <th className="text-left p-4 font-medium">리소스</th>
                    <th className="text-left p-4 font-medium">배지</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const badge = getStatusBadge(
                      project.processStatus,
                      project.hasDisconnected,
                      project.hasNew
                    );
                    return (
                      <tr
                        key={project.id}
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="border-t hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="p-4 font-medium">{project.projectCode}</td>
                        <td className="p-4 text-gray-600">{getStatusText(project.processStatus)}</td>
                        <td className="p-4">{project.cloudProvider}</td>
                        <td className="p-4">{project.resourceCount}개</td>
                        <td className="p-4">
                          <span
                            className={`inline-block px-2 py-1 text-xs text-white rounded ${badge.color}`}
                          >
                            {badge.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <ProjectCreateModal
          services={services}
          onClose={() => setShowCreateModal(false)}
          onCreated={refreshProjects}
        />
      )}
      {showPermissionModal && (
        <PermissionManageModal services={services} onClose={() => setShowPermissionModal(false)} />
      )}
    </div>
  );
};
