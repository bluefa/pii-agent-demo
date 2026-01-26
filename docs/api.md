공통
	•	Base URL: /api
	•	인증: 실제 구현 없음 (Mock 사용자 고정)
	•	권한:
	•	SERVICE_MANAGER: 본인에게 권한이 있는 서비스 코드만 접근 가능
	•	ADMIN: 모든 서비스 코드 접근 가능 + 관리자 기능 수행 가능
	•	Response 에러 포맷(권장)
	•	{ error: string, message: string }

⸻

데이터 모델(응답 요약)

Project (과제)
	•	id: string
	•	projectCode: string (예: N-IRP-001)
	•	name: string (과제명)
	•	description: string (과제 상세 설명)
	•	serviceCode: string (예: SERVICE-A)
	•	cloudProvider: 'AWS' | 'IDC'
	•	processStatus: 1 | 2 | 3 | 4 | 5
	•	1: 연동 대상 확정 대기
	•	2: 승인 대기
	•	3: 설치 진행 중
	•	4: 연결 테스트 필요
	•	5: 설치 완료
	•	resources: Resource[]
	•	terraformState: TerraformState
	•	createdAt: string (ISO)
	•	updatedAt: string (ISO)
	•	piiAgentInstalled?: boolean (최초 PII Agent 설치 확정 여부)

Resource (리소스)

기본 필드 (기존 호환)
	•	id: string
	•	type: string (AWS 타입을 문자열로 표현하는 UI용 값)
	•	resourceId: string (AWS ARN 형태 문자열 가능)
	•	connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'NEW'
	•	isSelected: boolean (연동 대상 선택 여부)

확장 필드 (AWS/상태 표현용)
	•	awsType?: 'RDS' | 'RDS_CLUSTER' | 'DYNAMODB' | 'ATHENA' | 'REDSHIFT'
	•	region?: string (예: ap-northeast-2)
	•	lifecycleStatus: 'DISCOVERED' | 'TARGET' | 'PENDING_APPROVAL' | 'INSTALLING' | 'READY_TO_TEST' | 'ACTIVE'
	•	DISCOVERED: 스캔됨(기본)
	•	TARGET: 연동 대상으로 선택됨
	•	PENDING_APPROVAL: 승인 요청 진행중
	•	INSTALLING: 설치 진행중
	•	READY_TO_TEST: 설치 완료, 연결 테스트 필요
	•	ACTIVE: 설치/연결 완료
	•	isNew?: boolean (UI에서 NEW 표시 고정용)
	•	note?: string (비고)

TerraformState (TF 설치 상태)
	•	serviceTf: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'
	•	bdcCommonTf: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'
	•	bdcServiceTf: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'

⸻

인증/권한

GET /api/user/me

현재 사용자 정보 반환

응답 예시:
	•	{ id, name, email, role, serviceCodePermissions }

GET /api/user/services

사용자가 접근 가능한 서비스 코드 목록 반환
	•	ADMIN은 전체 서비스 코드 반환
	•	SERVICE_MANAGER는 본인 권한 서비스 코드만 반환

⸻

과제(Project)

GET /api/services/{serviceCode}/projects

특정 서비스의 과제 목록 반환

권한:
	•	ADMIN: 모든 서비스코드 가능
	•	SERVICE_MANAGER: 본인 권한 서비스코드만 가능

GET /api/projects/{projectId}

과제 상세 반환
	•	Project 전체 구조 + resources, terraformState 포함

POST /api/projects (ADMIN)

과제 등록

요청 바디 예시:
	•	projectCode
	•	name
	•	description
	•	serviceCode
	•	cloudProvider

응답:
	•	{ success: true, project }

DELETE /api/projects/{projectId} (ADMIN)

과제 삭제

응답:
	•	{ success: true }

⸻

PII Agent 프로세스

POST /api/projects/{projectId}/confirm-targets

연동 대상 확정 (서비스 담당자 액션)

프로세스 전이:
	•	1 → 2
	•	5 → 2 (재설치 플로우)

요청 바디:
	•	{ resourceIds: string[] } (선택할 리소스 id 목록)

Side Effect (리소스 상태 변경):
	•	선택된 리소스:
	•	isSelected = true
	•	lifecycleStatus = 'PENDING_APPROVAL'
	•	선택되지 않은 리소스:
	•	isSelected = false
	•	lifecycleStatus = 'DISCOVERED'

응답:
	•	{ success: true, project }

⸻

POST /api/projects/{projectId}/approve (ADMIN)

관리자 승인

프로세스 전이:
	•	2 → 3

Side Effect (리소스 상태 변경):
	•	선택된 리소스:
	•	lifecycleStatus = 'INSTALLING'

응답:
	•	{ success: true, project }

⸻

POST /api/projects/{projectId}/reject (ADMIN)

관리자 반려

프로세스 전이:
	•	2 → 1

요청 바디(선택):
	•	{ reason?: string }

Side Effect (리소스 상태 변경):
	•	모든 리소스:
	•	isSelected = false
	•	lifecycleStatus = 'DISCOVERED'
	•	note에 반려 사유를 기록할 수 있음(구현체에 따라)

응답:
	•	{ success: true, project, reason }

⸻

POST /api/projects/{projectId}/complete-installation (ADMIN)

설치 완료 처리 (관리자 액션)

프로세스 전이:
	•	3 → 4

Side Effect (리소스 상태 변경):
	•	INSTALLING 상태 리소스:
	•	lifecycleStatus = 'READY_TO_TEST'
	•	terraformState:
	•	serviceTf = 'COMPLETED' (AWS만)
	•	bdcTf = 'COMPLETED'

응답:
	•	{ success: true, project }

⸻

POST /api/projects/{projectId}/confirm-pii-agent (ADMIN)

PII Agent 설치 확정 (관리자 액션, 최초 1회)

프로세스 전이:
	•	4 → 5

Side Effect:
	•	READY_TO_TEST 상태 리소스:
	•	lifecycleStatus = 'ACTIVE'
	•	connectionStatus = 'CONNECTED'
	•	프로젝트:
	•	piiAgentInstalled = true

응답:
	•	{ success: true, project }

⸻

POST /api/projects/{projectId}/test-connection

연결 테스트 (서비스 담당자 액션)

프로세스 전이:
	•	4 → 5

Side Effect (리소스 상태 변경):
	•	선택된 리소스:
	•	connectionStatus = 'CONNECTED'
	•	lifecycleStatus = 'ACTIVE'
	•	isNew = false 처리 가능

응답:
	•	{ success: true, project }

⸻

리소스/TF

GET /api/projects/{projectId}/resources

리소스 목록 반환
	•	{ resources: Resource[] }

GET /api/projects/{projectId}/terraform-status

TF 설치 상태 반환
	•	{ terraformState } 또는 { steps } 형태로 확장 가능
(현재 구현은 terraformState 필드 기반)

POST /api/projects/{projectId}/scan (AWS only)

리소스 스캔 재실행

조건:
	•	cloudProvider === 'AWS'에서만 지원
	•	IDC는 NOT_SUPPORTED 반환

동작(데모):
	•	일정 확률로 신규 리소스를 발견하여 resources에 추가
	•	신규 리소스는 보통 아래 값으로 생성됨:
	•	connectionStatus = 'NEW'
	•	isSelected = false
	•	lifecycleStatus = 'DISCOVERED'
	•	resourceId는 AWS ARN 형태 문자열 가능

응답:
	•	{ success: true, newResourcesFound: number, resources: Resource[] }

⸻

권한 관리 (ADMIN)

GET /api/services/{serviceCode}/permissions

권한 보유 사용자 목록 조회

응답:
	•	{ users: User[] }

POST /api/services/{serviceCode}/permissions

사용자 권한 추가

요청 바디 예시:
	•	{ userId: string } 또는 { email: string }

응답:
	•	{ success: true }

DELETE /api/services/{serviceCode}/permissions/{userId}

사용자 권한 제거

응답:
	•	{ success: true }

⸻

개발 편의

GET/POST /api/dev/switch-user

데모에서 사용자 전환

응답:
	•	현재 사용자 + 전환 가능한 사용자 목록을 반환하거나,
	•	POST로 특정 userId를 넘겨 current user를 변경하는 방식