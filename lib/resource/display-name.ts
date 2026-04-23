import type { Resource } from '@/lib/types';

// Resource 타입에 `resourceName`(논리 DB 이름) 필드가 없어, resourceId 의 꼬리
// 세그먼트(AWS ARN 의 `:`, Azure/GCP 의 `/`, IDC 의 ' (' 앞부분)를 잘라 표시.
// BFF 가 별도 DB Name 필드를 게시하면 이 함수 본문만 교체하면 된다.
export const getResourceDisplayName = (resource: Resource): string => {
  const id = resource.resourceId;
  if (!id) return '—';

  const idcMatch = id.match(/^(.+?)\s*\(/);
  if (idcMatch) return idcMatch[1];

  const lastSlash = id.lastIndexOf('/');
  if (lastSlash >= 0 && lastSlash < id.length - 1) return id.slice(lastSlash + 1);

  const lastColon = id.lastIndexOf(':');
  if (lastColon >= 0 && lastColon < id.length - 1) return id.slice(lastColon + 1);

  return id;
};
