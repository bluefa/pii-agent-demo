/**
 * 한 요청 안에서 "같은 데이터베이스를 두 번 등록한 것 아닌가" 를 의심할 근거를 찾는다.
 *
 * IDC 는 자동 스캔이 없어 서비스 담당자가 접속 주소를 손으로 적는다. 그래서 한 대의
 * 데이터베이스가 두 줄로 들어오는 일이 생긴다 — 이중화 구성의 대표 주소와 서버 자신의
 * 주소를 따로 등록하거나, 같은 서버를 이름만 달리해 두 번 적는 식이다. 그대로 승인하면
 * 같은 데이터를 두 번 검사한다.
 *
 * 근거는 주소의 인접성이다: 앞 세 자리가 같고 마지막 자리가 1 이하로 차이 나는 IP.
 * **인접만으로는 경고가 될 수 없다** — DB 대역은 원래 .11 .12 .13 으로 이어 채우므로
 * 순차 대역 요청 하나면 모든 행이 걸린다. 그래서 Port 와 Database Type 까지 같을 때만
 * 의심한다: 한 대의 장비를 두 번 적은 것이라면 이 둘은 반드시 같고, 다르면 서로 다른
 * 데이터베이스라는 뜻이다.
 *
 * 비교 범위는 이 요청 안의 행끼리다. 이미 확정된 연동 대상과의 중복은 여기서 볼 수
 * 있는 데이터가 아니다.
 */
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

/** 인접 쌍의 한쪽. 표는 행을 이름이 아니라 접속 주소로 가리키므로, 경고도 주소로 가리킨다. */
export interface SuspectAddress {
  /** 이 주소를 등록한 행 그 자체. 표에 배지를 다는 쪽이 인덱스로 되찾지 않도록 참조를 들고
   *  다닌다 — 목록은 필터·정렬·페이지를 거치지만 행 객체는 복제되지 않는다. */
  row: RequestResourceRow;
  address: string;
  /** 이 주소가 속한 행이 가진 주소 개수. 1보다 크면 표에서 접혀 있을 수 있다. */
  addressCount: number;
}

export interface DuplicateAddressPair {
  /**
   * 쌍의 이름 — 'A', 'B' …. 표에 흩어져 선 두 행이 서로의 짝임을 말하는 유일한 채널이라
   * (계약 순서대로 서고 10건씩 페이지가 갈리므로 두 행은 붙어 있지 않다) 순수 층에서
   * 배정한다. 27번째부터는 글자가 없어 번호로 넘어간다.
   */
  label: string;
  a: SuspectAddress;
  b: SuspectAddress;
  /** 두 행이 공유하는 값 — 이게 같아서 의심하는 것이므로 경고에 함께 적는다. */
  databaseType: string;
  port: number;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const pairLabel = (index: number): string =>
  index < LETTERS.length ? LETTERS[index] : String(index + 1);

interface Ipv4 {
  /** 앞 세 자리 ('10.20.1') — 같은 대역인지 판정하는 키. */
  prefix: string;
  /** 마지막 자리. */
  last: number;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** IPv4 만 파싱한다. 도메인 행(호스트명 한 개)과 잘린 값은 null 로 떨어져 비교에서 빠진다. */
function parseIpv4(value: string): Ipv4 | null {
  const m = IPV4.exec(value.trim());
  if (m === null) return null;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return { prefix: parts.slice(0, 3).join('.'), last: parts[3] };
}

/**
 * 두 행 사이에서 인접한 주소 한 쌍. 한 행 쌍에서 여러 쌍이 나와도 하나만 돌려준다 —
 * 관리자가 확인할 것은 "이 두 행이 같은 DB 인가" 하나이고, 같은 질문을 주소 개수만큼
 * 반복하면 경고가 목록이 된다.
 */
function adjacentPair(left: readonly string[], right: readonly string[]): [string, string] | null {
  for (const l of left) {
    const a = parseIpv4(l);
    if (a === null) continue;
    for (const r of right) {
      const b = parseIpv4(r);
      if (b === null) continue;
      if (a.prefix === b.prefix && Math.abs(a.last - b.last) <= 1) return [l, r];
    }
  }
  return null;
}

/** 계약이 Database Type 을 어떤 대소문자로 주든 같은 엔진이면 같게 본다. */
const sameDatabaseType = (a: string, b: string): boolean =>
  a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * 인접 주소 쌍 — 행 순서대로, 행 쌍마다 최대 한 건.
 *
 * 제외된 행은 비교하지 않는다. 승인해도 연동되지 않으므로 같은 데이터를 두 번 검사할
 * 일이 없고, 관리자가 손댈 것도 없다.
 *
 * 한 행 안의 주소끼리도 비교하지 않는다. IP Set 은 원래 한 대의 데이터베이스를 가리키는
 * 주소 묶음이라, 그 안의 인접은 정상이지 사고가 아니다.
 */
export function findDuplicateAddressPairs(
  rows: readonly RequestResourceRow[],
): DuplicateAddressPair[] {
  const targets = rows.filter(
    (r) => r.selected && r.port != null && r.port > 0 && r.databaseType != null,
  );
  const pairs: DuplicateAddressPair[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      const left = targets[i];
      const right = targets[j];
      if (left.port !== right.port) continue;
      if (!sameDatabaseType(left.databaseType ?? '', right.databaseType ?? '')) continue;
      const hit = adjacentPair(left.connectTargets, right.connectTargets);
      if (hit === null) continue;
      pairs.push({
        label: pairLabel(pairs.length),
        a: { row: left, address: hit[0], addressCount: left.connectTargets.length },
        b: { row: right, address: hit[1], addressCount: right.connectTargets.length },
        databaseType: left.databaseType ?? '',
        port: left.port ?? 0,
      });
    }
  }
  return pairs;
}

/** 한 행에 붙는 표시 — 어느 쌍에 속하는지, 그리고 그 쌍을 만든 주소가 어느 것인지. */
export interface SuspectMark {
  /** 이 행이 속한 쌍 이름들. 한 행이 두 쌍에 걸릴 수 있다(.18↔.19 와 .19↔.20 이면
   *  가운데 행은 A 이자 B 다). */
  labels: string[];
  /**
   * 짝과 인접한 주소들. IP Set 행은 주소를 8개까지 들고 그중 하나만 짝에 걸리는데, 표는
   * 첫 주소만 펼쳐 두므로 걸린 주소가 접혀 있을 수 있다 — 어느 주소를 두고 하는 말인지
   * 표에서 짚으려면 이 목록이 필요하다.
   */
  addresses: string[];
}

/**
 * 행 → 표시. 행 객체를 키로 쓴다 — 목록은 필터·페이지를 거치지만 같은 참조가 그대로 흐른다.
 */
export function suspectMarksByRow(
  pairs: readonly DuplicateAddressPair[],
): Map<RequestResourceRow, SuspectMark> {
  const marks = new Map<RequestResourceRow, SuspectMark>();
  for (const pair of pairs) {
    for (const side of [pair.a, pair.b]) {
      const mark = marks.get(side.row);
      if (mark == null) {
        marks.set(side.row, { labels: [pair.label], addresses: [side.address] });
        continue;
      }
      mark.labels.push(pair.label);
      if (!mark.addresses.includes(side.address)) mark.addresses.push(side.address);
    }
  }
  return marks;
}

/**
 * 의심 행만, 쌍끼리 붙여 세운 순서. '확인 필요'로 좁혀 볼 때 두 행이 나란히 서야
 * 묶음으로 읽힌다 — 기본 목록의 계약 순서는 건드리지 않고, 이 뷰에서만 다시 세운다.
 *
 * 두 쌍에 걸친 행은 먼저 만난 쌍에 선다(한 번만 등장한다).
 */
export function suspectRowsInPairOrder(
  pairs: readonly DuplicateAddressPair[],
): RequestResourceRow[] {
  const ordered: RequestResourceRow[] = [];
  const seen = new Set<RequestResourceRow>();
  for (const pair of pairs) {
    for (const side of [pair.a, pair.b]) {
      if (seen.has(side.row)) continue;
      seen.add(side.row);
      ordered.push(side.row);
    }
  }
  return ordered;
}
