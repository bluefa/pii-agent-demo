'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Project, SecretKey } from '@/lib/types';
import type {
  SduProjectStatus,
  SduProcessStatus,
  SduInstallationStatus,
  IamUser,
  IssueAkSkResponse,
  SourceIpManagement,
  SduAthenaTable,
} from '@/lib/types/sdu';
import { getSduCurrentStep } from '@/lib/process/calculator';
import {
  getSduInstallationStatus,
  getS3UploadStatus,
  checkS3Upload,
  checkSduInstallation,
  getIamUser,
  issueAkSk,
  getSourceIpList,
  registerSourceIp,
  getAthenaTables,
  executeSduConnectionTest,
} from '@/app/lib/api/sdu';
import { getProject } from '@/app/lib/api';
import { ProjectHeader, RejectionAlert } from '@/app/projects/[projectId]/common';
import { SduProjectInfoCard } from '@/app/projects/[projectId]/sdu/SduProjectInfoCard';
import { SduProcessStatusCard } from '@/app/projects/[projectId]/sdu/SduProcessStatusCard';
import {
  IamUserManageModal,
  SourceIpManageModal,
  SduSetupGuideModal,
  SduAthenaTableList,
} from '@/app/components/features/sdu';
import { useModal } from '@/app/hooks/useModal';

interface SduProjectPageProps {
  project: Project;
  isAdmin: boolean;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

export const SduProjectPage = ({
  project,
  isAdmin,
  onProjectUpdate,
}: SduProjectPageProps) => {
  const [currentStep, setCurrentStep] = useState<SduProcessStatus>('S3_UPLOAD_PENDING');
  const [sduInstallationStatus, setSduInstallationStatus] = useState<SduInstallationStatus | null>(null);
  const [iamUser, setIamUser] = useState<IamUser | null>(null);
  const [sourceIpList, setSourceIpList] = useState<SourceIpManagement | null>(null);
  const [athenaTables, setAthenaTables] = useState<SduAthenaTable[]>([]);

  const [connectionTestLoading, setConnectionTestLoading] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const s3PollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const installPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const iamUserModal = useModal();
  const sourceIpModal = useModal();
  const setupGuideModal = useModal();

  const stopInstallPolling = useCallback(() => {
    if (installPollRef.current) {
      clearInterval(installPollRef.current);
      installPollRef.current = null;
    }
  }, []);

  const startInstallPolling = useCallback(() => {
    if (installPollRef.current) return;
    installPollRef.current = setInterval(async () => {
      try {
        const installStatus = await checkSduInstallation(project.id);
        const s3Status = await getS3UploadStatus(project.id);
        setSduInstallationStatus(installStatus);

        if (installStatus.athenaSetup.status === 'COMPLETED') {
          stopInstallPolling();
          const sduStatus: SduProjectStatus = {
            s3Upload: s3Status,
            installation: installStatus,
            connectionTest: { status: 'NOT_TESTED' },
          };
          const step = getSduCurrentStep(sduStatus);
          setCurrentStep(step);

          if (step === 'WAITING_CONNECTION_TEST' || step === 'CONNECTION_VERIFIED' || step === 'INSTALLATION_COMPLETE') {
            const tables = await getAthenaTables(project.id).catch(() => []);
            setAthenaTables(tables);
          }
        }
      } catch {
        // polling failure ignored, retry next interval
      }
    }, 10000);
  }, [project.id, stopInstallPolling]);

  const refreshSduStatus = useCallback(async (s3Status: Awaited<ReturnType<typeof getS3UploadStatus>>) => {
    const installStatus = await getSduInstallationStatus(project.id);
    const sduStatus: SduProjectStatus = {
      s3Upload: s3Status,
      installation: installStatus,
      connectionTest: { status: 'NOT_TESTED' },
    };

    const step = getSduCurrentStep(sduStatus);
    setCurrentStep(step);
    setSduInstallationStatus(installStatus);

    const [iam, sourceIp] = await Promise.all([
      getIamUser(project.id).catch(() => null),
      getSourceIpList(project.id).catch(() => null),
    ]);
    setIamUser(iam);
    setSourceIpList(sourceIp);

    if (step === 'INSTALLING' || step === 'WAITING_CONNECTION_TEST' || step === 'CONNECTION_VERIFIED' || step === 'INSTALLATION_COMPLETE') {
      const tables = await getAthenaTables(project.id).catch(() => []);
      setAthenaTables(tables);
    }

    if (step === 'INSTALLING' || step === 'S3_UPLOAD_CONFIRMED') {
      startInstallPolling();
    } else {
      stopInstallPolling();
    }

    return step;
  }, [project.id, startInstallPolling, stopInstallPolling]);

  // Initial load + S3 upload polling
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const s3Status = await getS3UploadStatus(project.id);
        const step = await refreshSduStatus(s3Status);

        if (step === 'S3_UPLOAD_PENDING') {
          startS3Polling();
        }
      } catch (err) {
        console.error('Failed to fetch SDU status:', err);
      }
    };

    const startS3Polling = () => {
      if (s3PollRef.current) return;
      s3PollRef.current = setInterval(async () => {
        try {
          const s3Status = await checkS3Upload(project.id);
          if (s3Status.status === 'CONFIRMED') {
            if (s3PollRef.current) clearInterval(s3PollRef.current);
            s3PollRef.current = null;
            await refreshSduStatus(s3Status);
          }
        } catch {
          // polling failure ignored, retry next interval
        }
      }, 5000);
    };

    fetchInitial();

    return () => {
      if (s3PollRef.current) {
        clearInterval(s3PollRef.current);
        s3PollRef.current = null;
      }
      if (installPollRef.current) {
        clearInterval(installPollRef.current);
        installPollRef.current = null;
      }
    };
  }, [project.id, refreshSduStatus]);

  const handleExecuteConnectionTest = useCallback(async () => {
    try {
      setConnectionTestLoading(true);
      await executeSduConnectionTest(project.id);

      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);

      alert('연결 테스트가 성공했습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '연결 테스트에 실패했습니다.');
    } finally {
      setConnectionTestLoading(false);
    }
  }, [project.id, onProjectUpdate]);

  const handleReissueAkSk = useCallback(async (): Promise<IssueAkSkResponse | null> => {
    try {
      setReissuing(true);
      const result = await issueAkSk(project.id, 'current-user');
      const iam = await getIamUser(project.id);
      setIamUser(iam);
      return result;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AK/SK 재발급에 실패했습니다.');
      return null;
    } finally {
      setReissuing(false);
    }
  }, [project.id]);

  const handleRegisterSourceIp = useCallback(async (cidr: string) => {
    try {
      await registerSourceIp(project.id, cidr);
      const sourceIp = await getSourceIpList(project.id);
      setSourceIpList(sourceIp);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Source IP 등록에 실패했습니다.');
    }
  }, [project.id]);

  const showAthenaTables = currentStep === 'INSTALLING' ||
                           currentStep === 'WAITING_CONNECTION_TEST' ||
                           currentStep === 'CONNECTION_VERIFIED' ||
                           currentStep === 'INSTALLATION_COMPLETE';

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectHeader project={project} />

      <main className="p-6 space-y-6">
        <div className="grid grid-cols-[350px_1fr] gap-6 items-start">
          <SduProjectInfoCard
            project={project}
            iamUser={iamUser}
            sourceIps={sourceIpList?.entries || []}
            onOpenIamUser={iamUserModal.open}
            onOpenSourceIp={sourceIpModal.open}
            onOpenSetupGuide={setupGuideModal.open}
          />

          <SduProcessStatusCard
            project={project}
            currentStep={currentStep}
            sduInstallationStatus={sduInstallationStatus}
            iamUser={iamUser}
            sourceIps={sourceIpList?.entries || []}
            connectionTestLoading={connectionTestLoading}
            onExecuteConnectionTest={handleExecuteConnectionTest}
            projectId={project.id}
          />
        </div>

        {showAthenaTables && athenaTables.length > 0 && (
          <SduAthenaTableList
            tables={athenaTables}
            database={athenaTables[0]?.database || 'sdu_db'}
          />
        )}

        <RejectionAlert project={project} />
      </main>

      <IamUserManageModal
        isOpen={iamUserModal.isOpen}
        onClose={iamUserModal.close}
        iamUser={iamUser}
        isAdmin={isAdmin}
        onReissue={handleReissueAkSk}
        reissuing={reissuing}
      />

      <SourceIpManageModal
        isOpen={sourceIpModal.isOpen}
        onClose={sourceIpModal.close}
        sourceIps={sourceIpList?.entries || []}
        onRegister={handleRegisterSourceIp}
      />

      <SduSetupGuideModal
        isOpen={setupGuideModal.isOpen}
        onClose={setupGuideModal.close}
      />
    </div>
  );
};
