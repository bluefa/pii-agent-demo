import type { IdcResourceView } from '@/app/lib/api/idc';

/**
 * 도메인 대상의 비고. 접속 주소가 IP 가 아니므로 방화벽 정책을 그대로 쓸 수 없고,
 * 담당자가 그 도메인이 가리키는 IP Range 를 확인해야 한다.
 */
export const DOMAIN_NOTE = 'IP Range 직접 확인 필요';

/** 방화벽 정책 한 건 — Source IP 하나에서 접속 주소 하나로. */
export interface FirewallRequestRow {
  sourceIp: string;
  host: string;
  /** 0 은 어댑터의 "payload 에 port 없음" 값이지 포트가 아니다 — 빈 칸으로 나간다. */
  port: number;
  databaseType: string;
  note: string;
}

/**
 * 확정 연동 행 → 방화벽 정책 행.
 *
 * Source IP × 접속 주소의 곱으로 전개한다: 한 줄이 정책 한 건이어야 내려받은 파일을
 * 그대로 방화벽 담당자에게 낼 수 있다. 다중 IP 대상은 여기서 여러 줄로 쪼개진다.
 *
 * 제외 행은 뺀다 — 열 필요가 없는 경로를 요청서에 실으면 불필요한 정책이 열린다.
 */
export const toFirewallRequestRows = (
  resources: readonly IdcResourceView[],
): FirewallRequestRow[] =>
  resources
    .filter((resource) => !resource.excluded)
    .flatMap((resource) =>
      resource.sourceIps.flatMap((sourceIp) =>
        resource.hosts.map((host) => ({
          sourceIp,
          host,
          port: resource.port,
          databaseType: resource.databaseTypeLabel,
          note: resource.kind === 'DOMAIN' ? DOMAIN_NOTE : '',
        })),
      ),
    );

const CSV_HEADER = ['Source IP', '접속 주소', 'Port', 'Database Type', '비고'] as const;

// 값에 쉼표·따옴표·개행이 들어가면 Excel 이 열을 잘못 나눈다 (RFC 4180 인용 규칙).
// 접속 주소와 Oracle SID 가 붙은 Database Type 이 실제로 해당된다.
const csvCell = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const toFirewallRequestCsv = (rows: readonly FirewallRequestRow[]): string =>
  [
    CSV_HEADER as readonly string[],
    ...rows.map((row) => [
      row.sourceIp,
      row.host,
      row.port ? String(row.port) : '',
      row.databaseType,
      row.note,
    ]),
  ]
    .map((cells) => cells.map(csvCell).join(','))
    .join('\r\n');

/** UTF-8 BOM. 없으면 Excel 이 CP949 로 읽어 헤더의 한글이 깨진다. */
const BOM = '﻿';

const yyyymmdd = (date: Date): string =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

export const firewallRequestFileName = (targetSourceId: number, now = new Date()): string =>
  `방화벽요청_${targetSourceId}_${yyyymmdd(now)}.csv`;

/**
 * 브라우저에서 파일을 만들어 내려받는다 — 값이 이미 화면에 있으므로 서버 왕복이 없다.
 * 저장 방식은 AWS TF Script 다운로드(AwsInstallationInline)와 같은 문법.
 */
export const downloadFirewallRequestCsv = (
  rows: readonly FirewallRequestRow[],
  fileName: string,
): void => {
  const blob = new Blob([BOM + toFirewallRequestCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
