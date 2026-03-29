'use client';

import { QueueBoard } from '@/app/components/features/queue-board';
import { AdminHeader } from '@/app/components/features/admin';

export default function TaskAdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <QueueBoard />
      </div>
    </div>
  );
}
