'use client';

import { Project, DBCredential } from '@/lib/types';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { ProjectHeader } from '../common';

interface SduProjectPageProps {
  project: Project;
  isAdmin: boolean;
  credentials: DBCredential[];
  onProjectUpdate: (project: Project) => void;
}

export const SduProjectPage = ({
  project,
}: SduProjectPageProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectHeader project={project} />

      <main className="p-6 space-y-6">
        <div className="grid grid-cols-[350px_1fr] gap-6">
          <ProjectInfoCard project={project} />
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              SDU 연동 프로세스
            </h3>
            <p className="text-gray-500 text-sm">
              SDU 연동 프로세스 기능이 준비 중입니다.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
