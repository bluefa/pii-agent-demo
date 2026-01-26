'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { UserSearchInput } from '../ui/UserSearchInput';
import { ProjectCreateModal } from './ProjectCreateModal';
import { getServices, getProjects, getPermissions, addPermission, deletePermission, completeInstallation, confirmCompletion, UserSearchResult } from '../../lib/api';
import { ServiceCode, ProjectSummary, ProcessStatus, User } from '../../../lib/types';

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
    case ProcessStatus.CONNECTION_VERIFIED:
      return '연결 확인 완료';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return '설치 완료';
    default:
      return '-';
  }
};

const CloudProviderBadge = ({ provider }: { provider: string }) => {
  if (provider === 'AWS') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-orange-100 text-orange-700 text-sm font-medium">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.76 10.17c0 .4.03.73.09 1 .06.26.14.49.26.68.04.06.06.12.06.17 0 .07-.04.14-.13.2l-.42.28c-.06.04-.12.06-.17.06-.07 0-.14-.03-.2-.1-.12-.13-.22-.27-.31-.42-.09-.16-.17-.33-.26-.52-.65.77-1.47 1.16-2.46 1.16-.7 0-1.26-.2-1.67-.6-.41-.4-.62-.94-.62-1.61 0-.71.25-1.29.76-1.73.51-.44 1.18-.66 2.03-.66.28 0 .57.02.87.07.3.04.61.11.93.18v-.6c0-.62-.13-1.06-.38-1.31-.26-.25-.69-.38-1.31-.38-.28 0-.57.03-.87.1-.3.07-.59.15-.87.25-.13.05-.22.08-.27.09-.05.01-.09.02-.12.02-.1 0-.15-.08-.15-.23v-.37c0-.12.02-.21.05-.27.03-.06.09-.12.18-.17.28-.15.62-.27 1.02-.37.4-.1.83-.15 1.28-.15 1 0 1.73.23 2.21.68.47.45.71 1.14.71 2.06v2.72zm-3.4 1.27c.27 0 .55-.05.84-.15.29-.1.55-.28.77-.52.14-.15.24-.32.3-.52.06-.2.1-.43.1-.71v-.34c-.24-.06-.49-.1-.74-.13-.25-.03-.5-.05-.74-.05-.53 0-.92.1-1.18.31-.26.21-.39.51-.39.89 0 .37.1.65.29.84.19.2.47.29.82.29v.09zm6.27.85c-.13 0-.22-.02-.28-.07-.06-.05-.12-.15-.17-.29l-1.9-6.28c-.05-.14-.08-.24-.08-.29 0-.12.06-.18.18-.18h.73c.14 0 .23.02.29.07.06.05.11.15.16.29l1.36 5.38 1.26-5.38c.04-.14.09-.24.15-.29.06-.05.16-.07.29-.07h.59c.14 0 .23.02.29.07.06.05.12.15.16.29l1.27 5.45 1.4-5.45c.05-.14.1-.24.16-.29.06-.05.16-.07.29-.07h.69c.12 0 .18.06.18.18 0 .05-.01.1-.02.16-.01.06-.03.13-.06.22l-1.95 6.28c-.05.14-.1.24-.17.29-.06.05-.16.07-.28.07h-.63c-.14 0-.23-.02-.29-.07-.06-.05-.12-.15-.16-.29l-1.25-5.2-1.24 5.2c-.04.14-.09.24-.15.29-.06.05-.16.07-.29.07h-.63zm10.02.21c-.4 0-.81-.05-1.21-.14-.4-.09-.71-.19-.92-.3-.12-.07-.2-.14-.24-.22-.04-.08-.06-.16-.06-.24v-.38c0-.15.06-.23.17-.23.04 0 .09.01.13.02.04.01.11.04.19.07.26.11.54.2.83.26.3.06.59.09.88.09.5 0 .88-.09 1.15-.26.27-.18.4-.42.4-.74 0-.22-.07-.4-.22-.55-.15-.15-.42-.28-.82-.41l-1.18-.37c-.59-.19-1.03-.47-1.3-.84-.27-.37-.41-.78-.41-1.23 0-.36.08-.67.23-.95.15-.28.36-.52.61-.71.25-.2.55-.35.89-.45.34-.1.7-.15 1.08-.15.18 0 .36.01.54.03.18.02.36.05.53.08.17.04.33.08.48.13.15.05.27.1.36.16.1.06.17.12.22.18.05.06.07.13.07.22v.35c0 .15-.06.23-.17.23-.06 0-.16-.03-.28-.09-.43-.2-.91-.3-1.44-.3-.45 0-.8.08-1.05.23-.25.15-.37.38-.37.69 0 .22.08.4.24.56.16.16.45.3.87.43l1.15.37c.58.19 1.01.45 1.27.81.26.35.39.75.39 1.18 0 .37-.08.7-.23 1-.15.3-.37.56-.64.77-.28.21-.61.38-1 .49-.4.11-.83.16-1.29.16z"/>
        </svg>
        AWS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-700 text-sm font-medium">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3L2 9l10 6 10-6-10-6zM2 15l10 6 10-6M2 12l10 6 10-6"/>
      </svg>
      IDC
    </span>
  );
};

export const AdminDashboard = () => {
  const router = useRouter();
  const [services, setServices] = useState<ServiceCode[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [permissions, setPermissions] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const handleCompleteInstallation = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(projectId);
      await completeInstallation(projectId);
      await refreshProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : '설치 완료 처리 실패');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmCompletion = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(projectId);
      await confirmCompletion(projectId);
      await refreshProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : '설치 완료 확정 실패');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">PII Agent 관리자</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">관리자</span>
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left: Service List */}
        <aside className="w-64 bg-white shadow-sm overflow-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">서비스 코드</h2>
          </div>
          <ul className="py-2">
            {services.map((service) => (
                <li
                  key={service.code}
                  onClick={() => setSelectedService(service.code)}
                  className={`mx-2 px-3 py-3 cursor-pointer rounded-lg transition-all duration-150 ${selectedService === service.code
                      ? 'bg-blue-50 border-l-4 border-l-blue-500 shadow-sm'
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${selectedService === service.code ? 'text-blue-700' : 'text-gray-900'}`}>
                      {service.code}
                    </span>
                    {selectedService === service.code && projects.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                        {projects.length}
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${selectedService === service.code ? 'text-blue-600' : 'text-gray-500'}`}>
                    {service.name}
                  </div>
                </li>
            ))}
          </ul>
        </aside>

        {/* Right: Service Detail */}
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
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">서비스</span>
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
                {/* Left: Permissions Section */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">권한 유저</h3>
                  <div className="space-y-4">
                    {/* User List */}
                    <div className="space-y-2">
                      {permissions.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                        >
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <span className="font-medium text-gray-900 flex-1">{user.name}</span>
                          <button
                            onClick={() => handleRemoveUser(user.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {permissions.length === 0 && (
                        <div className="text-center py-6">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                          </div>
                          <p className="text-gray-500 text-sm">권한을 가진 유저가 없습니다</p>
                        </div>
                      )}
                    </div>

                    {/* Add User */}
                    <div className="pt-3 border-t border-gray-100">
                      <UserSearchInput
                        excludeIds={permissions.map((u) => u.id)}
                        onSelect={handleAddUser}
                        placeholder="사용자 검색 (이름, 이메일)"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Projects Section */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">과제 목록</h3>
                  </div>

                  {loading ? (
                    <div className="p-12 text-center">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-gray-500 text-sm">로딩 중...</p>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <p className="text-gray-500">등록된 과제가 없습니다</p>
                      <p className="text-gray-400 text-sm mt-1">상단의 과제 등록 버튼으로 새 과제를 추가하세요</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16"></th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">과제 코드</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">설명</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">상태</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20"></th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
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
                              className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                            >
                              <td className="px-6 py-4">
                                <CloudProviderBadge provider={project.cloudProvider} />
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                  {project.projectCode}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                                {project.description || '-'}
                              </td>
                              <td className="px-6 py-4 text-gray-500 text-sm">{getStatusText(project.processStatus)}</td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-block px-2.5 py-1 text-xs font-medium text-white rounded-full ${badge.color}`}
                                >
                                  {badge.text}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {project.processStatus === ProcessStatus.INSTALLING && (
                                  <button
                                    onClick={(e) => handleCompleteInstallation(project.id, e)}
                                    disabled={actionLoading === project.id}
                                    className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                                  >
                                    {actionLoading === project.id ? (
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                    설치 완료
                                  </button>
                                )}
                                {project.processStatus === ProcessStatus.WAITING_CONNECTION_TEST && (
                                  <span className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
                                    연결 테스트 대기
                                  </span>
                                )}
                                {project.processStatus === ProcessStatus.CONNECTION_VERIFIED && (
                                  <button
                                    onClick={(e) => handleConfirmCompletion(project.id, e)}
                                    disabled={actionLoading === project.id}
                                    className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                                  >
                                    {actionLoading === project.id ? (
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                    설치 완료 확정
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
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
