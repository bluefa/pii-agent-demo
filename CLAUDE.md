CLAUDE.md (Token-Saver)

PII Agent 관리 시스템

목표
	•	Cloud Provider별 PII Agent 연동 관리 시스템
	•	Production 수준의 프론트엔드 + API 서버
	•	데스크탑 전용, 한국어 UI

기술 스택
	•	Next.js 14 (App Router)
	•	TypeScript
	•	TailwindCSS
	•	API: Next.js Route Handlers (경량 API 서버)
	•	상태 관리: 추후 결정 (useState / React Query 등)

폴더 구조

	•	app/ : 페이지(App Router)
	•	page.tsx : 서비스 코드 목록 + 과제 목록(2-pane)
	•	projects/[id]/ : 과제 상세
	•	admin/ : 관리자 화면
	•	api/ : API Route Handlers
	•	hooks/ : 커스텀 훅 (useModal, useApiMutation, useAsync)
	•	lib/api.ts : API 호출 함수
	•	components/
	•	ui/ : 기본 UI (Button, Badge, Modal, Card, Table, LoadingSpinner 등)
	•	features/ : 도메인/비즈니스 컴포넌트
		•	대형 컴포넌트는 하위 폴더로 분리 (process-status/, resource-table/, admin/)
	•	types/ : 공용 타입
	•	lib/ : 유틸/데이터 접근/상태 전이 로직
	•	utils/ : 유틸리티 함수 (date.ts, credentials.ts)
	•	constants/ : 공용 상수 (labels.ts)
	•	theme.ts : 디자인 토큰 (색상, 스타일, 헬퍼 함수)

코딩 규칙 (필수)
	•	컴포넌트 파일: PascalCase (예: StepIndicator.tsx)
	•	함수: arrow function
	•	Props: interface로 정의
	•	any 금지
	•	Tailwind 클래스 직접 사용 (CSS 파일 최소화)
	•	반응형 불필요 (Desktop only)
	•	Import: 절대 경로(@/) 사용, 상대 경로(../) 금지
		•	예: `import { Button } from '@/app/components/ui/Button'`
		•	예: `import { Project } from '@/lib/types'`

UI 컬러 규칙
	•	연결됨/완료: green-500
	•	끊김/에러: red-500
	•	신규: blue-500
	•	진행중: orange-500
	•	대기중: gray-400
	•	Primary (버튼/링크): blue-600

디자인 토큰 (lib/theme.ts)
	•	스타일 변경 시 theme.ts의 토큰 사용 권장
	•	statusColors, buttonStyles, cardStyles 등 정의됨
	•	cn() 헬퍼로 클래스 조합
	•	CSS 변수는 globals.css에 정의

커스텀 훅 규칙
	•	모달 상태: useModal() 훅 사용
	•	API 호출 (mutation): useApiMutation() 훅 사용
	•	try-catch-finally 패턴 직접 작성 대신 훅 활용

컴포넌트 분리 규칙
	•	300줄 이상 컴포넌트는 하위 폴더로 분리 검토
	•	폴더 구조: ComponentName/ 폴더에 index.ts로 내보내기
	•	예: process-status/, resource-table/, admin/

역할/권한
	•	권한 단위: 서비스 코드(serviceCode)
	•	서비스 담당자: 권한 있는 서비스 코드만 접근/액션
	•	관리자: 전체 서비스 코드 접근 + 과제 등록/삭제 + 권한 관리 + 승인/반려

설치 프로세스 (상태머신)

상태는 5단계:
	1.	WAITING_TARGET_CONFIRMATION (연동 대상 확정 대기)
	2.	WAITING_APPROVAL (승인 대기)
	3.	INSTALLING (설치 진행 중)
	4.	WAITING_CONNECTION_TEST (연결 테스트 대기)
	5.	COMPLETED (완료)

Cloud Provider: AWS, Azure, GCP, IDC, SDU (+ 수동조사 예정)

작업 방식 (토큰 절약 규칙)
	•	전체 파일 재출력 금지: 변경은 "수정된 블록/함수" 또는 "patch/diff"로만 제시
	•	한 번의 응답에서:
	•	설명은 10줄 이내
	•	코드 출력은 파일 1개(최대 150줄)만
	•	이번 작업 범위 밖 내용은 생략

스펙/문서 위치
	•	Cloud Provider별 프로세스: docs/cloud-provider-states.md
	•	API 문서:
		•	docs/api/common.md - 공통 타입, 인증, 에러
		•	docs/api/core.md - 공통 API (프로젝트, 리소스, 프로세스)
		•	docs/api/scan.md - 스캔 API (AWS/Azure/GCP 공통)
		•	docs/api/providers/aws.md
		•	docs/api/providers/azure.md
		•	docs/api/providers/gcp.md
		•	docs/api/providers/idc.md
		•	docs/api/providers/sdu.md

⸻

데이터 모델링 원칙
	•	정규화 우선: API 용도별 분리
	•	Project: 핵심 정보만 (resources, scan 정보는 별도 API)
	•	Resource: metadata로 Provider별 정보 분리 (Discriminated Union)
	•	InstallationStatus: Provider별 Union Type

⸻

API 설계 원칙
	•	페이지별 API 호출 전략 준수 (docs/api-design.md 참조)
	•	초기 로드: 필수 정보만
	•	상세/갱신: 필요시 별도 호출
	•	비동기 작업: 정교한 설계 필요 (스캔, TF 설치 등)

⸻

비동기 작업 (설계 필요)
	•	스캔: AWS/Azure/GCP - 페이지 진입 시 트리거, 5분 중복 방지
	•	TF 설치: 자동(권한O) / 수동(권한X) 분기
	•	Azure PE 승인: 서비스 담당자 수동 확인
	•	Azure VM TF: 주기적 상태 확인

⸻

TODO
	•	[ ] 비동기 작업 상태 관리 설계
	•	[ ] 에러 처리 전략 정의
	•	[ ] API 서버 구현 (Production 수준)
	•	[ ] Provider별 UI 컴포넌트 분리
