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
 * **결과는 쌍이 아니라 그룹이다.** `.11 .12 .13` 이 각각 한 줄로 들어오면 (.11,.12) 와
 * (.12,.13) 두 쌍이 나오고 가운데 행이 양쪽에 걸린다 — 그걸 쌍 두 개로 보여 주면 표에서
 * 가운데 행을 어느 묶음에 세울지 정할 수 없고, 관리자가 확인할 질문도 둘이 아니라 "이 셋이
 * 같은 DB 인가" 하나다. 그래서 인접을 간선으로 보고 연결된 덩어리(연결 요소)를 그룹으로
 * 묶는다. 간선이 Port·Database Type 일치를 요구하므로 한 그룹의 구성원은 그 둘을 공유한다.
 *
 * 비교 범위는 이 요청 안의 행끼리다. 이미 확정된 연동 대상과의 중복은 여기서 볼 수
 * 있는 데이터가 아니다.
 */
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

/** 그룹의 구성원 한 줄. 표는 행을 이름이 아니라 접속 주소로 가리키므로, 경고도 주소로 가리킨다. */
export interface SuspectMember {
  /** 행 그 자체. 표에 표시를 다는 쪽이 인덱스로 되찾지 않도록 참조를 들고 다닌다 —
   *  목록은 필터·정렬·페이지를 거치지만 행 객체는 복제되지 않는다. */
  row: RequestResourceRow;
  /**
   * 다른 구성원과 인접한 주소들. IP Set 행은 주소를 8개까지 들고 그중 하나만 걸리는데,
   * 표는 첫 주소만 펼쳐 두므로 "어느 주소를 두고 하는 말인가"에 답하려면 이게 필요하다.
   */
  addresses: string[];
  /** 이 행이 등록한 접속 주소 개수. 1보다 크면 표에서 나머지가 접혀 있다. */
  addressCount: number;
}

export interface SuspectGroup {
  /**
   * 그룹 이름 — '1', '2' …. 표 어디에 서 있든 한 덩어리임을 말하는 채널이라 순수 층에서
   * 배정한다. 목록 순서를 따라 번호가 올라가므로, 위에서 아래로 읽으면 1·2·3 이 된다.
   */
  label: string;
  members: SuspectMember[];
  /** 구성원 전체가 공유하는 값 — 이게 같아서 의심하는 것이므로 경고에 함께 적는다. */
  databaseType: string;
  port: number;
}

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
 * 두 행이 이어져 있다는 사실을 세는 게 목적이고, 그 사실은 한 번이면 충분하다.
 */
function adjacentAddresses(
  left: readonly string[],
  right: readonly string[],
): [string, string] | null {
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

interface Edge {
  left: RequestResourceRow;
  right: RequestResourceRow;
  /** 간선을 만든 두 주소 (left 쪽, right 쪽). */
  addresses: [string, string];
}

/**
 * 인접 간선 — 행 쌍마다 최대 하나.
 *
 * 제외된 행은 비교하지 않는다. 승인해도 연동되지 않으므로 같은 데이터를 두 번 검사할
 * 일이 없고, 관리자가 손댈 것도 없다.
 *
 * 한 행 안의 주소끼리도 비교하지 않는다. IP Set 은 원래 한 대의 데이터베이스를 가리키는
 * 주소 묶음이라, 그 안의 인접은 정상이지 사고가 아니다.
 */
function adjacencyEdges(rows: readonly RequestResourceRow[]): Edge[] {
  const targets = rows.filter(
    (r) => r.selected && r.port != null && r.port > 0 && r.databaseType != null,
  );
  const edges: Edge[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      const left = targets[i];
      const right = targets[j];
      if (left.port !== right.port) continue;
      if (!sameDatabaseType(left.databaseType ?? '', right.databaseType ?? '')) continue;
      const hit = adjacentAddresses(left.connectTargets, right.connectTargets);
      if (hit === null) continue;
      edges.push({ left, right, addresses: hit });
    }
  }
  return edges;
}

const appendUnique = <K, V>(map: Map<K, V[]>, key: K, value: V): void => {
  const list = map.get(key);
  if (list == null) map.set(key, [value]);
  else if (!list.includes(value)) list.push(value);
};

/** 같은 데이터베이스일 수 있는 행들의 그룹 — 목록 순서대로, 구성원도 목록 순서대로. */
export function findSuspectGroups(rows: readonly RequestResourceRow[]): SuspectGroup[] {
  const edges = adjacencyEdges(rows);
  if (edges.length === 0) return [];

  const neighbours = new Map<RequestResourceRow, RequestResourceRow[]>();
  const matched = new Map<RequestResourceRow, string[]>();
  for (const edge of edges) {
    appendUnique(neighbours, edge.left, edge.right);
    appendUnique(neighbours, edge.right, edge.left);
    appendUnique(matched, edge.left, edge.addresses[0]);
    appendUnique(matched, edge.right, edge.addresses[1]);
  }

  const orderOf = new Map(rows.map((row, index) => [row, index]));
  const seen = new Set<RequestResourceRow>();
  const groups: SuspectGroup[] = [];
  // 목록 순서로 훑으며 아직 안 본 덩어리를 연다 — 그룹 번호가 화면을 따라 1·2·3 이 된다.
  for (const row of rows) {
    if (!neighbours.has(row) || seen.has(row)) continue;
    const found: RequestResourceRow[] = [];
    const queue = [row];
    seen.add(row);
    while (queue.length > 0) {
      const current = queue.shift() as RequestResourceRow;
      found.push(current);
      for (const next of neighbours.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    // 너비 우선 탐색이 뱉는 건 발견 순서다. 표는 목록 순서로 세우므로 여기서 맞춰 둔다.
    found.sort((a, b) => (orderOf.get(a) ?? 0) - (orderOf.get(b) ?? 0));
    groups.push({
      label: String(groups.length + 1),
      members: found.map((member) => ({
        row: member,
        addresses: matched.get(member) ?? [],
        addressCount: member.connectTargets.length,
      })),
      // 간선이 Port·Database Type 일치를 요구하므로 구성원 전체가 첫 행과 같은 값을 쓴다.
      databaseType: found[0].databaseType ?? '',
      port: found[0].port ?? 0,
    });
  }
  return groups;
}

/** 한 행에 붙는 표시 — 어느 그룹인지, 그리고 그 그룹을 만든 주소가 어느 것인지. */
export interface SuspectMark {
  label: string;
  addresses: string[];
}

/**
 * 행 → 표시. 행 객체를 키로 쓴다 — 목록은 필터·페이지를 거치지만 같은 참조가 그대로 흐른다.
 */
export function suspectMarksByRow(
  groups: readonly SuspectGroup[],
): Map<RequestResourceRow, SuspectMark> {
  const marks = new Map<RequestResourceRow, SuspectMark>();
  for (const group of groups) {
    for (const member of group.members) {
      marks.set(member.row, { label: group.label, addresses: member.addresses });
    }
  }
  return marks;
}

/** 의심 행만, 그룹 순서로. '확인 필요'로 좁혀 볼 때의 목록. */
export function suspectRows(groups: readonly SuspectGroup[]): RequestResourceRow[] {
  return groups.flatMap((group) => group.members.map((member) => member.row));
}

/**
 * 기본 목록에서도 한 그룹의 행들을 붙여 세운다 (오너 결정 2026-08-16: 요청 목록의 순서는
 * 의미가 없다). 그룹은 첫 구성원이 서 있던 자리에서 열리고 나머지가 그 뒤를 잇는다 —
 * 관련 없는 행은 제자리에 남으므로 목록 전체가 뒤집히지 않는다.
 */
export function groupSuspectRows(
  rows: readonly RequestResourceRow[],
  groups: readonly SuspectGroup[],
): RequestResourceRow[] {
  if (groups.length === 0) return [...rows];
  const groupOf = new Map<RequestResourceRow, SuspectGroup>();
  for (const group of groups) {
    for (const member of group.members) groupOf.set(member.row, group);
  }
  const emitted = new Set<RequestResourceRow>();
  const ordered: RequestResourceRow[] = [];
  for (const row of rows) {
    const group = groupOf.get(row);
    if (group == null) {
      ordered.push(row);
      continue;
    }
    if (emitted.has(row)) continue;
    for (const member of group.members) {
      emitted.add(member.row);
      ordered.push(member.row);
    }
  }
  return ordered;
}
