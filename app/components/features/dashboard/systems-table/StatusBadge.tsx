'use client';

export const StatusBadge = ({ healthy, unhealthy }: { healthy: number; unhealthy: number }) => {
  if (unhealthy === 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
        style={{ backgroundColor: '#dcfce7', color: '#166534' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#16a34a' }}
        />
        Healthy
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: '#fef2f2', color: '#991b1b' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: '#dc2626' }}
      />
      {unhealthy} Unhealthy
    </span>
  );
};
