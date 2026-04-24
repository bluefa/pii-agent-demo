'use client';

const INTEGRATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  AWS: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  Azure: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  GCP: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  IDC: { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
  SDU: { bg: '#ffe4e6', text: '#9f1239', border: '#fecdd3' },
  '수동조사': { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
};

export const PillTag = ({ text, variant = 'gray' }: { text: string; variant?: 'gray' | 'integration' }) => {
  if (variant === 'integration') {
    const colors = INTEGRATION_COLORS[text] ?? INTEGRATION_COLORS['수동조사'];
    return (
      <span
        className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full"
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
        }}
      >
        {text}
      </span>
    );
  }
  return (
    <span
      className="inline-block text-xs px-2 py-0.5 rounded-full"
      style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
    >
      {text}
    </span>
  );
};
