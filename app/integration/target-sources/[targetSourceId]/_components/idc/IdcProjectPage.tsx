'use client';

import { useState, useCallback, useEffect } from 'react';
import { Project, ProcessStatus, SecretKey } from '@/lib/types';
import { IdcInstallationStatus as IdcInstallationStatusType, IdcResourceInput } from '@/lib/types/idc';
import {
  updateResourceCredential,
  getProject,
} from '@/app/lib/api';
import {
  getIdcInstallationStatus as fetchIdcInstallationStatus,
  checkIdcInstallation,
  confirmIdcFirewall,
  confirmIdcTargets,
} from '@/app/lib/api/idc';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useToast } from '@/app/components/ui/toast';
import { DeleteInfrastructureButton, ProjectPageMeta, RejectionAlert, type ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { IdcResourceInputPanel, IdcPendingResourceList, IdcResourceTable } from '@/app/components/features/idc';
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
import { IdcProcessStatusCard } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcProcessStatusCard';
import { cn, getButtonClass } from '@/lib/theme';

interface IdcProjectPageProps {
  project: Project;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

export const IdcProjectPage = ({
  project,
  credentials,
  onProjectUpdate,
}: IdcProjectPageProps) => {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showIdcResourceInput, setShowIdcResourceInput] = useState(false);
  const [idcInstallationStatus, setIdcInstallationStatus] = useState<IdcInstallationStatusType | null>(null);
  const [pendingResources, setPendingResources] = useState<IdcResourceInput[]>([]);

  const canEditTargets = project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION;
  const isInstalling = project.processStatus === ProcessStatus.INSTALLING;

  useEffect(() => {
    if (isInstalling) {
      fetchIdcInstallationStatus(project.targetSourceId)
        .then((data) => setIdcInstallationStatus(data))
        .catch(() => {});
    }
  }, [isInstalling, project.targetSourceId]);

  const handleCredentialChange = async (resourceId: string, credentialId: string | null) => {
    try {
      await updateResourceCredential(project.targetSourceId, resourceId, credentialId);
      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
    }
  };

  const handleIdcResourceSave = useCallback((data: IdcResourceInput) => {
    setPendingResources((prev) => [...prev, data]);
    setShowIdcResourceInput(false);
  }, []);

  const handleRemovePendingResource = useCallback((index: number) => {
    setPendingResources((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleIdcConfirmFirewall = useCallback(async () => {
    try {
      await confirmIdcFirewall(project.targetSourceId);

      const statusData = await fetchIdcInstallationStatus(project.targetSourceId);
      setIdcInstallationStatus(statusData);

      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '방화벽 확인에 실패했습니다.');
    }
  }, [project.targetSourceId, onProjectUpdate, toast]);

  const handleIdcRetry = useCallback(async () => {
    try {
      await checkIdcInstallation(project.targetSourceId);

      const statusData = await fetchIdcInstallationStatus(project.targetSourceId);
      setIdcInstallationStatus(statusData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재시도에 실패했습니다.');
    }
  }, [project.targetSourceId, toast]);

  const handleIdcConfirmTargets = useCallback(async () => {
    if (pendingResources.length === 0) {
      toast.warning('확정할 리소스가 없습니다. 먼저 리소스를 추가해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const data = await confirmIdcTargets(project.targetSourceId, pendingResources);

      if (data.project) {
        onProjectUpdate(data.project as Project);
      } else {
        const updatedProject = await getProject(project.targetSourceId);
        onProjectUpdate(updatedProject);
      }

      setPendingResources([]);

      const statusData = await fetchIdcInstallationStatus(project.targetSourceId);
      setIdcInstallationStatus(statusData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '연동 대상 확정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [project.targetSourceId, pendingResources, onProjectUpdate, toast]);

  const hasPendingResources = pendingResources.length > 0 && canEditTargets;

  const identity: ProjectIdentity = {
    cloudProvider: 'IDC',
    monitoringMethod: 'SDU',
    jiraLink: null,
    identifiers: [
      { label: '서비스 코드', value: project.serviceCode },
    ],
  };

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="IDC Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      <IdcProcessStatusCard
        project={project}
        idcInstallationStatus={idcInstallationStatus}
        showResourceInput={showIdcResourceInput}
        idcActionLoading={submitting}
        hasPendingResources={hasPendingResources}
        onShowResourceInput={() => setShowIdcResourceInput(true)}
        onConfirmFirewall={handleIdcConfirmFirewall}
        onRetry={handleIdcRetry}
        onResourceUpdate={async () => {
          const updated = await getProject(project.targetSourceId);
          onProjectUpdate(updated);
        }}
      />

      <GuideCard
        currentStep={project.processStatus}
        provider={project.cloudProvider}
      />

      {showIdcResourceInput && canEditTargets && (
        <IdcResourceInputPanel
          credentials={credentials}
          onSave={handleIdcResourceSave}
          onCancel={() => setShowIdcResourceInput(false)}
        />
      )}

      {canEditTargets && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">리소스 목록</h3>
            {!showIdcResourceInput && (
              <button
                onClick={() => setShowIdcResourceInput(true)}
                className={cn(getButtonClass('primary'), 'text-sm flex items-center gap-2')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                리소스 추가
              </button>
            )}
          </div>
          {pendingResources.length > 0 ? (
            <IdcPendingResourceList
              resources={pendingResources}
              onRemove={handleRemovePendingResource}
            />
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <p className="text-gray-500">등록된 리소스가 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">위의 &quot;리소스 추가&quot; 버튼을 클릭하여 데이터베이스를 등록하세요</p>
            </div>
          )}
        </div>
      )}

      {!canEditTargets && project.resources.length > 0 && (
        <IdcResourceTable
          resources={project.resources}
          processStatus={project.processStatus}
          credentials={credentials}
          onCredentialChange={handleCredentialChange}
        />
      )}

      <RejectionAlert project={project} />

      {canEditTargets && hasPendingResources && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleIdcConfirmTargets}
            disabled={submitting}
            className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
          >
            {submitting && <LoadingSpinner />}
            연동 대상 확정
          </button>
        </div>
      )}
    </main>
  );
};
