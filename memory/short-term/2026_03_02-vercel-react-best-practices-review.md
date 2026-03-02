# Vercel React Best Practices 적용 검토 (AWS 설치 상태 UI)

## 1. 검토 범위
- `app/components/features/process-status/aws/AwsInstallationInline.tsx`
- `app/components/features/ProcessStatusCard.tsx`

## 2. 참조 Skill
- 원본: `/Users/study/pii-agent-demo/.claude/skills/vercel-react-best-practices`
- 기준 문서: `.agents/skills/vercel-react-best-practices/SKILL.md`

적용한 핵심 규칙:
- `rerender-dependencies`
- `rerender-use-ref-transient-values`

## 3. 발견된 문제

### 문제 A: 불안정한 callback prop으로 인한 effect 재실행 루프
- `AwsInstallationInline`의 `fetchStatus`가 `onInstallComplete`를 dependency로 가지며,
- 부모(`ProcessStatusCard`)에서 `onInstallComplete={refreshProject}`를 매 렌더마다 새 함수로 전달.
- 결과적으로 `useEffect([fetchStatus])`가 반복 실행되면서 `/installation-status` API가 과호출됨.

영향:
- 설치 상태가 과도하게 변하는 것처럼 보임
- mock 상태가 시간 기반 전이이므로 사용자가 "갑자기 완료"로 체감
- 브라우저/서버 모두 불필요한 부하 증가

### 문제 B: 완료 콜백 중복 호출 가능성
- 설치 완료 상태에서 재조회가 발생하면 `onInstallComplete`가 반복 호출될 수 있음
- `/target-sources/{id}` 재조회가 중복 트리거될 수 있음

## 4. 구현한 개선 사항

### 개선 1: 부모 callback 안정화
- `ProcessStatusCard`의 `refreshProject`를 `useCallback`으로 메모이제이션
- dependency: `[onProjectUpdate, project.targetSourceId]`

### 개선 2: 완료 콜백 1회 보장
- `AwsInstallationInline`에 `completionNotifiedRef` 추가
- 설치 완료 감지 시 최초 1회만 `onInstallComplete` 호출
- `targetSourceId` 변경 시 ref 초기화

### 개선 3: effect dependency 최소화
- `ProcessStatusCard` polling effect에서 사용하지 않는 `project.id` dependency 제거
- `AwsInstallationInline` 초기 조회 effect dependency를 `[fetchStatus]`로 정리
- 목적: 불필요한 effect 재실행/interval 재설정 방지

## 5. 기대 효과
- 설치 상태 API 과호출 제거
- React 렌더 루프/불필요 effect 재실행 방지
- 완료 시점 프로젝트 재조회 1회 보장
- 사용자 체감상 상태 점프/깜빡임 완화

## 6. 비고
- 현재 mock 설치 상태는 `getInstallationStatus()` 호출 시 시간 기반으로 상태를 업데이트함.
- 따라서 UI 폴링/재조회가 많을수록 상태 변화가 자주 관측될 수 있음.
- 이번 수정은 "불필요한 재조회"를 제거하는 목적이며, mock의 시간 기반 전이 정책 자체는 변경하지 않음.
