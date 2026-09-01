/**
 * 승인 요청에서 브라우저가 보낼 수 있는 전부 — 그 모양 하나.
 *
 * 왜 좁은지, 라우트가 이걸로 무엇을 하는지는 `app/api/_lib/approval-input.ts` 머리말.
 * 이 파일은 상류 클라이언트를 모른다: 모양은 브라우저와 서버가 함께 읽는 어휘이고,
 * 판정은 서버만의 일이라 파일을 나눈다.
 *
 * 스캔이 찾은 행은 **포인터와 선택**뿐이다 — 어느 리소스인가(id), 골랐는가, 왜 뺐는가,
 * 어느 RDS 멤버인가. 접속 정보(host·port·database_type·oracle_service_id)는 `manual_ec2`
 * 와 `idc` 안에만 있다. 스캔 행에는 그 값을 실을 자리가 없고, 그래서 "스캔 행의 metadata 는
 * 전부 서버가 채운다"가 타입 게이트가 아니라 모양으로 참이 된다.
 *
 * 길이·개수 상한이 없는 자리는 일부러 없다. 프론트가 짓지 않는 값(스캔이 준 id, 이전 요청이
 * 되싣는 접속 정보)에 상한을 걸어 막을 수 있는 것은 없고 — 본문은 `request.json()` 이 이미
 * 다 읽었고, 리졸버는 Map 하나를 훑다가 모르는 id 에서 멈춘다 — 남는 것은 화면이 고칠 수
 * 없는 거부뿐이다. 여기 남은 규칙은 둘 중 하나다: **폼과 같은 상수**(포트 범위·
 * `VM_DATABASE_TYPES`)이거나, **값의 형식**(DNS 253자·IPv4·호스트명)이다. 텍스트 길이
 * 상한은 여기 없다 — 사유·SID·이름의 `maxLength` 는 폼만 든다.
 */
import { z } from 'zod';
// IP 판정은 입력 모달과 같은 주인을 쓴다 — 폼이 통과시킨 값을 서버가 되돌려
// 보내면 그 자리가 곧 false positive 다.
import { isValidIdcIp } from '@/lib/constants/idc';
import { VM_DATABASE_TYPES } from '@/lib/constants/vm-database';
import { toWireDatabaseType } from '@/lib/types';

// 호스트명은 폼(`IDC_DOMAIN_RE`)보다 한 칸 넓게 본다: 점 없는 이름·밑줄까지 받는다.
// 이전 요청 왕복이 폼을 거치지 않은 값을 되싣기 때문이고, 서버가 폼보다 엄격해지는
// 순간 그 차이가 전부 false positive 가 된다.
const HOSTNAME = /^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/;

/**
 * 수기 EC2 의 DB 타입. 추가 모달 select(`VM_DATABASE_TYPES`)와 **같은 상수**에서 매퍼와 같은
 * 변환(`toWireDatabaseType`)으로 내린 집합이다 — 폼이 고를 수 있는 값이 곧 서버가 받는 값이라
 * 둘이 어긋날 수 없다.
 */
const MANUAL_EC2_DATABASE_TYPES = new Set(
  VM_DATABASE_TYPES.map((type) => toWireDatabaseType(type.value)),
);

/**
 * 수기 추가 EC2 행이 스스로 말하는 것. 이름(Private DNS)은 추가 모달이 검색 결과에서
 * 받은 값이고, 서버가 다시 확인하지 않는다 — 이 경로의 진위는 BFF 가 막는다.
 *
 * 클라우드 갈래에서 클라이언트가 접속 정보를 저작하는 자리는 여기 하나다. 폼은
 * `Ec2AddModal`(host 는 검색 결과의 private IP)이고, 서버가 보는 것은 폼이 이미 보는 것과
 * 같다 — 포트는 정수 1..65535, DB 타입은 추가 모달 select 목록, host 는 DNS 형식·길이.
 * 이름과 SID 는 길이를 재지 않는다: 이름은 폼에 칸이 아예 없고(검색 와이어가 준다), SID 는
 * 폼 `ORACLE_SID_MAXLEN`(100)이 먼저 막고 이전 요청은 그 밖의 값을 되싣는다. 진위(그
 * 인스턴스가 실재하는가, 그 주소가 맞는가)는 여전히 BFF 가 막는다.
 */
const ManualEc2Input = z
  .object({
    // 빈 문자열도 받는다: EC2 검색 와이어가 private DNS 이름 없이 돌아오면 매퍼가
    // `''` 를 싣는다(`app/lib/api/ec2.ts`). 없던 거부를 만들지 않는다. 길이도 재지
    // 않는다 — 표시용 이름이지 호스트명이 아니고, 값은 폼이 아니라 와이어가 정한다.
    resource_name: z.string().optional(),
    host: z.string().min(1).max(253).optional(),
    // 추가 모달과 같은 범위다(`portOk`: 정수 1..65535).
    port: z.number().int().min(1).max(65535).optional(),
    database_type: z
      .string()
      .refine(
        (value) => MANUAL_EC2_DATABASE_TYPES.has(value),
        (value) => ({ message: `지원하지 않는 데이터베이스 타입입니다: ${value}` }),
      )
      .optional(),
    // 길이 상한 없음 — 폼이 먼저 막고(`ORACLE_SID_MAXLEN`), 계약도 이 필드의 길이를
    // 규정하지 않는다. 되싣는 값에 상한을 걸면 화면이 고칠 수 없는 400 이 된다.
    oracle_service_id: z.string().min(1).optional(),
  })
  .strict();

/** IDC 한 행의 수기 입력. `idc_source_ips`/`nlb_index` 는 Step2 가 붙이므로 받지 않는다. */
const IdcInput = z
  .object({
    host_format: z.enum(['HOST', 'IP']),
    // 비어 있어도 받는다. 이전 요청 불러오기가 host 없는 행을 `hosts: []` 로 싣고
    // (`app/lib/api/idc.ts` toIdcResourceView), 좁히기 전에도 그 행은 주소 필드 없이
    // 통과했다 — 없던 거부를 새로 만들면 그 자리에서 FP 가 된다. 한 행이 전체 제출을
    // 죽이는 자리라 더욱 그렇다.
    // 개수 상한도 없다: 폼은 6개까지만 만들지만 이전 요청은 그때 저장된 만큼을 되싣고,
    // 그 수를 프론트가 정한 적이 없다. 각 원소는 DNS 길이·형식만 본다.
    hosts: z.array(z.string().min(1).max(253)),
    // `database_type` 은 계약상 평문 문자열이고, 이전 요청 불러오기가 enum 밖 값을
    // 되싣는다. enum 으로도 길이로도 좁히지 않는다 — 그 왕복이 깨진다.
    database_type: z.string().min(1).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    // 상한은 모달 input 의 `maxLength`(`IDC_SID_MAXLEN`)에만 있다. 이전 요청은 폼을
    // 거치지 않은 값을 되싣고, 계약도 이 필드의 길이를 규정하지 않는다.
    oracle_service_id: z.string().min(1).optional(),
    // 와이어가 발급한 id 이고 형식도 길이도 프론트가 모른다. 폼은 이 값을 만들지 않는다 —
    // 이전 요청 불러오기만 싣는다.
    credential_id: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ok = value.host_format === 'IP' ? isValidIdcIp : (h: string) => HOSTNAME.test(h);
    for (const host of value.hosts) {
      if (!ok(host)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hosts'],
          message: `${value.host_format === 'IP' ? 'IP 주소' : '호스트명'} 형식이 아닙니다: ${host}`,
        });
      }
    }
  });

/**
 * 브라우저가 보내도 되는 전부. `.strict()` — 계약 스키마의 `.passthrough()` 와 정반대다.
 * 응답을 관대하게 읽는 것과 요청을 관대하게 받는 것은 다른 문제고, 여기는 요청이다.
 */
export const ApprovalSelectionInput = z
  .object({
    resources: z
      .array(
        z
          .object({
            // 빈 문자열도 받는다: 와이어가 resource_id 없이 준 행을 어댑터가 `''` 로
            // 싣는다(`app/lib/api/index.ts`). 어댑터가 목록에서 먼저 떨구고, 리졸버도
            // 떨군다. 길이는 스캔이 정하는 값이라 상한을 두지 않는다.
            resource_id: z.string(),
            selected: z.boolean(),
            /**
             * 사용자가 적은 제외 사유. 스캔 판정(recommend_fail_reason)은 서버가 붙인다.
             * 상한은 폼 textarea 의 `maxLength`(`EXCLUSION_REASON_MAXLEN`)에만 있다 —
             * 이전 요청이 그보다 긴 사유를 되싣으면 서버 상한은 막다른 400 이 된다.
             */
            exclusion_reason: z.string().optional(),
            /** RDS 클러스터에서 고른 멤버. 서버가 후보 목록 안에 있는지 확인한다. */
            selected_rds_instance_resource_id: z.string().min(1).optional(),
            /**
             * 검색해서 손으로 추가한 EC2 행이라는 표시. 스캔 목록에 없는 id 가
             * "오래된 화면"인지 "방금 추가한 인스턴스"인지는 서버가 구별할 수 없다 —
             * 그 갈래를 이 키가 고른다. 위조 방지 장치가 아니다(붙이면 그만이다):
             * 이 갈래의 진위는 BFF 가 판정하고, 여기서는 형식만 본다.
             */
            manual_ec2: ManualEc2Input.optional(),
            /** IDC 전용. 다른 provider 에서 오면 거부된다. */
            idc: IdcInput.optional(),
          })
          .strict(),
      )
      // 상한이 없다: 화면은 후보 **전부**(선택·제외·연동 불가)를 싣고 제 상한이 없으므로,
      // 여기 숫자를 적으면 그보다 큰 스캔은 새로고침해도 영영 제출할 수 없다.
      .min(1),
  })
  .strict();

export type ApprovalSelection = z.infer<typeof ApprovalSelectionInput>;
export type IdcInput = z.infer<typeof IdcInput>;
export type ManualEc2Input = z.infer<typeof ManualEc2Input>;
