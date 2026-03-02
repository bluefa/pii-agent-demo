# AWS 설치 상태 UX 대안 정리 (Resource 중심)

> 작성일: 2026-03-02
> 목적: AWS 설치 상태를 Resource 단위로 어떻게 보여줄지 의사결정하기 위한 요구사항 정리

## 1. 배경

AWS 설치는 `AUTO`/`MANUAL` 모드가 있고, 모드와 무관하게 설치 축이 2개입니다.

- Service 측 Terraform Script (리소스 그룹 단위, N개)
- BDC 측 Terraform Script (사실상 1개)

설치 모드별 실행 주체는 아래와 같습니다.

- `AUTO`: BDC가 Service 측 Terraform Script 설치를 수행
- `MANUAL`: 서비스 측 담당자가 Service 측 Terraform Script를 직접 수행

추가 제약은 다음과 같습니다.

- Resource마다 `terraformScriptName`이 매핑됨
- Resource A, B가 같은 Service Script에 매핑될 수 있음
- BDC는 API로 `RUNNING | SUCCESS | FAIL` 상태 조회 가능
- Service 측은 특히 수동 모드에서 "설치 중"을 명시적으로 조회하기 어려움

핵심 쟁점: Resource별 설치 상태를 보여줄 때, Service 측 "진행 중" 부재를 UX에서 어떻게 다룰지.

## 2. 이번 문서의 가정

- A1. Service 측은 Script 단위 설치 결과를 완료/미완료 중심으로만 확인 가능하며, "실행 중"은 신뢰도 있게 확인하기 어려움
- A2. BDC 측은 단일 Script 상태를 `RUNNING | SUCCESS | FAIL`로 제공
- A3. Resource 화면 상태는 `terraformScriptName` 기반 파생값(derived state)
- A4. `AUTO` 모드의 Service 측 Script 실행 주체는 BDC

## 3. 공통 모델 (표시 계층)

### 3.1 설치 단위(원본 상태)

- Service Script: `NOT_COMPLETED | COMPLETED | UNKNOWN`
- BDC Script: `RUNNING | SUCCESS | FAIL | PENDING`

### 3.2 Resource 단위(파생 상태)

`resourceStatus = combine(serviceScriptStatus(terraformScriptName), bdcStatus)`

| Service Script | BDC Script | Resource 최종 표시 |
|---|---|---|
| COMPLETED | SUCCESS | 완료 |
| COMPLETED | RUNNING | BDC 적용 중 |
| COMPLETED | FAIL | 실패 (BDC) |
| COMPLETED | PENDING | BDC 대기 |
| NOT_COMPLETED | ANY | Service 설치 필요 |
| UNKNOWN | ANY | 확인 필요 |

## 4. 대안 A: 보수형 (Service는 완료 여부만 표시)

Service는 "진행 중"을 아예 노출하지 않고, 완료/미완료/확인 필요만 보여줍니다.
BDC만 `RUNNING`을 실시간으로 노출합니다.

### UX 도식도

```text
[상단 요약]
- Service Script: 2/3 완료
- BDC Script: RUNNING

[Resource 테이블]
┌──────────┬──────────────────────┬──────────────┐
│ Resource │ terraformScriptName  │ 상태         │
├──────────┼──────────────────────┼──────────────┤
│ A        │ svc-vpc-apne2        │ 완료         │
│ B        │ svc-vpc-apne2        │ 완료         │
│ C        │ svc-athena-glue      │ 설치 필요    │
│ D        │ svc-athena-glue      │ 설치 필요    │
└──────────┴──────────────────────┴──────────────┘

[BDC 공통 배너]
"BDC 적용이 진행 중입니다. 완료 후 리소스 상태가 최종 확정됩니다."
```

### 장점

- 오표시 리스크가 가장 낮음
- 구현 단순, 운영 해석이 쉬움

### 단점

- 사용자는 Service가 실제로 진행 중인지 체감하기 어려움
- 설치 지연 시 "멈춤"처럼 보일 수 있음

## 5. 대안 B: 추정형 (Service 진행 중을 UX에서 추정)

사용자 액션(설치 시작 클릭, 체크 실행 시각 등)을 근거로 Service "진행 중(추정)"을 표시합니다.

### UX 도식도

```text
[Service Script 카드]
svc-vpc-apne2     : 진행 중(추정)
svc-athena-glue   : 설치 필요

[Resource 리스트]
A, B : 진행 중(추정)
C, D : 설치 필요

(우측 보조 문구)
"진행 중(추정)은 실제 클라우드 상태와 최대 N분 차이가 날 수 있습니다."
```

### 장점

- 사용자 체감상 진행 흐름이 부드러움
- "아무 변화 없음" 인지 문제 완화

### 단점

- 실제와 불일치 가능성 존재
- 장애 시 원인 파악이 늦어질 수 있음

## 6. 대안 C: 이중 레이어형 (권장)

상단에 "설치 단위(사실)"를, 하단에 "Resource 단위(파생)"를 분리해 동시에 보여줍니다.
Service의 불확실성은 숨기지 않고 `확인 필요`로 명시합니다.

### UX 도식도

```text
Layer 1. 설치 단위 보드 (Truth)
┌──────────────────────────────────────────────┐
│ Service Scripts                              │
│ - svc-vpc-apne2    : COMPLETED              │
│ - svc-athena-glue  : UNKNOWN (수동 설치 확인 필요) │
│ BDC Script         : RUNNING                │
└──────────────────────────────────────────────┘

                      | terraformScriptName 매핑
                      v

Layer 2. Resource 보드 (Derived)
┌──────────┬──────────────────────┬──────────────────────┐
│ Resource │ script               │ 상태                  │
├──────────┼──────────────────────┼──────────────────────┤
│ A        │ svc-vpc-apne2        │ BDC 적용 중           │
│ B        │ svc-vpc-apne2        │ BDC 적용 중           │
│ C        │ svc-athena-glue      │ 확인 필요             │
│ D        │ svc-athena-glue      │ 확인 필요             │
└──────────┴──────────────────────┴──────────────────────┘
```

### 장점

- 사실(원본)과 파생(리소스)을 분리해 해석 충돌 최소화
- Resource 관점 요구를 충족하면서도 오표시를 줄임
- Script-Resource N:1 매핑이 자연스럽게 설명됨

### 단점

- UI 영역이 2단으로 늘어남
- 초기 학습 비용이 약간 증가

## 7. 권장안 상세 (대안 C)

### 7.1 기본 화면 구조

- 섹션 1: 설치 단위 보드
- 섹션 2: Resource 설치 현황 테이블
- 섹션 3: "확인 필요" 항목 전용 액션 (`설치 상태 다시 확인`)

### 7.2 상태 배지 규칙

- 완료: `완료`
- 진행: `BDC 적용 중`
- 실패: `실패(BDC)`
- 불확실: `확인 필요`

### 7.3 사용자 메시지 규칙

- Service `UNKNOWN` 시 안내 문구:
  - "수동 설치 특성상 실행 중 여부를 실시간 조회할 수 없습니다. 설치 완료 후 상태 확인을 실행해주세요."
- BDC `RUNNING` 시 안내 문구:
  - "BDC 적용 중입니다. 완료 시 리소스 상태가 자동 갱신됩니다."

## 8. MVP 구현 범위 (문서 기준)

1. API 응답 상태를 UI 표시 상태로 매핑하는 표준 테이블 확정
2. Resource 테이블에 `terraformScriptName` 컬럼/필터 추가
3. 상단 "설치 단위 보드" 추가
4. `UNKNOWN` 전용 UX 카피 및 재확인 액션 정의

## 9. 확정된 전제

1. `AUTO` 모드에서 Service 측 Terraform Script 실행 주체는 BDC
2. Service 상태는 실패를 안정적으로 조회하지 않고 완료/미완료 중심으로 표현

## 10. 확인 필요 항목

1. BDC 실패가 특정 Resource에만 영향 주는지, 전체 공통 실패인지
