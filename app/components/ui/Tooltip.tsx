'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/theme';

type TooltipSize = 'sm' | 'md' | 'lg' | 'xl';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: TooltipSize;
}

const sizeClasses: Record<TooltipSize, string> = {
  sm: 'min-w-48 max-w-64',   // 192px ~ 256px
  md: 'min-w-64 max-w-80',   // 256px ~ 320px
  lg: 'min-w-80 max-w-96',   // 320px ~ 384px
  xl: 'min-w-96 max-w-[28rem]', // 384px ~ 448px
};

export const Tooltip = ({
  content,
  children,
  position = 'top',
  size = 'md',
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const container = containerRef.current.getBoundingClientRect();
      const padding = 16; // 화면 가장자리 여백

      // 상하 위치 조정
      if (position === 'top' && container.top - tooltip.height < padding) {
        setActualPosition('bottom');
      } else if (position === 'bottom' && container.bottom + tooltip.height > window.innerHeight - padding) {
        setActualPosition('top');
      } else {
        setActualPosition(position);
      }

      // 좌우 잘림 방지 (top/bottom 포지션일 때)
      if (position === 'top' || position === 'bottom') {
        const tooltipLeft = container.left + container.width / 2 - tooltip.width / 2;
        const tooltipRight = tooltipLeft + tooltip.width;

        if (tooltipLeft < padding) {
          // 왼쪽으로 잘림 → 오른쪽으로 이동
          setHorizontalOffset(padding - tooltipLeft);
        } else if (tooltipRight > window.innerWidth - padding) {
          // 오른쪽으로 잘림 → 왼쪽으로 이동
          setHorizontalOffset(window.innerWidth - padding - tooltipRight);
        } else {
          setHorizontalOffset(0);
        }
      }
    }
  }, [isVisible, position]);

  const getPositionClasses = () => {
    const base = {
      top: 'bottom-full mb-2',
      bottom: 'top-full mt-2',
      left: 'right-full top-1/2 -translate-y-1/2 mr-2',
      right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };
    return base[actualPosition];
  };

  const getTooltipStyle = (): React.CSSProperties => {
    if (actualPosition === 'top' || actualPosition === 'bottom') {
      return {
        left: '50%',
        transform: `translateX(calc(-50% + ${horizontalOffset}px))`,
      };
    }
    return {};
  };

  const getArrowStyle = (): React.CSSProperties => {
    if (actualPosition === 'top' || actualPosition === 'bottom') {
      return {
        left: '50%',
        transform: `translateX(calc(-50% - ${horizontalOffset}px))`,
      };
    }
    return {};
  };

  const arrowClasses = {
    top: 'top-full border-t-gray-700 border-x-transparent border-b-transparent',
    bottom: 'bottom-full border-b-gray-700 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-700 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-700 border-y-transparent border-l-transparent',
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          style={getTooltipStyle()}
          className={cn(
            'absolute z-50 px-4 py-3 text-sm leading-relaxed',
            'text-gray-100 bg-gray-700 rounded-xl shadow-xl',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            sizeClasses[size],
            getPositionClasses()
          )}
        >
          {content}
          <div
            style={getArrowStyle()}
            className={cn(
              'absolute w-0 h-0 border-[6px]',
              arrowClasses[actualPosition]
            )}
          />
        </div>
      )}
    </div>
  );
};

// 정보 아이콘과 함께 사용하는 Tooltip
interface InfoTooltipProps {
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: TooltipSize;
}

export const InfoTooltip = ({ content, position = 'top', size = 'lg' }: InfoTooltipProps) => {
  return (
    <Tooltip content={content} position={position} size={size}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 text-gray-400 hover:text-blue-500 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
          />
        </svg>
      </button>
    </Tooltip>
  );
};
