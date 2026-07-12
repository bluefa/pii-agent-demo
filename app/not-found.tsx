import Link from 'next/link';
import { cn, getButtonClass, textColors } from '@/lib/theme';

/**
 * Brand 404 (replaces Next's default). Server component — theme tokens only.
 * `next/link` is basePath-aware, so `/services` resolves under `/integration`.
 */
export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <h1 className={cn('text-lg font-bold', textColors.primary)}>페이지를 찾을 수 없습니다</h1>
        <p className={cn('mt-1 text-[13px]', textColors.tertiary)}>
          주소가 잘못되었거나 삭제된 페이지입니다.
        </p>
        <Link href="/services" className={cn('mt-4 inline-block', getButtonClass('secondary', 'sm'))}>
          서비스 목록으로 이동
        </Link>
      </div>
    </div>
  );
}
