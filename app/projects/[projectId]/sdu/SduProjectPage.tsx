'use client';

import { useState, useEffect, useCallback } from 'react';
import { Project } from '@/lib/types';
import type {
  SduProjectStatus,
  SduProcessStatus,
  SduInstallationStatus,
  IamUser,
  SourceIpManagement,
  SduAthenaTable,
} from '@/lib/types/sdu';
import { getSduCurrentStep } from '@/lib/process/calculator';
import {
  getSduInstallationStatus,
  checkSduInstallation,
  getS3UploadStatus,
  confirmS3Upload,
  getIamUser,
  issueAkSk,
  getSourceIpList,
  registerSourceIp,
  confirmSourceIp,
  getAthenaTables,
  executeSduConnectionTest,
} from '@/app/lib/api/sdu';
import { getProject } from '@/app/lib/api';
import { ProjectHeader, RejectionAlert } from '../common';
import { SduProjectInfoCard } from './SduProjectInfoCard';
import { SduProcessStatusCard } from './SduProcessStatusCard';
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

  const [s3UploadLoading, setS3UploadLoading] = useState(false);
  const [connectionTestLoading, setConnectionTestLoading] = useState(false);
  const [reissuing, setReissuing] = useState(false);

  const iamUserModal = useModal();
  const sourceIpModal = useModal();
  const setupGuideModal = useModal();

  useEffect(() => {
    const fetchSduStatus = async () => {
      try {
        const [s3Status, installStatus] = await Promise.all([
          getS3UploadStatus(project.id),
          getSduInstallationStatus(project.id),
        ]);

        const sduStatus: SduProjectStatus = {
          s3Upload: s3Status,
          installation: installStatus,
          connectionTest: { status: 'NOT_TESTED' },
        };

        const step = getSduCurrentStep(sduStatus);
        setCurrentStep(step);
        setSduInstallationStatus(installStatus);

        if (step !== 'S3_UPLOAD_PENDING') {
          const [iam, sourceIp] = await Promise.all([
            getIamUser(project.id).catch(() => null),
            getSourceIpList(project.id).catch(() => null),
          ]);
          setIamUser(iam);
          setSourceIpList(sourceIp);
        }

        if (step === 'INSTALLING' || step === 'WAITING_CONNECTION_TEST' || step === 'CONNECTION_VERIFIED' || step === 'INSTALLATION_COMPLETE') {
          const tables = await getAthenaTables(project.id).catch(() => []);
          setAthenaTables(tables);
        }
      } catch (err) {
        console.error('Failed to fetch SDU status:', err);
      }
    };

    fetchSduStatus();
  }, [project.id]);

  const handleConfirmS3Upload = useCallback(async () => {
    try {
      setS3UploadLoading(true);
      await confirmS3Upload(project.id);

      const updatedProject = await getProject(project.id);
      onProjectUpdate(updatedProject);

      const [s3Status, installStatus] = await Promise.all([
        getS3UploadStatus(project.id),
        getSduInstallationStatus(project.id),
      ]);

      const sduStatus: SduProjectStatus = {
        s3Upload: s3Status,
        installation: installStatus,
        connectionTest: { status: 'NOT_TESTED' },
      };

      const step = getSduCurrentStep(sduStatus);
      setCurrentStep(step);
      setSduInstallationStatus(installStatus);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'S3 업로드 확인에 실패했습니다.');
    } finally {
      setS3UploadLoading(false);
    }
  }, [project.id, onProjectUpdate]);

  const handleCheckInstallation = useCallback(async () => {
    try {
      const installStatus = await checkSduInstallation(project.id);
      setSduInstallationStatus(installStatus);

      const s3Status = await getS3UploadStatus(project.id);
      const sduStatus: SduProjectStatus = {
        s3Upload: s3Status,
        installation: installStatus,
        connectionTest: { status: 'NOT_TESTED' },
      };

      const step = getSduCurrentStep(sduStatus);
      setCurrentStep(step);

      if (step !== 'S3_UPLOAD_PENDING') {
        const tables = await getAthenaTables(project.id).catch(() => []);
        setAthenaTables(tables);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '설치 상태 확인에 실패했습니다.');
    }
  }, [project.id]);

  const handleExecuteConnectionTest = useCallback(async () => {
    try {
      setConnectionTestLoading(true);
      await executeSduConnectionTest(project.id);

      const updatedProject = await getProject(project.id);
      onProjectUpdate(updatedProject);

      alert('연결 테스트가 성공했습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '연결 테스트에 실패했습니다.');
    } finally {
      setConnectionTestLoading(false);
    }
  }, [project.id, onProjectUpdate]);

  const handleReissueAkSk = useCallback(async () => {
    try {
      setReissuing(true);
      await issueAkSk(project.id, 'current-user');
      const iam = await getIamUser(project.id);
      setIamUser(iam);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AK/SK 재발급에 실패했습니다.');
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

  const handleConfirmSourceIp = useCallback(async (cidr: string) => {
    try {
      await confirmSourceIp(project.id, cidr);
      const sourceIp = await getSourceIpList(project.id);
      setSourceIpList(sourceIp);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Source IP 확인에 실패했습니다.');
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
        <div className="grid grid-cols-[350px_1fr] gap-6">
          <SduProjectInfoCard project={project} />

          <SduProcessStatusCard
            project={project}
            currentStep={currentStep}
            sduInstallationStatus={sduInstallationStatus}
            s3UploadLoading={s3UploadLoading}
            connectionTestLoading={connectionTestLoading}
            onConfirmS3Upload={handleConfirmS3Upload}
            onCheckInstallation={handleCheckInstallation}
            onExecuteConnectionTest={handleExecuteConnectionTest}
          />
        </div>

        {currentStep !== 'S3_UPLOAD_PENDING' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">관리 영역</h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => iamUserModal.open()}
                className="px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium text-gray-900">IAM USER 관리</span>
                </div>
                <p className="text-xs text-gray-500">AK/SK 발급 및 관리</p>
              </button>

              <button
                onClick={() => sourceIpModal.open()}
                className="px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span className="font-medium text-gray-900">SourceIP 관리</span>
                </div>
                <p className="text-xs text-gray-500">접근 허용 IP 등록</p>
              </button>

              <button
                onClick={() => setupGuideModal.open()}
                className="px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="font-medium text-gray-900">Setup Guide</span>
                </div>
                <p className="text-xs text-gray-500">설치 가이드 보기</p>
              </button>
            </div>
          </div>
        )}

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
        isAdmin={isAdmin}
        onRegister={handleRegisterSourceIp}
        onConfirm={handleConfirmSourceIp}
      />

      <SduSetupGuideModal
        isOpen={setupGuideModal.isOpen}
        onClose={setupGuideModal.close}
      />
    </div>
  );
};
