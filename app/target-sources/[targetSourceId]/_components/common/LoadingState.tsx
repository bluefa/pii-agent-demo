'use client';

export const LoadingState = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      {/* TODO: border-blue-500 is used for spinner border color — no exact theme token exists */}
      <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-500">로딩 중...</p>
    </div>
  </div>
);
