/**
 * 승인 요청에서 브라우저가 보낼 수 있는 전부 — 그 모양 하나.
 *
 * 왜 좁은지, 라우트가 이걸로 무엇을 하는지는 `app/api/_lib/approval-input.ts` 머리말.
 * 이 파일은 상류 클라이언트를 모른다: 모양은 브라우저와 서버가 함께 읽는 어휘이고,
 * 판정은 서버만의 일이라 파일을 나눈다.
 */
import { z } from 'zod';
// IP 판정은 입력 모달과 같은 주인을 쓴다 — 폼이 통과시킨 값을 서버가 되돌려
// 보내면 그 자리가 곧 false positive 다.
import { IDC_SID_MAXLEN, isValidIdcIp } from '@/lib/constants/idc';

/**
 * 한 요청이 실을 수 있는 행 수. 화면은 후보 **전부**(선택·제외·연동 불가)를 싣고 제 상한이
 * 없다 — 그러니 이 숫자는 정책이 아니라 화면이 닿을 수 없어야 하는 sanity 상한이다.
 */
const MAX_RESOURCES = 10000;
/**
 * 제외 사유 길이. 입력 폼(`CandidateResourceSection`)이 쓰는 값과 **같은 상수**여야
 * 한다 — 폼이 받아 준 글자를 서버가 되돌려 보내면 그 자리가 곧 false positive 다.
 */
export const EXCLUSION_REASON_MAXLEN = 1000;
/** IDC 한 행이 묶을 수 있는 IP 수. MULTIPLE_IP 실사용은 한 자릿수다. */
const MAX_IDC_HOSTS = 32;
// 호스트명은 폼(`IDC_DOMAIN_RE`)보다 한 칸 넓게 본다: 점 없는 이름·밑줄까지 받는다.
// 이전 요청 왕복이 폼을 거치지 않은 값을 되싣기 때문이고, 서버가 폼보다 엄격해지는
// 순간 그 차이가 전부 false positive 가 된다.
const HOSTNAME = /^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/;

/**
 * 수기 접속 정보. VM 추가와 IDC 가 같은 모양을 쓴다 — 둘 다 사용자가 친 값이고,
 * 서버에 원본이 없다는 성격이 같다.
 */
const EndpointInput = z
  .object({
    host: z.string().min(1).max(253).optional(),
    // 하한이 0 인 이유: 카탈로그는 `port !== null` 이면 endpointConfig 를 만들므로
    // 와이어의 port 0 이 그대로 올라온다. 옛 경로도 0 을 그대로 보냈다.
    port: z.number().int().min(0).max(65535).optional(),
    database_type: z.string().min(1).max(64).optional(),
    oracle_service_id: z.string().min(1).max(128).optional(),
    // 스캔이 준 값이다. Azure NIC 리소스 id
    // (`/subscriptions/{guid}/resourceGroups/{≤90}/providers/Microsoft.Network/networkInterfaces/{≤80}`)
    // 는 256 을 넘는다 — 와이어 값이 닿을 수 있는 상한은 검증이 아니라 막다른 길이다.
    network_interface_id: z.string().min(1).max(1024).optional(),
  })
  .strict();

/**
 * 수기 추가 EC2 행이 스스로 말하는 것. 이름(Private DNS)은 추가 모달이 검색 결과에서
 * 받은 값이고, 서버가 다시 확인하지 않는다 — 이 경로의 진위는 BFF 가 막는다.
 */
const ManualEc2Input = z
  .object({
    // 빈 문자열도 받는다: EC2 검색 와이어가 private DNS 이름 없이 돌아오면 매퍼가
    // `''` 를 싣는다(`app/lib/api/ec2.ts`). 없던 거부를 만들지 않는다.
    resource_name: z.string().max(253).optional(),
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
    hosts: z.array(z.string().min(1).max(253)).max(MAX_IDC_HOSTS),
    // `database_type` 은 계약상 평문 문자열이고, 이전 요청 불러오기가 enum 밖 값을
    // 되싣는다. enum 으로 좁히면 그 왕복이 깨지므로 길이만 본다.
    database_type: z.string().min(1).max(64).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    // 모달 input 의 `maxLength` 가 읽는 바로 그 상수다.
    oracle_service_id: z.string().min(1).max(IDC_SID_MAXLEN).optional(),
    // 와이어가 발급한 id 이고 형식은 프론트가 모른다. 폼은 이 값을 만들지 않는다 —
    // 이전 요청 불러오기만 싣는다. sanity 상한이다.
    credential_id: z.string().min(1).max(256).optional(),
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
            // 싣는다(`app/lib/api/index.ts`). 리졸버가 교집합에서 걸러 낸다. 프론트가
            // 짓지 않는 와이어 값을 가리키는 포인터라 상한은 sanity 일 뿐이다.
            resource_id: z.string().max(1024),
            selected: z.boolean(),
            /** 사용자가 적은 제외 사유. 스캔 판정(recommend_fail_reason)은 서버가 붙인다. */
            exclusion_reason: z.string().max(EXCLUSION_REASON_MAXLEN).optional(),
            /** RDS 클러스터에서 고른 멤버. 서버가 후보 목록 안에 있는지 확인한다. */
            selected_rds_instance_resource_id: z.string().min(1).max(1024).optional(),
            /** VM 계열 수기 접속 정보. */
            endpoint: EndpointInput.optional(),
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
      .min(1)
      .max(MAX_RESOURCES),
  })
  .strict();

export type ApprovalSelection = z.infer<typeof ApprovalSelectionInput>;
export type EndpointInput = z.infer<typeof EndpointInput>;
export type IdcInput = z.infer<typeof IdcInput>;
export type ManualEc2Input = z.infer<typeof ManualEc2Input>;
