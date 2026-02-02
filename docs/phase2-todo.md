# Phase 2 TODO

> Azure 설치 상태 인라인 표시 (Phase 1) 완료 후 진행할 작업

---

## 우선순위 1: AWS 설치 상태 인라인 표시

### 목표
Azure 패턴을 AWS에 적용하여 INSTALLING 단계에서 설치 상태 인라인 표시

### 작업 내용
- [ ] `AwsInstallationInline.tsx` 생성
  - TF 권한 유무에 따른 UI 분기 (Case 1: 자동, Case 2: 수동)
  - serviceTfCompleted, bdcTfCompleted 상태 표시
  - TF Script 다운로드 버튼 (Case 2)
  - 새로고침 버튼
- [ ] `ProcessStatusCard.tsx` 수정
  - AWS 프로젝트 INSTALLING → AwsInstallationInline 사용
- [ ] AWS BFF API 연동
  - `GET /api/aws/projects/{projectId}/installation-status`
  - `POST /api/aws/projects/{projectId}/check-installation`
  - `GET /api/aws/projects/{projectId}/terraform-script`

### 참조
- `docs/api/providers/aws.md` - AWS API 명세
- `AzureInstallationInline.tsx` - 패턴 참조

---

## 우선순위 2: IDC 설치 상태 UI

### 목표
IDC Provider의 설치 상태 표시 UI 구현

### 작업 내용
- [ ] `IdcInstallationInline.tsx` 생성
  - 에이전트 설치 가이드 표시
  - 설치 상태 확인 (에이전트 연결 상태)
- [ ] IDC BFF API 연동
  - `GET /api/idc/projects/{projectId}/installation-status`

### 참조
- `docs/api/providers/idc.md` - IDC API 명세

---

## 우선순위 3: GCP/SDU 설치 상태 UI

### 목표
GCP, SDU Provider의 설치 상태 표시 UI 구현

### 작업 내용
- [ ] `GcpInstallationInline.tsx` 생성
- [ ] `SduInstallationInline.tsx` 생성
- [ ] 각 Provider BFF API 연동

### 참조
- `docs/api/providers/gcp.md`
- `docs/api/providers/sdu.md`

---

## 우선순위 4: 에러 처리 전략

### 목표
API 호출 실패 시 일관된 에러 처리 및 사용자 피드백

### 작업 내용
- [ ] 에러 타입 정의 (`lib/types/error.ts`)
- [ ] 에러 핸들러 훅 생성 (`hooks/useErrorHandler.ts`)
- [ ] 에러 표시 컴포넌트 (`components/ui/ErrorBanner.tsx`)
- [ ] API 함수에 에러 핸들링 적용

---

## 우선순위 5: 비동기 작업 상태 관리

### 목표
TF 설치, Azure PE 승인 등 비동기 작업의 상태 관리 설계

### 작업 내용
- [ ] 폴링 전략 설계 (interval, 조건부 중단)
- [ ] 낙관적 업데이트 적용
- [ ] 실시간 알림 (선택적)

---

## 완료 조건

- [ ] 모든 Provider (AWS, Azure, GCP, IDC, SDU) 설치 상태 인라인 표시
- [ ] `npm run build` 성공
- [ ] 에러 발생 시 사용자 친화적 메시지 표시

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-02 | 초안 작성 |
