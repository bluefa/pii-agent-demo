# SDU 연동 기능 구현 프롬프트

## 실행 방법

```bash
# 모든 권한 자동 승인 (--dangerously-skip-permissions)
claude --dangerously-skip-permissions

# 또는 yes 플래그
claude --yes
```

실행 후 아래 프롬프트를 붙여넣으세요.

---

## 프롬프트

```
SDU 연동 기능을 구현해야 합니다.

설계 문서를 먼저 읽어주세요:
- `docs/sdu-process-design.md` — 프로세스 상태, UX 구조, 역할별 흐름 전체 설계
- `docs/cloud-provider-states.md` — SDU 섹션 (기존 Provider 대비 차이)
- `docs/api/providers/sdu.md` — 기존 API 명세 (확장 필요)

구현은 worktree `pii-agent-demo-sdu-process` (브랜치: `docs/sdu-process-design`)에서 이어서 진행합니다.

### 핵심 요약

SDU는 기존 Cloud Provider(AWS/Azure/GCP)와 근본적으로 다른 프로세스입니다:
- **전용 상태머신**: S3_UPLOAD_PENDING → S3_UPLOAD_CONFIRMED → INSTALLING → WAITING_CONNECTION_TEST → CONNECTION_VERIFIED → INSTALLATION_COMPLETE
- **승인/확정 대기 없음**: 기존 6단계 상태를 재활용하지 않음
- **상시 관리 영역**: IAM USER, SourceIP는 프로세스가 아닌 기본 정보(ProjectInfoCard) 영역
- **리소스 선택 없음**: Crawler 결과 전체 자동 연동
- **S3 확인 이후 완전히 BDC**: Crawler → Athena Table → 확정 → BDC Athena 설정

### INSTALLING 서브스텝
- crawler: configured(생성여부) + lastRunStatus(NONE/SUCCESS/FAILED)
- athenaTable: PENDING → CREATED (n개), database는 sdu_abc 고정
- targetConfirmed: BDC 내부 확정 (서비스측 노출 불필요)
- athenaSetup: PENDING → IN_PROGRESS → COMPLETED (BDC측 Athena 설정)

### UX 구조
- 기본 정보 영역: IAM USER [관리], SourceIP [관리], 환경 구성 가이드 [보기]
- StepProgressBar: 4단계 (S3확인 → 설치 → 테스트 → 완료)
- 설치 단계: 서브스텝 체크리스트 표시
- Athena Table 목록: 기존 ResourceTable 재사용 X, database.tableName + S3 Location 표시
- Test Connection 이후: AWS와 완전히 동일

### 사용자 역할 (기존과 동일)
- 관리자: AK/SK 재발급, SourceIP 확인(BDC), 전체 조회
- 서비스 담당자: SourceIP 등록, S3 업로드, Test Connection

### 구현 순서 (제안)

Phase 1: 타입 + 상태 모델
- lib/types/ 에 SDU 전용 타입 추가 (SduProjectStatus, SduInstallationStatus 등)
- lib/process/calculator.ts에 SDU 분기 추가

Phase 2: BFF API 명세 + API Routes
- docs/api/providers/sdu.md 확장 (IAM, SourceIP, S3 확인 API 추가)
- API Routes 구현 (mock adapter 포함)

Phase 3: 컴포넌트
- SduProjectPage.tsx (메인 페이지)
- SDU 전용 기본 정보 영역 (IAM 관리 Modal, SourceIP 관리 Modal, 환경 구성 가이드 Modal)
- SDU 설치 상태 표시 (서브스텝 체크리스트)
- Athena Table 목록 컴포넌트

Phase 4: 통합
- ProjectDetail.tsx에 SDU 분기 추가
- StepProgressBar SDU 4단계 지원

기존 코드 패턴을 반드시 참고하세요:
- AWS: app/projects/[projectId]/AwsProjectPage.tsx
- IDC: app/projects/[projectId]/IdcProjectPage.tsx (승인 없는 프로세스 참고)
- 설치 상태: components/features/process-status/
- 프로세스 계산: lib/process/calculator.ts
```
