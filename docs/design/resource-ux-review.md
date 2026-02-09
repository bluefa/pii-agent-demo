# 리소스 UX 개선 — 코드 리뷰 및 기술 노트

> PR #60 (merged), #62, #63 관련

---

## 1. 알려진 이슈 (후속 작업 필요)

### 1.1 VmDatabaseConfigPanel — raw 색상 클래스 (CLAUDE.md 위반)

`VmDatabaseConfigPanel.tsx`에 `bg-amber-50`, `border-slate-200`, `text-blue-600` 등 raw 색상 50+ 곳 사용 중.
`theme.ts` 토큰(`statusColors`, `textColors`, `bgColors`)으로 전환 필요.

**영향:** 테마 변경 시 이 컴포넌트만 스타일 불일치 발생.

### 1.2 Tailwind 동적 클래스 — JIT 미인식

```tsx
// ResourceRow.tsx, ClusterRow.tsx 등에서 사용 중
`hover:${bgColors.muted}`    // hover:bg-gray-50 으로 풀려야 하지만 JIT가 인식 못할 수 있음
`text-${colors.primary.base}` // 동적 문자열은 Tailwind purge 대상에서 제외됨
```

**현재 동작하는 이유:** `tailwind.config`에 safelist이 있거나 빌드 시점에 해당 클래스가 다른 파일에서 정적으로 사용되어 포함됨.
**리스크:** safelist 없이 사용하지 않는 클래스가 purge되면 스타일 깨짐.

---

## 2. 설계 결정 및 주의사항

### 2.1 ClusterRow — Instance 선택은 로컬 state

`ClusterRow`는 `clusterInstances[].isSelected`를 **내부 `useState`**로 관리한다.
상위 컴포넌트(`ResourceTable`)에 Instance 단위 선택 콜백이 없기 때문.

```
ResourceTable → onCheckboxChange(clusterId, checked)  // Cluster 전체 선택/해제만
ClusterRow   → instanceSelections (local state)        // Instance 개별 선택
```

**주의:**
- Cluster 체크 해제 시 Instance 선택이 자동 초기화됨
- `selectedIds` prop이 외부에서 변경되면 `instanceSelections`와 불일치 가능
- 서버 저장 기능 구현 시 `onInstanceToggle` 콜백을 상위로 올려야 함

### 2.2 VM 설정 패널 — 체크 시 자동 펼침

`ResourceRow`에서 VM 체크박스 선택 시 `onVmConfigToggle`을 자동 호출하여 설정 패널이 즉시 펼쳐진다.

```
체크 → onCheckboxChange + onVmConfigToggle(resourceId)  // 동시 호출
해제 → onCheckboxChange + onVmConfigToggle(null)         // 패널 닫기
```

**주의:**
- `expandedVmId`가 단일 값이므로 동시에 1개 VM만 패널 열림
- 다른 VM 체크 시 이전 패널이 자동으로 닫힘 (의도된 동작)

### 2.3 AWS vs 비-AWS 테이블 칼럼 구조 차이

| 칼럼 | AWS | Azure/기타 |
|------|-----|-----------|
| 인스턴스 타입 | 없음 (그룹 헤더에 표시) | 있음 |
| 리소스 ID | 있음 | 있음 |
| 데이터베이스 | 있음 (텍스트만) | 있음 (텍스트만) |

- `colSpan` 계산: AWS = 3 + 동적, 비-AWS = 4 + 동적
- `ResourceRow`에서 `isAWS` 조건으로 인스턴스 타입 `<td>` 렌더링 분기
- `ResourceTypeGroup`은 AWS 전용, `ClusterRow`는 RDS_CLUSTER 전용

---

## 3. 성능 개선 포인트 (선택)

| 위치 | 현재 | 개선안 |
|------|------|--------|
| `InstancePanel` — `sortInstances()` | 매 렌더마다 실행 | `useMemo(sorted, [instances])` |
| `ClusterRow` — `instances` 배열 매핑 | 매 렌더마다 새 배열 | `useMemo` 캐싱 |
| `ResourceTable` — `groupByAwsType()` | `useMemo` 사용 중 (OK) | — |

현재 리소스 수가 수백 개 이하이므로 체감 성능 영향은 미미하나, 데이터 규모 증가 시 개선 권장.

---

## 4. 파일 구조

```
resource-table/
  index.ts                    # 모든 컴포넌트 re-export
  ResourceRow.tsx             # 일반 리소스 행 (AWS/Azure/기타 공통)
  ResourceTypeGroup.tsx       # AWS 타입별 그룹 (RDS, EC2 등)
  ClusterRow.tsx              # RDS_CLUSTER 전용 행 (NEW)
  InstancePanel.tsx           # Cluster 하위 Instance 서브테이블 (NEW)
  VmDatabaseConfigPanel.tsx   # EC2/Azure VM DB 설정 패널
  NonTargetResourceSection.tsx # 연동 제외 리소스 접이식 섹션
  ConnectionIndicator.tsx     # 연결 상태 인디케이터
  StatusIcon.tsx              # 상태 아이콘 (선택됨, 신규, 끊김 등)
  RegionGroup.tsx             # 리전별 그룹 (미사용, 레거시)
```
