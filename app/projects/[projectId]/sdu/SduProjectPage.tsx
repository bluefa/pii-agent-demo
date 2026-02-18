'use client';

import { useState, useEffect, useCallback } from 'react';
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
import dynamic from 'next/dynamic';
import { SduAthenaTableList } from '@/app/components/features/sdu';

const IamUserManageModal = dynamic(() =>
  import('@/app/components/features/sdu/IamUserManageModal').then(m => ({ default: m.IamUserManageModal }))
);
const SourceIpManageModal = dynamic(() =>
  import('@/app/components/features/sdu/SourceIpManageModal').then(m => ({ default: m.SourceIpManageModal }))
);
const SduSetupGuideModal = dynamic(() =>
  import('@/app/components/features/sdu/SduSetupGuideModal').then(m => ({ default: m.SduSetupGuideModal }))
);
import { useModal } from '@/app/hooks/useModal';
import { usePolling } from '@/app/hooks/usePolling';

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

  const iamUserModal = useModal();
  const sourceIpModal = useModal();
  const setupGuideModal = useModal();

  const refreshSduStatus = useCallback(async (s3Status: Awaited<ReturnType<typeof getS3UploadStatus>>) => {
    const installStatus = await getSduInstallationStatus(project.targetSourceId);
    const sduStatus: SduProjectStatus = {
      s3Upload: s3Status,
      installation: installStatus,
      connectionTest: { status: 'NOT_TESTED' },
    };

    const step = getSduCurrentStep(sduStatus);
    setCurrentStep(step);
    setSduInstallationStatus(installStatus);

    const [iam, sourceIp] = await Promise.all([
      getIamUser(project.targetSourceId).catch(() => null),
      getSourceIpList(project.targetSourceId).catch(() => null),
    ]);
    setIamUser(iam);
    setSourceIpList(sourceIp);

    if (step === 'INSTALLING' || step === 'WAITING_CONNECTION_TEST' || step === 'CONNECTION_VERIFIED' || step === 'INSTALLATION_COMPLETE') {
      const tables = await getAthenaTables(project.targetSourceId).catch(() => []);
      setAthenaTables(tables);
    }

    return step;
  }, [project.targetSourceId]);

  const installPoller = usePolling({
    fn: async () => {
      const installStatus = await checkSduInstallation(project.targetSourceId);
      const s3Status = await getS3UploadStatus(project.targetSourceId);
      setSduInstallationStatus(installStatus);
      return { installStatus, s3Status };
    },
    interval: 10000,
    shouldStop: ({ installStatus }) => installStatus.athenaSetup.status === 'COMPLETED',
    onStop: async ({ installStatus, s3Status }) => {
      const sduStatus: SduProjectStatus = {
        s3Upload: s3Status,
        installation: installStatus,
        connectionTest: { status: 'NOT_TESTED' },
      };
      const step = getSduCurrentStep(sduStatus);
      setCurrentStep(step);

      if (step === 'WAITING_CONNECTION_TEST' || step === 'CONNECTION_VERIFIED' || step === 'INSTALLATION_COMPLETE') {
        const tables = await getAthenaTables(project.targetSourceId).catch(() => []);
        setAthenaTables(tables);
      }
    },
  });

  const s3Poller = usePolling({
    fn: () => checkS3Upload(project.targetSourceId),
    interval: 5000,
    shouldStop: (s3Status) => s3Status.status === 'CONFIRMED',
    onStop: async (s3Status) => {
      const step = await refreshSduStatus(s3Status);
      if (step === 'INSTALLING' || step === 'S3_UPLOAD_CONFIRMED') {
        installPoller.start();
      }
    },
  });

  // Initial load
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const s3Status = await getS3UploadStatus(project.targetSourceId);
        const step = await refreshSduStatus(s3Status);

        if (step === 'S3_UPLOAD_PENDING') {
          s3Poller.start();
        } else if (step === 'INSTALLING' || step === 'S3_UPLOAD_CONFIRMED') {
          installPoller.start();
        }
      } catch (err) {
        console.error('Failed to fetch SDU status:', err);
      }
    };

    fetchInitial();
  // s3Poller/installPoller는 usePolling 내부에서 ref로 안정화되므로 deps에서 제외
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.targetSourceId]);

  const handleExecuteConnectionTest = useCallback(async () => {
    try {
      setConnectionTestLoading(true);
      await executeSduConnectionTest(project.targetSourceId);

      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);

      alert('연결 테스트가 성공했습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '연결 테스트에 실패했습니다.');
    } finally {
      setConnectionTestLoading(false);
    }
  }, [project.targetSourceId, onProjectUpdate]);

  const handleReissueAkSk = useCallback(async (): Promise<IssueAkSkResponse | null> => {
    try {
      setReissuing(true);
      const result = await issueAkSk(project.targetSourceId, 'current-user');
      const iam = await getIamUser(project.targetSourceId);
      setIamUser(iam);
      return result;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AK/SK 재발급에 실패했습니다.');
      return null;
    } finally {
      setReissuing(false);
    }
  }, [project.targetSourceId]);

  const handleRegisterSourceIp = useCallback(async (cidr: string) => {
    try {
      await registerSourceIp(project.targetSourceId, cidr);
      const sourceIp = await getSourceIpList(project.targetSourceId);
      setSourceIpList(sourceIp);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Source IP 등록에 실패했습니다.');
    }
  }, [project.targetSourceId]);

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
