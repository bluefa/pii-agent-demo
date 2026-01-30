# 관리자 페이지 개발 문서

## 개요

관리자 페이지는 서비스 코드별 과제 관리 및 권한 관리를 통합한 대시보드입니다.
서비스 상세 페이지 중심의 통합 UI로 재설계되었으며, 프로덕션 운영 페이지 느낌의 디자인을 적용했습니다.

---

## UX 재설계 (Phase 1)

### 목표
서비스 상세 페이지 중심의 통합 UI로 재구성

### 주요 변경사항

#### 1. 레이아웃 변경
- **기존**: 헤더에 과제 등록/권한 관리 버튼 + 2-pane (서비스 리스트 | 과제 목록)
- **변경**: 헤더 간소화 + 2-pane (서비스 리스트 | 서비스 상세 뷰)

#### 2. 서비스 상세 뷰 구성 (오른쪽 pane)
- **헤더**: 서비스 코드 + 이름
- **권한 유저 섹션**:
  - 유저 목록을 아이콘 뱃지 형태로 표시 (테이블 X)
  - 각 유저: 아바타 아이콘 + 이름 + 휴지통 아이콘(삭제)
  - 유저 추가: input + 추가 버튼 (인라인)
- **과제 섹션**:
  - 과제 등록 버튼 (섹션 헤더 우측)
  - 과제 목록 테이블

#### 3. 컴포넌트 변경
- **삭제**: `PermissionManageModal.tsx`
- **수정**: `AdminDashboard.tsx` (오른쪽 pane 완전 재구성)
- **유지**: `ProjectCreateModal.tsx` (selectedServiceCode prop 적용)

---

## UI 디자인 개선 (Phase 2)

### 목표
데모 느낌에서 벗어나 프로덕션 운영 페이지 느낌의 디자인으로 개선

### 개선 영역

#### 1. 헤더
- **로고 아이콘 추가**: 파란색 배경의 shield 아이콘
- **타이틀**: "PII Agent 관리자"
- **프로필 영역**: 관리자 라벨 + 아바타 아이콘
- **스타일**: border-b 대신 shadow-sm 사용

#### 2. 사이드바 (서비스 리스트)
- **섹션 헤더**: 대문자 + tracking-wide + 작은 폰트 (uppercase text-xs)
- **선택 상태**: 파란색 배경 + 왼쪽 border 강조
- **프로젝트 카운트 뱃지**: 선택된 서비스의 과제 개수 표시
- **호버 효과**: 부드러운 transition 추가
- **스타일**: border-r 대신 shadow-sm 사용

#### 3. 권한 유저 섹션
- **섹션 헤더**: 대문자 + tracking-wide 스타일
- **아이콘**: 이모지 대신 SVG 아이콘 사용
- **유저 카드**:
  - 흰색 배경 + 테두리
  - 호버 시 그림자 효과
  - 아바타 아이콘 + 이름 + 삭제 버튼
- **빈 상태**: 아이콘 + 안내 메시지
- **입력 폼**: input + 버튼 인라인 배치

#### 4. 과제 섹션
- **로딩 상태**: 회전하는 스피너 애니메이션
- **빈 상태**:
  - 아이콘 + 안내 메시지
  - "과제 등록 버튼을 클릭하여 새 과제를 추가하세요" 가이드
- **테이블 헤더**: 대문자 + 작은 폰트
- **테이블 행**:
  - 호버 시 배경색 변경
  - group 스타일로 행 전체 호버 효과
- **뱃지**: rounded-full 스타일

#### 5. 메인 컨텐츠 영역
- **배경**: bg-gray-50/50 (미묘한 회색 배경)
- **서비스 미선택 상태**: 아이콘 + 안내 메시지
- **서비스 헤더**: 서비스 코드 뱃지 + 이름

#### 6. Button 컴포넌트
- **그림자**: primary/danger 버튼에 shadow-sm hover:shadow 추가
- **Secondary 버튼**: 흰색 배경 + 테두리
- **Border radius**: rounded-lg
- **Transition**: transition-all duration-150

---

## 테이블 구조 (과제 목록)

```
[Cloud Logo] | 과제 코드 | 설명 | 상태 | 배지
```

### 컬럼 설명
1. **Cloud Provider**: AWS/Azure/GCP/IDC/SDU 로고 아이콘
2. **과제 코드**: 클릭 가능한 링크
3. **설명**: 과제 설명 텍스트
4. **상태**: ProcessStatus에 따른 텍스트 표시 (문자열 enum)
5. **배지**:
   - NEW 라벨 (파란색) - 신규 리소스 존재
   - DISCONNECTED 라벨 (빨간색) - 연결 끊김

---

## 수정된 파일

### 1. `app/components/features/AdminDashboard.tsx`
- 헤더 재구성 (로고, 프로필 추가)
- 사이드바 스타일 개선 (선택 상태, 호버 효과)
- 오른쪽 pane 완전 재구성:
  - 권한 유저 섹션 (아이콘 뱃지 + 인라인 추가)
  - 과제 섹션 (과제 등록 버튼 + 개선된 테이블)
- 빈 상태/로딩 상태 개선
- SVG 아이콘 사용
- 상태 추가: permissions (User[])
- useEffect 추가: selectedService 변경 시 permissions fetch

### 2. `app/components/features/PermissionManageModal.tsx`
- **삭제됨**

### 3. `app/components/ui/Button.tsx`
- 그림자 효과 추가
- Secondary 버튼 스타일 변경
- Border radius 변경 (rounded → rounded-lg)
- Transition 개선 (transition-colors → transition-all duration-150)

### 4. `app/components/features/ProjectCreateModal.tsx`
- selectedServiceCode, serviceName prop 사용
- 서비스 선택 없이 과제 등록 가능하도록 수정

---

## API 엔드포인트 (Mock)

### 권한 관리
- `GET /api/services/:serviceCode/permissions` - 서비스별 권한 유저 목록 조회
- `POST /api/services/:serviceCode/permissions` - 권한 추가
- `DELETE /api/services/:serviceCode/permissions/:userId` - 권한 삭제

### 과제 관리
- `GET /api/services/:serviceCode/projects` - 서비스별 과제 목록 조회
- `POST /api/projects` - 과제 등록

---

## 주요 기능

### 1. 서비스 선택
- 사이드바에서 서비스 선택
- 선택된 서비스의 권한 유저 및 과제 목록 자동 로드

### 2. 권한 관리
- 유저 목록 표시 (아이콘 뱃지 형태)
- 유저 추가: userId 입력 후 추가 버튼 클릭
- 유저 삭제: 휴지통 아이콘 클릭
- 빈 상태 처리

### 3. 과제 관리
- 과제 목록 테이블 표시
- 과제 등록: 과제 등록 버튼 클릭 → 모달
- 과제 코드 클릭 → 과제 상세 페이지 이동
- 로딩/빈 상태 처리

---

## 디자인 원칙

### 컬러 사용
- **연결됨/완료**: green-500
- **끊김/에러**: red-500
- **신규**: blue-500
- **진행중**: orange-500
- **대기중**: gray-400

### 스타일 원칙
- **깊이**: border 대신 shadow 사용
- **계층**: 대문자 섹션 헤더로 시각적 계층 구분
- **아이콘**: 이모지 대신 SVG 아이콘
- **인터랙션**: 호버 효과, 부드러운 transition
- **상태**: 로딩/빈 상태에 아이콘과 안내 메시지 제공

---

## 개발 완료 상태

✅ UX 재설계 완료
✅ UI 디자인 개선 완료
✅ Mock API 연동 완료
✅ 권한 관리 기능 구현 완료
✅ 과제 관리 기능 구현 완료
