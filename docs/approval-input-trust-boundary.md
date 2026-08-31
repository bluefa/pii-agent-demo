# 승인 요청 입력의 신뢰 경계 (Step 1)

> 대상: `POST /api/v1/target-sources/{id}/approval-requests`
> 코드: `lib/approval-selection.ts`(모양) · `app/api/_lib/approval-input.ts`(판정)

## 왜 이 문서가 있나

Step 1 의 승인 요청은 브라우저가 만든 객체를 그대로 상류로 넘겼다. 계약 스키마가
`.partial().passthrough()` 라 검증이 사실상 통과였고, 그래서 클라이언트가 리소스의
이름·타입·리전·DB 타입·RDS 멤버 목록까지 **주장**할 수 있었다. 스캔이 찾은 적 없는
리소스를, 스캔이 본 적 없는 속성으로 연동 대상에 밀어 넣을 수 있다는 뜻이다.

프론트에 "검증"을 넣어 막는 문제가 아니다. 브라우저는 신뢰 경계 바깥이라 거기서
무엇을 검사해도 라우트를 직접 때리면 그만이다. 대신 **페이로드에서 권한을 뺏는다** —
클라이언트가 보내는 값이 *사실 주장*이 아니라 *서버가 이미 가진 것에 대한 포인터*가
되게 만든다.

## 결정 사항

### D1. 좁히는 것은 브라우저↔프론트 서버 경계뿐이다

swagger 는 **Next↔BFF** 를 규정하고, **브라우저↔Next** 는 우리 것이다. 라우트가
브라우저에게서 덜 받고, 재조회해서, 상류에는 계약 그대로 내보낸다.

**BFF API 는 바뀌지 않는다.** 상류로 나가는 본문은 `ApprovalRequestInputDto` 그대로다.

### D2. 갈래는 셋이고, 막을 수 있는 깊이가 서로 다르다

| 갈래 | 권위 소스 | 서버가 하는 일 | 차단 |
|---|---|---|---|
| **선택형** (스캔이 찾은 클라우드 리소스) | `confirm.getResources` | 집합 교집합 + 속성 재조립 | 정체성·속성 모두 |
| **VM/EC2** (검색해서 수기 추가) | 없음 (BFF 가 판정) | 형식만 보고 통과 | 형식만 |
| **IDC** (수기 입력) | 없음 (서버에 원본 자체가 없음) | 형식만 | 형식만 |

### D3. EC2 진위는 BFF 가 막는다 — 프론트는 되짚지 않는다

한때 `ec2-resources/search` 로 인스턴스 실재를 확인했으나 걷어냈다. 그 경로는 BFF 가
막으므로 프론트가 다시 볼 필요가 없다.

**단, 조회만 빼면 오래된 목록 감지가 함께 사라진다.** 스캔 목록에 없는 id 가 "방금
추가한 인스턴스"인지 "스캔이 다시 돌아 사라진, 오래된 화면"인지 서버가 구별할 수
없어지고, 구별을 포기하면 모르는 id 가 **전부** 수기 추가로 통과한다. 그래서 조회
대신 **표시**(`manual_ec2`)를 쓴다.

- 표시가 있으면 되짚지 않는다 — 진위는 BFF.
- 표시가 없는데 스캔 목록에도 없으면 **409** (오래된 화면 감지 유지).
- 스캔이 이미 찾은 리소스에 표시를 붙이면 거부 (갈래가 둘 다일 수 없다).
- 표시는 **화면이 AWS 로 그리는 대상**에서만 받는다. 판정은 화면과 같은 함수 하나
  (`normalizeCloudProvider(cloud_provider) === 'AWS'`)다 — 별칭 표에 없는 값(`SDU`·
  `ORACLE_CLOUD` …)은 이 함수가 'AWS' 로 떨어뜨리고, 화면은 그 값으로 EC2 수기 추가 입구를
  연다(`CandidateResourceSection`: `provider === 'AWS'`). 서버만 원문을 보고 거부하면
  새로고침해도 같은 화면이 같은 행을 다시 만들어 영원히 409 다. 그래서 `manual_ec2` 의
  통과 범위는 "문자열 AWS" 가 아니라 "화면이 AWS 로 취급하는 전부" 이고, 이는 BFF 가 EC2
  진위를 막는다는 결정 위에 선다.

**이 키는 위조 방지 장치가 아니다.** 붙이면 그만이고, 막는 것은 BFF 다. 이 키가 하는
일은 서버가 어느 조립 규칙을 쓸지 고르는 것뿐이다.

### D4. IDC 검증 범위는 IP · 도메인 · 포트

값의 **진위**는 판정하지 않는다 — "그 주소가 이 서비스 것인가"는 서버가 알 수 없고,
승인 단계와 상류의 몫이다. 보는 것은 형식뿐이다.

- **IP: IPv4만 허용.** 판정 주인은 입력 모달과 같은 `isValidIdcIp`
  (`lib/constants/idc.ts`) 하나다. 모달에도 "IPv4만 등록할 수 있어요"를 적어,
  규칙을 틀린 뒤가 아니라 치기 전에 말한다.
- **도메인**: 서버는 폼(`IDC_DOMAIN_RE`)보다 한 칸 **넓게** 본다. 이전 요청 왕복이
  폼을 거치지 않은 값을 되싣기 때문이다.
- **포트**: 1..65535.
- 계약에 없는 키는 거부(`.strict()`). `idc_source_ips`·`nlb_index` 같은 Step2 소유
  필드 주입을 막는 유일한 지점이고, 값 판정이 아니라 "이 필드를 보낼 수 있는가"다.

### D5. VM 포트도 범위만 본다

수기 추가 EC2 의 접속 정보(host·port·database_type·oracle_service_id)는 사용자가
친 값이고 대조할 원본이 없다. 포트는 1..65535 범위만 본다.

### D6. 좁히는 것은 "무엇을 보낼 수 있는가"이지 "무엇이 유효한가"가 아니다

**이 문서에서 가장 중요한 줄이다.** 유효성 판정을 새로 발명하면 그 판정이 틀린 만큼
정상 요청이 막힌다 — false positive 는 대부분 여기서 나온다.

실제로 한 번 밟았다. `hosts` 에 `.min(1)` 을 걸었는데, 이전 요청 불러오기는 host 없는
행을 `hosts: []` 로 싣고(`app/lib/api/idc.ts:198`) 좁히기 전 매퍼는 그 행을 주소 키
없이 통과시켰다. 새 규칙은 요청 **전체**를 400 으로 막았다. "도메인 행은 호스트 하나"
규칙도 마찬가지로 옛 매퍼에 없던 것이었다. 둘 다 걷어냈다.

**규칙: 서버는 폼보다 엄격해지지 않는다.**

## 클라이언트가 지금도 저작하는 것

선택형 행에서 서버가 재조립하지 **않는** 값은 셋이다. 셋 다 스캔이 모르는 값이라
대조할 대상이 없다.

| 필드 | 성격 | 검증 |
|---|---|---|
| `selected` | 사용자의 선택 | 없음 (선택은 검증 대상이 아니다) |
| `exclusion_reason` | 사용자가 적은 텍스트 | 길이만. 상한은 **입력 폼과 같은 상수**(`EXCLUSION_REASON_MAXLEN`) |
| `endpoint.*` | VM 계열 행의 접속 정보 | 형식만. **VM 자원 타입 행에서만 병합**한다 (아래) |

`endpoint` 는 스키마가 어느 행에서든 받지만, **병합은 `VM_RESOURCE_TYPES`
(`AZURE_VM`·`EC2`) 행에서만** 한다. 폼이 그 집합에서만 `endpointConfig` 를 만들기
때문이고, 서버가 이 게이트를 안 걸면 스캔 RDS 행에 `endpoint` 를 붙여 스캔이 소유해야
할 `database_type` 을 클라이언트가 덮을 수 있다(병합이 나중에 펼쳐지므로). 폼과 서버가
같은 상수를 공유한다.

⚠ `VM_RESOURCE_TYPES` 는 내부 철자(`EC2`·`AZURE_VM`)이고 계약 enum 은 `AWS_EC2_INSTANCE`·
`AZURE_VIRTUAL_MACHINE` 이다. 후보 경로는 어느 쪽도 정규화하지 않는다(`toConfirmResourceItem`
은 `resource_type` 원문, `pickBehaviorKey` 도 원문). 그래서 **실제 와이어에서는 스캔 행이
endpoint 갈래를 받는 일이 없다** — 폼도 `endpointConfig` 를 만들지 않고 서버도 병합하지
않는다(대칭이라 FP 는 없다). #342(2026-04-24) 부터 그랬고 이 작업의 범위 밖이다. 스캔 EC2 에
접속 정보를 달게 하려면 두 곳이 같은 상수를 읽고 있으니 그 상수 하나를 고치면 된다.

`selected_rds_instance_resource_id` 는 사용자의 선택이지만 **후보 목록에 대조해
검증한다**. 역할(`selected_rds_instance_role`)은 클라이언트가 보내지 않고 서버가 그
후보에서 읽는다.

나머지 — `resource_name` · `resource_type` · `integration_category` · `provider` ·
`region` · `database_type` · `rds_instance_candidates` · `recommend_fail_reason` — 는
전부 서버가 `getResources` 에서 읽어 붙인다.

## 인가

재조회는 사용자 세션 쿠키를 달고 나간다(`lib/bff/auth-headers.ts`). 그 사용자가 못 보는
스캔 결과는 조회가 안 되고, 조회가 안 되면 그 id 를 참조할 수도 없다 — **인가 판정은
상류가 그대로 수행하고, 프론트에서 권한을 새로 계산하지 않는다.**

## False positive

EC2 되짚기가 빠지고 IDC 합격선을 폼과 맞춘 뒤, 남은 거부 경로는 다음뿐이다.

| 거부 | 언제 | 성격 |
|---|---|---|
| 409 오래된 목록 | 화면 로드 후 스캔이 재실행되어 리소스가 사라짐 | **의도된 동작.** 사용자에겐 FP 로 보이지만, 사라진 리소스를 조용히 올려 보내는 쪽이 나쁘다 |
| 400 IPv4 아님 | IDC IP 칸에 IPv4 가 아닌 값 | **의도된 동작** (D4). 모달이 사전 고지한다 |
| 400 알 수 없는 키 | 클라이언트가 모델에 없는 키를 보냄 | 현재 매퍼가 보내는 키 집합과 스키마가 일치한다 |
| **409** RDS 멤버 아님 | 재스캔이 멤버 목록을 바꿔 화면의 기본 선택이 사라진 멤버를 가리킴 | 오래된 화면이지 잘못된 입력이 아니다 |
| **409** 이미 스캔에 있음 | 수기로 추가한 인스턴스를 재스캔이 후보로 올림 | 위와 같음 |

**IPv6 는 지원하지 않기로 결정했다**(D4).

### 교차 리뷰에서 실제로 걸린 FP (전부 수정됨)

D6 를 지키는 일이 생각보다 어렵다는 증거로 남겨 둔다. 전부 "서버가 폼보다 엄격해진"
같은 실수다.

| 무엇 | 폼은 허용 | 좁힌 스키마는 |
|---|---|---|
| 제외 사유 길이 | 1000자 | ~~500자~~ → 폼과 같은 상수 공유 |
| 수기 EC2 이름 | 빈 문자열 가능(검색 와이어가 private DNS 없이 돌아옴) | ~~`.min(1)`~~ → 빈 값 허용, 키 생략 |
| VM 포트 | 와이어의 `0` 이 그대로 올라옴 | ~~`.min(1)`~~ → `.min(0)` |
| `resource_id` | 와이어가 id 없으면 `''` | ~~`.min(1)`~~ → **행을 떨군다**(아래) |
| 행 수 | 스캔 전부, 화면엔 상한 없음 | ~~500~~ → ~~2000~~ → 10000 (sanity) |
| IDC 이전 요청 IP | `''` 원소가 섞일 수 있음 | 왕복 매퍼에서 걸러 냄 |
| 같은 id 두 번 | 와이어가 같은 id 를 두 번 주면 화면은 한 선택 상태를 두 행에 그린다 | ~~400~~ → 첫 행만 남긴다 |
| Azure NIC id | 와이어 값, 300자를 넘을 수 있음 | ~~256~~ → 1024 |
| `credential_id` / `resource_id` | 와이어 값, 형식은 프론트가 모름 | ~~64 / 512~~ → 256 / 1024 |
| IDC Oracle SID | 모달에 상한이 없었음 | 서버 128 → **모달도 같은 상수** `IDC_SID_MAXLEN` |

`resource_id` 는 스키마를 푸는 것만으로는 부족했다. 매퍼가 후보를 **전부** 싣기 때문에
id 없는 와이어 행이 매 제출에 딸려 오는데, 교집합은 그 행을 거르는 게 아니라 **요청
전체를 거부**한다. 그리고 새로고침하면 같은 와이어를 다시 읽어 같은 자리에서 또 막힌다 —
사용자가 빠져나갈 수 없는 409 다. 그래서 스키마를 푸는 대신 **행을 떨군다**(클라이언트·
서버 양쪽). id 없는 행은 연동 대상이 될 수 없다는 `ec2.ts` 의 규칙과 같다.

교훈 하나 더: **거부는 사용자가 고칠 수 있을 때만 옳다.** 화면을 다시 읽어도 같은 값이
돌아오는 입력을 거부하면 그건 검증이 아니라 막다른 길이다.

## 검증 조건 전체 목록

이 라우트가 거부하거나 떨구는 조건은 아래가 전부다. **여기 없는 거부는 없다** — 새 조건을
넣으면 이 표에 먼저 적는다. "출처" 는 그 상한을 누가 정하는가다: **폼** 이면 입력 칸이 같은
상수를 읽어 치기 전에 막고, **계약** 이면 swagger enum 이고, **정상 범위** 는 값의 형식이
정하고, **sanity** 는 화면이 도달할 수 없을 만큼 넓게 둔 상한이다(정책이 아니다).

### 1. 모양 — `ApprovalSelectionInput` (400 · title `연동 대상 정보를 읽지 못했습니다.`)

`detail` 은 zod 의 첫 issue 메시지 그대로다(영문). 실 UI 매퍼는 이 표의 어느 줄에도 걸리지
않는다 — 걸리면 매퍼 버그다.

| 자리 | 조건 | 출처 | detail |
|---|---|---|---|
| 본문 | 객체가 아님 / `resources` 없음 | 모양 | `Expected object, received …` / `Required` |
| 본문·행·`endpoint`·`idc`·`manual_ec2` | 모델에 없는 키 | `.strict()` | `Unrecognized key(s) in object: 'x'` |
| `resources` | 1 ≤ 길이 ≤ 10000 | sanity — 화면은 후보 **전부**를 싣고 상한이 없다 | `Array must contain at least 1 / at most 10000 element(s)` |
| `resource_id` | 문자열 ≤ 1024 (`''` 허용 — §2 ① 에서 떨군다) | sanity (와이어 값) | |
| `selected` | boolean 필수 | 모양 | `Required` |
| `exclusion_reason` | ≤ 1000 | **폼** — 클라우드 폼이 `EXCLUSION_REASON_MAXLEN` 을 읽는다. IDC 폼은 200(`IDC_REASON_MAXLEN`) | |
| `selected_rds_instance_resource_id` | 1..1024 | sanity (와이어 값) | |
| `endpoint.host` | 1..253 | 정상 범위(DNS) — EC2 는 private IP 를 폼이 채운다 | |
| `endpoint.port` | 정수 0..65535 | 정상 범위 — `0` 은 카탈로그가 와이어 `port: 0` 을 그대로 올리므로 허용. 폼(`Ec2AddModal`·`VmDatabaseConfigPanel`)은 1..65535 | |
| `endpoint.database_type` | 1..64 | 정상 범위 — select 값(`VM_DATABASE_TYPES`) | |
| `endpoint.oracle_service_id` | 1..128 | 정상 범위 — EC2 모달 `ORACLE_SID_MAXLEN`=100 ≤ 128 | |
| `endpoint.network_interface_id` | 1..1024 | sanity (와이어 값 — Azure NIC 리소스 id 는 300자를 넘을 수 있다) | |
| `manual_ec2.resource_name` | ≤ 253, `''` 허용 | 정상 범위(DNS) — 검색 와이어가 private DNS 없이 오면 `''` | |
| `idc.host_format` | `HOST` \| `IP` | 계약 enum | |
| `idc.hosts` | 0..32 개, 각 1..253 | sanity ≥ 폼(`IDC_MAX_IPS`=6, `IDC_DOMAIN_MAXLEN`=100). **빈 배열 허용** — 이전 요청 불러오기가 host 없는 행을 `[]` 로 싣는다 | |
| `idc.hosts[]` (IP) | `isValidIdcIp` — IPv4 만 | **폼과 같은 함수** — 모달이 `IPv4만 등록할 수 있어요` 로 사전 고지 | `IP 주소 형식이 아닙니다: <값>` |
| `idc.hosts[]` (HOST) | `HOSTNAME` — 폼 `IDC_DOMAIN_RE` 의 상위집합(점 없는 이름·밑줄까지) | 폼보다 넓게 — 이전 요청 왕복은 폼을 거치지 않는다 | `호스트명 형식이 아닙니다: <값>` |
| `idc.database_type` | 1..64 | 정상 범위 — enum 으로 좁히지 않는다(이전 요청이 enum 밖 값을 되싣는다) | |
| `idc.port` | 정수 1..65535 | **폼과 같은 범위**(모달 `portOk`) | |
| `idc.oracle_service_id` | 1..`IDC_SID_MAXLEN`(128) | **폼과 같은 상수** — 모달 input `maxLength` | |
| `idc.credential_id` | 1..256 | sanity — 폼은 이 값을 만들지 않는다(이전 요청에서만 온다) | |

### 2. 판정 — `resolveApprovalInput` (400 · 409 · title `연동 대상을 확인하지 못했습니다.`)

갈래는 본문이 아니라 `TargetSourceDetail.cloud_provider` 를 `normalizeCloudProvider` 에 넣은
값으로만 고른다.

| 순서 | 조건 | 결과 | 화면에서 도달? |
|---|---|---|---|
| ① | `resource_id === ''` 인 행 | **떨군다**(거부 아님) | 와이어가 id 없는 행을 주면 매 제출에 딸려 온다 — 그래서 거부하지 않는다 |
| ② | 같은 `resource_id` 가 두 번 | **첫 행만 남긴다**(거부 아님) | 와이어가 같은 id 를 두 번 주면 화면도 한 선택 상태를 두 행에 그린다 — 첫 행이 곧 화면이 뜻한 것 |
| ③ | ①②를 거치고 한 행도 없음 | 400 `연동할 리소스가 없습니다.` | 사실상 아니오 — 매퍼가 먼저 거르고 CTA 는 선택 0 이면 잠긴다. id 없는 행만 골랐을 때뿐 |
| ④ IDC | 행에 `idc` 없음 | 400 `IDC 연동 대상에는 접속 정보가 필요합니다.` | 아니오 — IDC 매퍼는 모든 행에 `idc` 를 붙인다 |
| ④ IDC | 행에 `endpoint` 또는 `manual_ec2` | 400 | 아니오 |
| ⑤ 클라우드 | 어떤 행에든 `idc` | 400 `IDC 접속 정보는 IDC 연동에서만 보낼 수 있습니다.` | 아니오 |
| ⑥ 클라우드 | 스캔 목록에 있는 id 에 `manual_ec2` | **409** 오래된 화면 | 예 — 수기 추가 뒤 재스캔이 같은 인스턴스를 후보로 올린 경우. 새로고침이 고친다 |
| ⑦ 클라우드 | `selected_rds_instance_resource_id` 가 그 행의 `rds_instance_candidates` 에 없음 | **409** 오래된 화면 | 예 — 재스캔이 멤버 목록을 바꾼 경우. 새로고침이 고친다 |
| ⑧ 클라우드 | 스캔 목록에 없는 id + `manual_ec2` + 화면이 AWS 로 그리는 대상 | 통과(수기 EC2 조립) | 정상 경로 |
| ⑨ 클라우드 | 스캔 목록에 없는 id, 그 외 | **409** 오래된 화면 | 예 — 재스캔이 리소스를 지운 경우. 새로고침이 고친다 |

409 셋은 전부 "다시 읽으면 달라진다" 이고, 400 은 전부 실 UI 가 만들 수 없는 본문이다.

### 3. 상류 실패

`targetSources.get` · `confirm.getResources` 가 던지면 `withV1` 이 `BffError` 를 problem 응답으로
그대로 옮긴다 — 이 문서의 조건이 아니다. 제출 한 번에 늘어난 상류 왕복은 클라우드 갈래가
둘(대상 조회 + 후보 조회), IDC 는 하나(대상 조회)다 — IDC 는 후보 조회 전에 돌아온다.

## BFF 에 필드가 생기면

### 응답에 생긴 필드 (`getResources` 의 행 / `metadata`)

서버는 **허용 목록**으로 되싣는다(`authoritativeMetadata`·`buildFromAuthoritative`):
`resource_name` · `resource_type` · `integration_category` · `recommend_fail_reason` ·
`metadata.{provider, region, database_type, resource_type, rds_instance_candidates}`. 새 필드는
**거부되지 않고, 상류로 나가는 승인 요청 본문에 실리지도 않는다** — 조용히 빠진다. 검증
에러가 아니라 누락이다. 화면은 영향이 없다(화면은 `getResources` 를 따로 읽는다).

BFF 가 그 필드를 승인 요청에서 되받기를 기대한다면(예: 새 `metadata.subnet_id` 를 Step2 가
읽는다): `authoritativeMetadata` 에 한 줄 추가한다. 클라이언트는 손대지 않는다 — 스캔이
소유하는 값은 클라이언트가 보내지 않는 것이 이 설계의 요점이다.

좁히기 전 매퍼도 전부를 되싣지는 않았다(provider · region · database_type ·
rds_instance_candidates 만). "새 필드가 빠진다" 는 이 작업이 만든 성질이 아니라 원래 있던
성질이고, 그 목록이 클라이언트에서 서버로 옮겨 왔을 뿐이다.

### 요청에 생긴 필드 (`ApprovalRequestInputDto` 에 클라이언트가 채워야 할 값)

브라우저↔Next 모양은 `.strict()` 다. 새 키는 세 곳을 **함께** 고친다.

1. `lib/approval-selection.ts` — 모양에 키를 추가. **반드시 `.optional()`** — 배포 중 옛 번들을
   든 탭이 키 없이 보내도 400 이 되면 안 된다.
2. `app/api/_lib/approval-input.ts` — 어느 갈래에서 어떻게 계약 본문으로 옮기는지.
3. 매퍼(`approval-payload.ts` / `toIdcApprovalRequestInput`) — 그 값을 싣는다.

순서를 어기면:

- 매퍼만 고치면 `SelectionRow` 타입이 그 키를 모르므로 **`tsc` 가 빌드에서 막는다**(객체
  리터럴 초과 속성 검사). 런타임까지 가면 400 `Unrecognized key(s) in object: '<키>'` 다.
- 모양만 고치면 값이 라우트에서 버려진다 — 조용한 누락. 리졸버 테스트가 그 키를 되싣는지
  단언해야 한다.
- 계약 zod 는 `.partial().passthrough()` 라 상류로 나가는 본문에는 아무 제약이 없다 — 좁히는
  검증은 이 세 파일 밖에 없다.

### 갈래가 생기면 (새 provider)

`normalizeCloudProvider` 가 모르는 provider 는 'AWS' 로 떨어진다 — 화면도 서버도 같은 함수를
쓰므로 **새 provider 는 자동으로 AWS 갈래(스캔 교집합 + 수기 EC2 허용)** 로 간다. IDC 처럼
스캔이 없는 갈래를 추가하려면 `isIdcProvider` 옆에 판정을 하나 더 두고, 그 갈래의 모양
(`IdcInput` 같은)을 `.strict()` 로 만든다.

## 좁히기 전 매퍼와 상류 본문이 다른 자리

같은 화면·같은 선택에서 상류(BFF)가 받는 `ApprovalRequestInputDto` 가 달라지는 자리는 아래가
전부다. 전부 계약 안이고(`TargetSourceResourceItemDto` 의 required 는 `metadata` 하나), 스캔
원문에 더 가깝다.

| 자리 | 전 (`approval-payload.ts` 옛 매퍼) | 후 (리졸버) |
|---|---|---|
| `resource_name` | 스캔에 없으면 `resource_id` 로 대체해 보냄 | 스캔에 없으면 키 생략 |
| `integration_category` | 스캔에 없거나 enum 밖이면 `TARGET` 으로 보냄 | 스캔 원문, 없으면 생략 |
| `metadata.provider` | `normalizeCloudProvider` → 대문자. 스캔에 없으면 `resource_type` 에서 추론. **SDU 는 `AWS` 로 바뀌어 나갔다** | 스캔 원문(계약 enum: AWS/GCP/AZURE/IDC/SDU/UNKNOWN). 없으면 생략 |
| `metadata.resource_type` | 보내지 않음 | 스캔 metadata 에 있으면 되싣음 |
| `metadata.rds_instance_candidates` | RDS 클러스터 타입 행에서만, `resource_id` 없는 원소 제거 | 스캔 metadata 에 있으면 원문 그대로 |
| `metadata.selected_rds_instance_role` | 보내지 않음 | 고른 멤버의 `cluster_member_role`(계약 필드) |
| `recommend_fail_reason` · 제외 사유 대체값 | 별칭 정규화 값 | 스캔 원문 |
| 수기 EC2 `metadata.resource_type` | 보내지 않음 | `AWS_EC2_INSTANCE` |
| IDC 행 | 동일 | 동일 |

## 하지 말 것

- **브라우저(React 컴포넌트)에 방어 코드를 넣지 말 것.** 보안 효과가 0 인 것보다
  나쁜 점은 "검증했다"는 착각을 만들어 서버·BFF 검증을 미루게 한다는 것이다.
  프론트 검증은 UX(즉시 피드백)이지 보안이 아니다.
- **서버가 폼보다 엄격해지지 말 것** (D6).
- **BFF 검증을 대체한다고 생각하지 말 것.** 이 계층은 BFF 가 네트워크에서 격리되어
  있다는 전제 위에 서 있다. 다른 클라이언트가 생기거나 격리가 풀리면 우회된다.
