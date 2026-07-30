// BFF 가 내려주는 `resource_name` 이 있으면 그대로 쓰고, 없을 때만 resourceId 의 꼬리
// 세그먼트(AWS ARN 의 `:`, Azure/GCP 의 `/`, IDC 의 ' (' 앞부분)를 잘라 표시한다.
const IDC_HEAD_PATTERN = /^(.+?)\s*\(/;

export const getResourceDisplayName = (resource: {
  resourceId: string;
  resourceName?: string | null;
}): string => {
  const name = resource.resourceName?.trim();
  if (name) return name;

  const id = resource.resourceId;
  if (!id) return '—';

  const idcMatch = id.match(IDC_HEAD_PATTERN);
  if (idcMatch) return idcMatch[1];

  const lastSlash = id.lastIndexOf('/');
  if (lastSlash >= 0 && lastSlash < id.length - 1) return id.slice(lastSlash + 1);

  const lastColon = id.lastIndexOf(':');
  if (lastColon >= 0 && lastColon < id.length - 1) return id.slice(lastColon + 1);

  return id;
};
