CLAUDE.md (Token-Saver)

PII Agent 관리 시스템 (Demo)

목표
	•	PM/개발팀 소통용 데모 웹페이지
	•	실제 백엔드 없음: Mock 데이터/Mock API로만 동작
	•	데스크탑 전용, 한국어 UI

기술 스택
	•	Next.js 14 (App Router)
	•	TypeScript
	•	TailwindCSS
	•	Mock API: MSW 또는 Next Route Handlers 중 하나로 구현 (프로젝트 현재 구현 방식을 따름)
	•	상태 관리: React useState만 사용 (외부 상태 라이브러리 금지)

폴더 구조 (고정)

	•	app/ : 페이지(App Router)
	•	page.tsx : 서비스 코드 목록 + 과제 목록(2-pane)
	•	projects/[id]/ : 과제 상세
	•	admin/ : 관리자 화면
	•	hooks/ : 커스텀 훅 (useModal, useApiMutation, useAsync)
	•	lib/api.ts : API 호출 함수
	•	components/
	•	ui/ : 기본 UI (Button, Badge, Modal, Card, Table, LoadingSpinner 등)
	•	features/ : 도메인/비즈니스 컴포넌트
		•	대형 컴포넌트는 하위 폴더로 분리 (process-status/, resource-table/, admin/)
	•	mocks/ : MSW를 쓰는 경우만
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

역할/권한 (요약)
	•	권한 단위: 서비스 코드(serviceCode)
	•	서비스 담당자: 권한 있는 서비스 코드만 접근/액션
	•	관리자: 전체 서비스 코드 접근 + 과제 등록/삭제 + 권한 관리 + 승인/반려

설치 프로세스 (상태머신)

상태는 5단계 정수 enum으로 관리:
	1.	WAITING_TARGET_CONFIRMATION
	2.	WAITING_APPROVAL
	3.	INSTALLING
	4.	WAITING_CONNECTION_TEST
	5.	INSTALLATION_COMPLETE

상태 전이는 단순 데모용으로 구현(정교한 에러 처리 불필요).

작업 방식 (토큰 절약 규칙)
	•	전체 파일 재출력 금지: 변경은 “수정된 블록/함수” 또는 “patch/diff”로만 제시
	•	한 번의 응답에서:
	•	설명은 10줄 이내
	•	코드 출력은 파일 1개(최대 150줄)만
	•	이번 작업 범위 밖 내용은 생략
	•	긴 요구사항 전문은 docs/spec.md에 있으며, 필요한 섹션만 참조한다

스펙/문서 위치
	•	전체 요구사항 원문: docs/spec.md
	•	진행상태/현재 이슈: docs/state.md
	•	API 요약(엔드포인트 표): docs/api.md
	•	리팩토링 문서: docs/refactoring/*.md (phase1~5)

⸻

데이터 모델링 기본 원칙
	•	Mock은 단순화 우선: 복잡한 정합성/에러케이스 최소화
	•	“데모 화면에서 보기 좋은 데이터”가 목적
	•	Project가 화면 표시/상태/리소스/TF 상태 등 대부분의 정보를 포함해도 됨

⸻

개발 중 자주 하는 작업
	•	API: 엔드포인트 1~2개 단위로 구현/수정
	•	UI: 페이지 단위가 아니라 “섹션 단위”(예: StepIndicator, ResourceTable)로 구현/수정
	•	상태 변경: mock 데이터 업데이트 함수로 일관되게 처리

⸻

다음 액션 버튼 규칙(요약)
	•	1단계: "PII Agent 연동 대상 확정"
	•	2단계: (관리자) 승인/반려
	•	4단계: "Test Connection"
	•	AWS만 "스캔 재실행" 표시, IDC는 숨김

⸻

TODO (향후 작업)

클라우드별 상태 분리 (ProjectDetail 리팩토링)
	•	현재: AWS/IDC 2개 클라우드만 지원, 조건문으로 분기
	•	문제: GCP/Azure 추가 시 모든 파일에서 분기문 증가
	•	해결 방향:
	•	CloudProvider별 프로세스 상태 판단 로직 분리
	•	CloudProvider별 리소스 상태/표시 방식 분리
	•	전략 패턴 또는 Provider별 설정 객체 도입
	•	영향 범위:
	•	ProjectDetail.tsx (메인 페이지)
	•	ProcessStatusCard (Terraform 상태, 설치 진행)
	•	ResourceTable (리전 그룹핑, 아이콘, Credential 타입)
	•	ConnectionTestPanel (연결 테스트 검증 로직)