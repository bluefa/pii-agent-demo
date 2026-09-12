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
| **EC2 수기 추가** (검색해서 추가) | 없음 (BFF 가 판정) | `manual_ec2` 안의 접속 정보를 형식만 보고 옮긴다 | 형식만 |
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
- **포트**: 정수 1..65535 — 모달 `portOk` 와 같은 판정(`Number.isInteger`).
- 계약에 없는 키는 거부(`.strict()`). `idc_source_ips`·`nlb_index` 같은 Step2 소유
  필드 주입을 막는 유일한 지점이고, 값 판정이 아니라 "이 필드를 보낼 수 있는가"다.

### D5. 수기 EC2 의 접속 정보는 `manual_ec2` 안에서만 온다

스캔 행에는 접속 정보를 실을 자리가 없다 — 모양에 키가 없다. 값은 추가 모달이 친 것이고
대조할 원본이 없다. 포트는 추가 모달과 같은 1..65535 만 본다.

서버가 보는 것은 폼이 이미 보는 것과 같다: 포트는 정수 1..65535, DB 타입은 추가 모달
select 목록(`VM_DATABASE_TYPES`)이다. 진위 — 그 인스턴스가 실재하는가 — 는 BFF 의 몫이다.

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
| `exclusion_reason` | 사용자가 적은 텍스트 | 없음 — 길이 상한은 **폼에만** 있다(`EXCLUSION_REASON_MAXLEN`). 이전 요청이 폼을 거치지 않은 사유를 되싣으므로 서버는 다시 재지 않는다 |
| `selected_rds_instance_resource_id` | RDS 멤버 선택 | 그 행의 후보 목록에 대조. 역할은 서버가 읽는다 |

스캔 행에는 접속 정보 키가 없다. `EC2`·`AZURE_VM` 철자 행에서만 열리던 `endpoint`
편집기(`VmDatabaseConfigPanel`)는 계약 enum(`AWS_EC2_INSTANCE`·`AZURE_VIRTUAL_MACHINE`)에서
도달 불가한 경로였고(#342 부터), 그 드래프트는 이제 보내지 않는다. 스캔 EC2 에 사용자가 친
접속 정보가 필요해지면 `manual_ec2` 처럼 **키가 있는 갈래**로 더한다 — metadata 병합이
아니라.

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
| 409 오래된 목록 (`CONFLICT_STALE_TARGET_LIST`) | 화면 로드 후 스캔이 재실행되어 리소스가 사라짐 | **의도된 동작.** 화면은 '연동 대상 목록이 바뀌었어요. 새로고침한 뒤 다시 선택해 주세요.' 를 다시 요청하기 없이 낸다 — 사라진 리소스를 조용히 올려 보내는 쪽이 나쁘다 |
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
| 제외 사유 길이 | 1000자 | ~~500자~~ → 폼과 같은 상수 공유 → **서버 상한 제거**(아래 마지막 줄) |
| 수기 EC2 이름 | 빈 문자열 가능(검색 와이어가 private DNS 없이 돌아옴) | ~~`.min(1)`~~ → 빈 값 허용, 키 생략 |
| VM 포트 | 와이어의 `0` 이 그대로 올라옴 | ~~`.min(1)`~~ → `.min(0)` → 스캔 행은 포트를 보내지 않게 되어 해당 없음 |
| `resource_id` | 와이어가 id 없으면 `''` | ~~`.min(1)`~~ → **행을 떨군다**(아래) |
| 행 수 | 스캔 전부, 화면엔 상한 없음 | ~~500~~ → ~~2000~~ → 10000 (sanity) |
| IDC 이전 요청 IP | `''` 원소가 섞일 수 있음 | 왕복 매퍼에서 걸러 냄 |
| sanity 상한 전부 (행 수 10000 · IDC hosts 32 · `resource_id` 1024 · RDS 멤버 id 1024 · IDC `database_type` 64 · `credential_id` 256) | 프론트가 짓지 않는 값 — 이전 요청 왕복·대형 스캔이 그대로 되싣는다 | **제거.** 보호 효과가 0 이다(본문은 `request.json()` 이 이미 다 읽었고 리졸버는 Map 하나를 훑는다) — 남는 것은 새로고침으로 못 고치는 거부뿐이었다 |
| id 없는 행이 `selected: true` 로 옴 | 와이어가 그렇게 준다 | 목록에 올라 CTA 가 세는데 매퍼가 떨궈 `{ resources: [] }` 가 나가 400 이었다 → **어댑터가 목록에서 떨군다** |
| 409 오래된 화면이 코드 없이 나감 | — | `fetchJson` 이 status 로 접어 CONFLICT → '이미 진행 중인 승인 요청이 있어요' + 다시 요청하기(같은 본문을 다시 보내 같은 409) → **제 코드 `CONFLICT_STALE_TARGET_LIST`** + 새로고침 문구, 다시 요청하기 없음 |
| 같은 id 두 번 | 와이어가 같은 id 를 두 번 주면 화면은 한 선택 상태를 두 행에 그린다 | ~~400~~ → 첫 행만 남긴다 |
| Azure NIC id | 와이어 값, 300자를 넘을 수 있음 | ~~256~~ → 1024 → 필드 제거(스캔 행은 접속 정보를 보내지 않는다) |
| `credential_id` / `resource_id` | 와이어 값, 형식은 프론트가 모름 | ~~64 / 512~~ → 256 / 1024 |
| IDC Oracle SID | 모달에 상한이 없었음 | 서버 128 → **모달도 같은 상수** `IDC_SID_MAXLEN` → **서버 상한 제거**(아래 마지막 줄) |
| IDC 포트 소수 | 모달 `portOk` 가 `Number.isFinite` 라 `80.5` 를 통과시켰고 서버 `.int()` 가 거부 | **모달을 `Number.isInteger` 로** (EC2 모달과 같은 판정) — 서버는 그대로 |
| 되싣는 텍스트 길이 (제외 사유 1000 · IDC SID 128 · 수기 EC2 SID 128 · 수기 EC2 이름 253) | 계약(`docs/swagger/install-v1.yaml`)에 길이 제한이 없다 — 상류가 더 길게 저장한 값을 화면이 그대로 되싣는다(사유 재시드 `use-candidate-resources.ts`, IDC 왕복 `toIdcResourceView`, 이름은 EC2 검색 와이어라 폼에 칸조차 없다) | **제거.** 폼과 같은 상수라도 **서버가 들면** 폼을 거치지 않은 값에서 400 이 된다 — 상한은 입력 칸의 `maxLength` 만 든다 (Fable-5 교차 리뷰가 찾음) |

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
| 본문·행·`idc`·`manual_ec2` | 모델에 없는 키 | `.strict()` | `Unrecognized key(s) in object: 'x'` |
| `resources` | 1 개 이상, **상한 없음** | 화면은 후보 **전부**를 싣고 제 상한이 없다 — 숫자를 적으면 그보다 큰 스캔은 영영 못 보낸다 | `Array must contain at least 1 element(s)` |
| `resource_id` | 문자열, 길이 상한 없음 (`''` 허용 — 어댑터가 목록에서 먼저 떨구고 §2 ① 이 방어) | 스캔이 정하는 값이라 프론트가 길이를 모른다 | |
| `selected` | boolean 필수 | 모양 | `Required` |
| `exclusion_reason` | 문자열, **상한 없음** | 상한은 폼만 든다 — 클라우드 폼 `EXCLUSION_REASON_MAXLEN`(1000) · IDC 폼 `IDC_REASON_MAXLEN`(200). 이전 요청은 그보다 긴 사유를 되싣는다 | |
| `selected_rds_instance_resource_id` | 1자 이상 | 스캔이 준 후보 id — 길이는 §2 ⑦ 이 목록 대조로 대신 본다 | |
| `manual_ec2.resource_name` | 문자열, **상한 없음**, `''` 허용 | 표시용 이름이라 DNS 규칙이 아니다 — 추가 모달에 이름 칸이 없고 검색 와이어가 정한다(private DNS 없이 오면 `''`) | |
| `manual_ec2.host` | 1..253 | 정상 범위(DNS) — 검색 결과의 private IP | |
| `manual_ec2.port` | 정수 1..65535 | **폼과 같은 범위** — `Ec2AddModal` (`portOk`) | |
| `manual_ec2.database_type` | `VM_DATABASE_TYPES` 를 `toWireDatabaseType` 로 내린 소문자 집합 | **폼과 같은 상수** — `Ec2AddModal` 의 select 에서 파생 | `지원하지 않는 데이터베이스 타입입니다: <값>` |
| `manual_ec2.oracle_service_id` | 1자 이상, **상한 없음** | 상한은 폼만 든다(`ORACLE_SID_MAXLEN`=100) — 이전 요청은 그 밖의 값을 되싣는다 | |
| `idc.host_format` | `HOST` \| `IP` | 계약 enum | |
| `idc.hosts` | 각 1..253, **개수 상한 없음**, 빈 배열 허용 | 폼은 6개(`IDC_MAX_IPS`)까지 만들지만 이전 요청은 그때 저장된 만큼을 되싣는다 — 그 수를 프론트가 정한 적이 없다 | |
| `idc.hosts[]` (IP) | `isValidIdcIp` — IPv4 만 | **폼과 같은 함수** — 모달이 `IPv4만 등록할 수 있어요` 로 사전 고지 | `IP 주소 형식이 아닙니다: <값>` |
| `idc.hosts[]` (HOST) | `HOSTNAME` — 폼 `IDC_DOMAIN_RE` 의 상위집합(점 없는 이름·밑줄까지) | 폼보다 넓게 — 이전 요청 왕복은 폼을 거치지 않는다 | `호스트명 형식이 아닙니다: <값>` |
| `idc.database_type` | 1자 이상 | enum 으로도 길이로도 좁히지 않는다 — 이전 요청이 enum 밖 값을 되싣는다 | |
| `idc.port` | 정수 1..65535 | **폼과 같은 범위**(모달 `portOk`) | |
| `idc.oracle_service_id` | 1자 이상, **상한 없음** | 상한은 모달 input `maxLength`(`IDC_SID_MAXLEN`=128)에만 있다 — 이전 요청은 폼을 거치지 않는다 | |
| `idc.credential_id` | 1자 이상 | 와이어가 발급한 id — 폼은 만들지 않고 형식도 길이도 프론트가 모른다 | |

### 2. 판정 — `resolveApprovalInput` (400 title `연동 대상을 확인하지 못했습니다.` · 409 code `CONFLICT_STALE_TARGET_LIST`, title `Target List Changed`)

갈래는 본문이 아니라 `TargetSourceDetail.cloud_provider` 를 `normalizeCloudProvider` 에 넣은
값으로만 고른다.

| 순서 | 조건 | 결과 | 화면에서 도달? |
|---|---|---|---|
| ① | `resource_id === ''` 인 행 | **떨군다**(거부 아님) | 아니오 — 어댑터(`getConfirmResources`)가 목록에서 먼저 떨군다. 매퍼·리졸버의 필터는 방어다 |
| ② | 같은 `resource_id` 가 두 번 | **첫 행만 남긴다**(거부 아님) | 와이어가 같은 id 를 두 번 주면 화면도 한 선택 상태를 두 행에 그린다 — 첫 행이 곧 화면이 뜻한 것 |
| ③ | ①②를 거치고 한 행도 없음 | 400 `연동할 리소스가 없습니다.` | 아니오 — id 없는 행은 목록에 오르지 않고, CTA 는 선택 0 이면 잠긴다 |
| ④ IDC | 행에 `idc` 없음 | 400 `IDC 연동 대상에는 접속 정보가 필요합니다.` | 아니오 — IDC 매퍼는 모든 행에 `idc` 를 붙인다 |
| ④ IDC | 행에 `manual_ec2` | 400 | 아니오 |
| ⑤ 클라우드 | 어떤 행에든 `idc` | 400 `IDC 접속 정보는 IDC 연동에서만 보낼 수 있습니다.` | 아니오 |
| ⑥ 클라우드 | 스캔 목록에 있는 id 에 `manual_ec2` | **409** `CONFLICT_STALE_TARGET_LIST` | 예 — 수기 추가 뒤 재스캔이 같은 인스턴스를 후보로 올린 경우. 새로고침이 고친다 |
| ⑦ 클라우드 | `selected_rds_instance_resource_id` 가 그 행의 `rds_instance_candidates` 에 없음 | **409** `CONFLICT_STALE_TARGET_LIST` | 예 — 재스캔이 멤버 목록을 바꾼 경우. 새로고침이 고친다 |
| ⑧ 클라우드 | 스캔 목록에 없는 id + `manual_ec2` + 화면이 AWS 로 그리는 대상 | 통과(수기 EC2 조립) | 정상 경로 |
| ⑨ 클라우드 | 스캔 목록에 없는 id, 그 외 | **409** `CONFLICT_STALE_TARGET_LIST` | 예 — 재스캔이 리소스를 지운 경우. 새로고침이 고친다 |

409 셋은 전부 "다시 읽으면 달라진다" 이고, 400 은 전부 실 UI 가 만들 수 없는 본문이다.
세 자리 모두 `CONFLICT_STALE_TARGET_LIST` 코드를 달고 나가, 화면은 "연동 대상 목록이
바뀌었어요. 새로고침한 뒤 다시 선택해 주세요." 를 **다시 요청하기 없이** 낸다.

역방향(스캔에는 있는데 본문에 없는 id)은 검사하지 않는다 — 스캔이 자란 경우이고, 사용자가
본 목록이 곧 요청이다.

### 3. 상류 실패

`targetSources.get` · `confirm.getResources` 가 던지면 `withV1` 이 `BffError` 를 problem 응답으로
그대로 옮긴다 — 이 문서의 조건이 아니다. 제출 한 번에 늘어난 상류 왕복은 클라우드 갈래가
둘(대상 조회 + 후보 조회), IDC 는 하나(대상 조회)다 — IDC 는 후보 조회 전에 돌아온다.

## 타입별 검증 항목

한 행이 어느 갈래로 가는지는 본문이 아니라 `TargetSourceDetail.cloud_provider` 를 `normalizeCloudProvider` 에 넣은 값이 정한다. 아래 표는 갈래별로 **브라우저가 보내는 것 · 서버가 검증하는 것 · 서버가 채우는 것** 이다. 전체 거부 조건의 필드순 목록은 위 §"검증 조건 전체 목록".

### 공통 (모든 행)

| 항목 | 검증 | 실패 |
|---|---|---|
| 본문 | `{ resources: [...] }` 객체, 행 1개 이상 | 400 |
| 모델 밖 키 (본문·행·`manual_ec2`·`idc` 어느 깊이든) | `.strict()` | 400 `Unrecognized key(s)` |
| `resource_id` | 문자열 필수. `''` 는 어댑터가 목록에서 떨구고 리졸버도 떨군다 | — |
| `selected` | boolean 필수 — `null`·문자열·숫자·누락 전부 거부 | 400 |
| `exclusion_reason` | 길이를 재지 않는다 — 상한은 폼 textarea 의 `maxLength`(1000·IDC 200)에만 있다. 선택 행에서는 무시 | — |
| 같은 `resource_id` 두 번 | 첫 행만 남긴다 | — |

### ① 스캔 행 — AWS · Azure · GCP · SDU (`/resources` 에 있는 리소스)

브라우저가 보내는 것: `resource_id` · `selected` · `exclusion_reason?` · `selected_rds_instance_resource_id?`. **접속 정보·이름·타입·리전·카테고리를 실을 자리가 없다** — 키가 있으면 400.

| 항목 | 검증 | 실패 |
|---|---|---|
| `resource_id` | 서버가 `confirm.getResources` 를 다시 읽은 집합에 있어야 한다 | 409 `CONFLICT_STALE_TARGET_LIST` |
| `manual_ec2` 동봉 | 스캔 목록에 있는 id 에 붙으면 거부 | 409 |
| `idc` 동봉 | 클라우드 대상에서는 거부 | 400 |
| `selected_rds_instance_resource_id` | 그 행의 `metadata.rds_instance_candidates[].resource_id` 중 하나 | 409 |
| 진위 | 스캔이 찾은 리소스만 통과 — 정체성·속성 모두 서버 것 | |

서버가 채우는 것: `resource_name` · `resource_type` · `integration_category` · `recommend_fail_reason`(**제외 행만** — 선택 행에는 붙이지 않는다) · `metadata.{provider, region, database_type(소문자), resource_type, rds_instance_candidates}` · `metadata.selected_rds_instance_role`(고른 멤버에서). 제외 행의 `exclusion_reason` = 사용자 사유, 없으면 스캔 판정(`recommend_fail_reason`). 스캔의 `selected`·`scan_status`·이전 `exclusion_reason` 은 되싣지 않는다.

### ② 수기 추가 EC2 — 화면이 AWS 로 그리는 대상에서만 (`/resources` 에 없는 id + `manual_ec2`)

브라우저가 보내는 것: 공통 + `manual_ec2 { resource_name?, host?, port?, database_type?, oracle_service_id? }` (제외된 행은 표시만: `manual_ec2 { resource_name? }`).

| 항목 | 검증 | 출처 | 실패 |
|---|---|---|---|
| `resource_id` | 스캔 목록에 **없어야** 한다(있으면 오래된 화면) · 대상이 AWS 갈래여야 한다 | 갈래 | 409 |
| `resource_name` | 문자열, 상한 없음, `''` 허용(키 생략) | 검색 와이어 — 폼에 이름 칸이 없다 | — |
| `host` | 1..253 | DNS | 400 |
| `port` | 정수 1..65535 | 폼 `Ec2AddModal portOk` 와 같은 판정 | 400 |
| `database_type` | `VM_DATABASE_TYPES`(15개)를 `toWireDatabaseType` 로 내린 소문자 집합 | 폼 select 와 같은 상수 | 400 `지원하지 않는 데이터베이스 타입입니다: <값>` |
| `oracle_service_id` | 1자 이상, 상한 없음 | 폼 `ORACLE_SID_MAXLEN`=100 이 먼저 막는다 | 400 (빈 값) |
| 진위 | 보지 않는다 — 인스턴스 실재·주소는 **BFF** 가 판정 | 오너 결정 D3 | |

서버가 붙이는 것: `resource_type: AWS_EC2_INSTANCE` · `integration_category: NO_INSTALL_NEEDED` · `metadata.provider: AWS` · `metadata.resource_type: AWS_EC2_INSTANCE`; 접속 정보는 `manual_ec2` 값을 그대로 `metadata.{host, port, database_type, oracle_service_id}` 로.

### ③ IDC — IDC 대상에서만 (스캔 없음)

브라우저가 보내는 것: 공통 + `idc { host_format, hosts[], database_type?, port?, oracle_service_id?, credential_id? }`. 모든 행에 `idc` 가 있어야 하고(없으면 400), `manual_ec2` 는 거부(400). 서버는 `/resources` 를 읽지 않는다 — 대조할 집합이 없다.

| 항목 | 검증 | 출처 | 실패 |
|---|---|---|---|
| `host_format` | `HOST` \| `IP` | 계약 enum | 400 |
| `hosts[]` (IP) | `isValidIdcIp` — IPv4 만 | 폼과 같은 함수, 모달이 사전 고지 | 400 `IP 주소 형식이 아닙니다: <값>` |
| `hosts[]` (HOST) | `HOSTNAME` 정규식(폼 `IDC_DOMAIN_RE` 의 상위집합), 각 1..253 | 폼보다 넓게 | 400 `호스트명 형식이 아닙니다: <값>` |
| `hosts` 개수 | 상한 없음, 빈 배열 허용 | 이전 요청 왕복 | |
| `database_type` | 1자 이상 — enum 으로 좁히지 않는다 | 이전 요청 왕복 | 400 |
| `port` | 정수 1..65535 | 폼 `portOk` 와 같은 판정 | 400 |
| `oracle_service_id` | 1자 이상, 상한 없음 | 폼 input `maxLength`(`IDC_SID_MAXLEN`=128)가 먼저 막는다 | 400 (빈 값) |
| `credential_id` | 1자 이상 — 폼은 만들지 않고 이전 요청만 싣는다 | | 400 |
| 모델 밖 키 (`idc_source_ips`·`nlb_index` 등 Step2 소유) | `.strict()` | | 400 |
| 진위 | 보지 않는다 — "이 주소가 이 서비스 것인가" 는 승인 단계·상류의 몫 | 오너 결정 D4 | |

서버가 붙이는 것: `metadata.provider: IDC` · `idc_host_format` · `idc_host`(도메인 첫 호스트) / `idc_ips`(목록이 비면 키 없음) · 나머지는 값 그대로.

### 실패가 화면에 닿는 모양

| 실패 | 응답 | 화면 (`confirm-failures.ts`, 코드로 고른다) |
|---|---|---|
| 모양 위반 (§1) | 400, title `연동 대상 정보를 읽지 못했습니다.`, code 없음 | `BAD_REQUEST` → "요청 내용을 다시 확인해 주세요." · 다시 요청하기 없음 — 실 UI 는 도달 불가 |
| 판정 위반 400 (§2 ③④⑤) | 400, title `연동 대상을 확인하지 못했습니다.` | 같음 — 실 UI 는 도달 불가 |
| 오래된 화면 (§2 ⑥⑦⑨) | 409, code `CONFLICT_STALE_TARGET_LIST` | "연동 대상 목록이 바뀌었어요. 새로고침한 뒤 다시 선택해 주세요." · 다시 요청하기 없음 |
| BFF 의 409 (`CONFLICT_REQUEST_PENDING`) | 409, code 는 allowlist 밖이라 status 로 접힘 | `CONFLICT` → "이미 진행 중인 승인 요청이 있어요." · 다시 요청하기(진행 상태 재확인 후 다음 단계로) |

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
| 스캔 VM 행(`EC2`·`AZURE_VM` 철자)의 endpoint 드래프트 | metadata 로 병합 | 보내지 않음 — 와이어 enum 에서 도달 불가한 경로 |
| `resource_id: ''` 행 | 그대로 보냄(교집합이 못 찾아 요청 전체가 막혔다) | 어댑터가 목록에서 떨군다 — 애초에 화면에 오르지 않는다 |
| 제외 사유 공백 | 공백만 있는 사유도 그대로 보냄 | `trim`, 비면 키 생략 → 서버가 스캔 판정(`recommend_fail_reason`)으로 채운다 |
| IDC 이전 요청의 `''` IP | 그대로 되싣음 | 왕복 매퍼가 걸러 낸다 |
| IDC 행 | 동일 | 동일 |

## 하지 말 것

- **브라우저(React 컴포넌트)에 방어 코드를 넣지 말 것.** 보안 효과가 0 인 것보다
  나쁜 점은 "검증했다"는 착각을 만들어 서버·BFF 검증을 미루게 한다는 것이다.
  프론트 검증은 UX(즉시 피드백)이지 보안이 아니다.
- **서버가 폼보다 엄격해지지 말 것** (D6).
- **BFF 검증을 대체한다고 생각하지 말 것.** 이 계층은 BFF 가 네트워크에서 격리되어
  있다는 전제 위에 서 있다. 다른 클라이언트가 생기거나 격리가 풀리면 우회된다.
