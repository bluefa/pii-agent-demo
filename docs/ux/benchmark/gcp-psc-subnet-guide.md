# GCP Step 4 — PSC용 proxy subnet 생성 명령 안내 (2026-09-14)

오너 결정 기록. GCP Cloud SQL 연동은 Region 마다 Regional Managed Proxy Subnet 이 있어야
PSC 를 만들 수 있고, 그 subnet 은 서비스 측이 만든다. 지금까지는 담당자가 메일로 명령
템플릿을 받아 값을 손으로 채웠다. 이제 화면이 값을 채운 명령을 보여 준다.

## 어디에

| 화면 | 자리 | 상태 |
|---|---|---|
| 사용자 Step 4 설치 카드 | 「PSC용 Subnet 생성」 패널, 리소스 표 **위** | 첫 Region 펼침 |
| admin 「인프라 작업」 탭 설치 상태 헤드 | 「PSC용 Subnet 생성」 행 **아래**, 그 행이 완료 전일 때만 | 전부 접힘 |

같은 `PscSubnetGuide` 블록을 두 화면이 그린다. 데이터도 같은 훅(`usePscSubnetTargets`)이
확정 리소스 행(confirmed-integration `resource_infos`) 에서 읽는다 (09-16 전환, 아래 「출처 전환」).

## 무엇을

- **Region 당 아코디언 하나.** proxy subnet 은 (호스트 VPC, Region) 조합당 하나이지
  리소스마다가 아니다. 헤더 줄에 Region · subnet 이름 · Cloud SQL N대 · 복사 버튼.
  명령만 접히고 헤더 줄은 남는다. 복사는 접힌 채로도 된다.
- **명령 첫 줄은 `#` 주석**: 어느 호스트 프로젝트의 어느 VPC 에 어느 Region 의 subnet 을
  만드는지. 복사에도 포함된다.
- **채우는 값**: `--project` = host_project, `--network` = host_network, `--region` = region
  (모두 확정 행 최상위 `host_project` / `host_network` / `database_region`). subnet 이름 접미는 Region 단어 첫 글자 + 숫자
  (asia-northeast3 → an3).
- **CIDR 은 자리표시자 `{CIDR /24}`.** 화면이 대역을 정하면 틀린 방화벽을 열게 된다.
- **Cloud SQL 행만 센다.** BigQuery 는 PSC 가 없으니 subnet 도 없다.
- **아직 만들어야 하는 Region 만 보인다** (오너 09-16: "수행해야 되는 것만 보여주자. 그게
  가이드잖아"). installation-status 의 리소스별 `service_side_subnet_creation` 이 전부
  COMPLETED/SKIP 인 Region 은 아코디언에서 빠진다. 상태 응답 전에는 아무것도 숨기지 않는다.
  서울 완료 · us-central1 진행중이면 us-central1 하나만 남는다 (목 1301 이 이 경우).
- **여백은 위 좁게 아래 넓게**: 펼친 명령 위 8px / 아래 16px, 블록 사이 8px.
- **사용자 화면의 리소스 표는 접어 둔다** (「연동 대상 리소스 표 · N건」 한 줄). 당장은
  필요 없는 정보.

## 어투

- 사용자: "아래 명령을 호스트 프로젝트에서 Region마다 한 번 실행해주세요."
- admin: "서비스 측 담당자에게 … 만들어 달라고 요청해주세요." 운영자는 실행하지 않고
  건넨다. admin 은 루트 언어와 무관하게 한국어.

## 기각·보류

- 행 구조를 지어낸 첫 시안 — 실제 DOM 을 가져와 다시 그렸다.
- 비어 오면 두 화면 다 안내 없이 단계 설명만 남는다.

## 출처 전환 (2026-09-16)

- 09-14 구현은 승인 행 `metadata.host_project / host_network` 를 읽었다 — 당시 swagger 가
  두 필드를 `TargetSourceResourceMetadataDto` 에만 선언해서다.
- 실 BE 는 승인 행에 채우지 않고 **확정 응답 `resource_infos` 행 최상위**에 채운다
  (오너 09-16). 훅이 `getConfirmedIntegration` 을 읽도록 바꿨고, admin 도 같은 훅이라 같이 바뀐다.
- `ResourceConfigDto` 에는 아직 swagger 선언이 없다 — BE 선행 필드. 다음 swagger 드롭에서
  들어오는지 확인한다 (`lib/types.ts` `ConfirmedIntegrationResourceInfo` 주석).

## 목

- 1301 (GCP-006): Cloud SQL 2대 — asia-northeast3 는 subnet 완료, us-central1 은 진행중 → 안내는 us-central1 하나.
- 1302 (GCP-007): BigQuery 만 — 세 단계 해당 없음, 안내 없음.
