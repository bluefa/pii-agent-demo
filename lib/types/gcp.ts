// ===== GCP TF 설치 상태 =====

export type GcpTfStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

// ===== PSC Connection 상태 =====

export type GcpPscStatus = 'NOT_REQUESTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
