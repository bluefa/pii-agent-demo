# PII Agent 비즈니스 도메인

## 시스템 개요

Cloud Provider별 PII Agent 연동 관리 시스템 (Production 프론트엔드 + API 서버)

## Cloud Providers

AWS, Azure, GCP, IDC, SDU (+ 수동조사 예정)

## 역할/권한

- **권한 단위**: 서비스 코드(serviceCode)
- **서비스 담당자**: 권한 있는 서비스 코드만 접근/액션
- **관리자**: 전체 접근 + 과제 등록/삭제 + 권한 관리 + 승인/반려

## 설치 프로세스 (상태머신)

```
1. WAITING_TARGET_CONFIRMATION  (연동 대상 확정 대기)
2. WAITING_APPROVAL             (승인 대기)
3. INSTALLING                   (설치 진행 중)
4. WAITING_CONNECTION_TEST      (연결 테스트 대기)
5. COMPLETED                    (완료)
```

상세: `docs/cloud-provider-states.md`

## 데이터 모델링 원칙

- 정규화 우선: API 용도별 분리
- Project: 핵심 정보만 (resources, scan 정보는 별도 API)
- Resource: metadata로 Provider별 정보 분리 (Discriminated Union)
- InstallationStatus: Provider별 Union Type

## API 아키텍처

### BFF API (Backend for Frontend)
- 위치: `docs/api/`
- 역할: 실제 백엔드 서버 API 명세 (백엔드 팀과의 계약서)
- 문서: `common.md`, `core.md`, `scan.md`, `providers/*.md`

### API Routes (Next.js)
- 위치: `app/api/`
- 역할: 개발 환경에서 BFF API 시뮬레이션
- 문서: 소스 코드(`app/api/**`) 기준

### 호출 흐름
- **Dev**: Frontend → API Routes (`app/api/`)
- **Prod**: Frontend → BFF API (실제 백엔드)

### API 설계 원칙
- 페이지별 API 호출 전략 (`docs/api-design.md`)
- 초기 로드: 필수 정보만
- 상세/갱신: 필요시 별도 호출
- 비동기 작업: 정교한 설계 필요

## 비동기 작업

| 작업 | 트리거 | 상태 |
|------|--------|------|
| 스캔 (AWS/Azure/GCP) | 페이지 진입, 5분 중복 방지 | ✅ 구현 완료 |
| TF 설치 | 자동(권한O) / 수동(권한X) | 설계 필요 |
| Azure PE 승인 | 서비스 담당자 수동 확인 | 설계 필요 |
| Azure VM TF | 주기적 상태 확인 | 설계 필요 |

## TODO

- [x] 스캔 API Routes 구현 (v2)
- [x] Azure BFF API 구현 (7개 엔드포인트) — [ADR-001](../adr/001-remove-tfcompleted.md), [ADR-002](../adr/002-installed-field.md)
- [x] AWS 설치 모드 선택 프로세스 (Step 0)
- [ ] 비동기 작업 상태 관리 설계 (TF 설치, Azure PE 등)
- [ ] 에러 처리 전략 정의
- [ ] Provider별 UI 컴포넌트 분리
- [ ] AWS TF Role 등록 가이드 API 구현
- [ ] AWS TF Script 설치 가이드 API 구현
