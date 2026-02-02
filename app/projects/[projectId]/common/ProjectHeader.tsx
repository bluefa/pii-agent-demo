'use client';

import { useRouter } from 'next/navigation';
import { Project } from '@/lib/types';

interface ProjectHeaderProps {
  project: Project;
}

const Logo = () => (
  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  </div>
);

const UserIcon = () => (
  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  </div>
);

const ChevronRight = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export const ProjectHeader = ({ project }: ProjectHeaderProps) => {
  const router = useRouter();

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-xl font-bold text-gray-900">PII Agent</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">관리자</span>
          <UserIcon />
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <nav className="flex items-center gap-2 text-sm">
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            관리자
          </button>
          <ChevronRight />
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            {project.serviceCode}
          </button>
          <ChevronRight />
          <span className="font-medium text-gray-900">{project.projectCode}</span>
        </nav>
      </div>
    </>
  );
};
