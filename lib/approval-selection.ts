/**
 * 승인 요청에서 브라우저가 보낼 수 있는 전부 — 그 모양 하나.
 *
 * 왜 좁은지, 라우트가 이걸로 무엇을 하는지는 `app/api/_lib/approval-input.ts` 머리말.
 * 이 파일은 상류 클라이언트를 모른다: 모양은 브라우저와 서버가 함께 읽는 어휘이고,
 * 판정은 서버만의 일이라 파일을 나눈다.
 */
import { z } from 'zod';

/** 한 요청이 실을 수 있는 행 수. 스캔 결과 규모(수백)보다 넉넉하되 무한은 아니다. */
const MAX_RESOURCES = 500;
/** IDC 한 행이 묶을 수 있는 IP 수. MULTIPLE_IP 실사용은 한 자릿수다. */
const MAX_IDC_HOSTS = 32;
const isIpv4 = (value: string): boolean => {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) =>
    /^\d{1,3}$/.test(part) && Number(part) <= 255 && String(Number(part)) === part);
};

// 라벨 하나. 밑줄/점/하이픈까지 — 상류가 받아 온 호스트명을 되돌려 보내는 경로가 있어
// RFC 보다 한 칸 넓다.
const HOSTNAME = /^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/;

/**
 * 수기 접속 정보. VM 추가와 IDC 가 같은 모양을 쓴다 — 둘 다 사용자가 친 값이고,
 * 서버에 원본이 없다는 성격이 같다.
 */
const EndpointInput = z
  .object({
    host: z.string().min(1).max(253).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    database_type: z.string().min(1).max(64).optional(),
    oracle_service_id: z.string().min(1).max(128).optional(),
    network_interface_id: z.string().min(1).max(256).optional(),
  })
  .strict();

/**
 * 수기 추가 EC2 행이 스스로 말하는 것. 이름(Private DNS)은 추가 모달이 검색 결과에서
 * 받은 값이고, 서버가 다시 확인하지 않는다 — 이 경로의 진위는 BFF 가 막는다.
 */
const ManualEc2Input = z
  .object({
    resource_name: z.string().min(1).max(253).optional(),
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
    oracle_service_id: z.string().min(1).max(128).optional(),
    credential_id: z.string().min(1).max(64).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ok = value.host_format === 'IP' ? isIpv4 : (h: string) => HOSTNAME.test(h);
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
            resource_id: z.string().min(1).max(512),
            selected: z.boolean(),
            /** 사용자가 적은 제외 사유. 스캔 판정(recommend_fail_reason)은 서버가 붙인다. */
            exclusion_reason: z.string().max(500).optional(),
            /** RDS 클러스터에서 고른 멤버. 서버가 후보 목록 안에 있는지 확인한다. */
            selected_rds_instance_resource_id: z.string().min(1).max(512).optional(),
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
